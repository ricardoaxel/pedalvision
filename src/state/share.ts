import { create } from "zustand";
import {
	decodeShareHash,
	encodeShareLink,
	SHARE_HASH_PREFIX,
	type ShareDecodeResult,
	type ShareEncodeResult,
} from "../lib/shareLink";
import {
	type SaveCopyResult,
	type SceneLibraryRuntime,
	sceneLibrary,
} from "./library";
import type { SceneSnapshot } from "./sceneDocument";

/**
 * Share links (P3-03, design.md §Persistence).
 *
 * Sender: `buildShareLink` encodes the active scene. The sender's address bar
 * is never mutated. Recipient: `initSharePreview` runs after persistence boot,
 * decodes the hash and asks the library to enter read-only preview; the
 * recipient's own document is never written while previewing.
 */
export type ShareStatus = "none" | "preview" | "error";

type ShareErrorReason = Extract<ShareDecodeResult, { ok: false }>["reason"];

export interface ShareErrorState {
	reason: ShareErrorReason;
	message: string;
}

interface ShareState {
	status: ShareStatus;
	/** The shared scene's name while previewing. */
	name: string | null;
	error: ShareErrorState | null;
	/** The new scene name after a successful "Save a copy". */
	savedAs: string | null;
	setPreview: (name: string) => void;
	setError: (error: ShareErrorState) => void;
	notifySaved: (name: string) => void;
	dismissSaved: () => void;
	clear: () => void;
}

export const useShare = create<ShareState>((set) => ({
	status: "none",
	name: null,
	error: null,
	savedAs: null,
	setPreview: (name) =>
		set({ status: "preview", name, error: null, savedAs: null }),
	setError: (error) =>
		set({ status: "error", name: null, error, savedAs: null }),
	notifySaved: (name) =>
		set({ status: "none", name: null, error: null, savedAs: name }),
	dismissSaved: () => set({ savedAs: null }),
	clear: () => set({ status: "none", name: null, error: null, savedAs: null }),
}));

/** Is this hash a share link (even if malformed)? */
export function isShareHash(hash: string): boolean {
	return hash.startsWith(SHARE_HASH_PREFIX);
}

/** Clear `#s=…` without a navigation (the recipient's history is preserved). */
export function clearShareHash(): void {
	if (typeof window === "undefined") return;
	if (!isShareHash(window.location.hash)) return;
	window.history.replaceState(
		null,
		"",
		`${window.location.pathname}${window.location.search}`,
	);
}

/**
 * Decode the current hash after persistence boot. A malformed link never
 * touches the store: it becomes an inline error over the recipient's scene.
 */
export async function initSharePreview(
	runtime: SceneLibraryRuntime,
): Promise<void> {
	if (typeof window === "undefined") return;
	const hash = window.location.hash;
	if (!isShareHash(hash)) return;
	const decoded = decodeShareHash(hash);
	if (!decoded.ok) {
		useShare.getState().setError({
			reason: decoded.reason,
			message: decoded.message,
		});
		return;
	}
	try {
		await runtime.enterPreview(decoded.snapshot, decoded.name);
		useShare.getState().setPreview(decoded.name);
	} catch {
		useShare.getState().setError({
			reason: "corrupt",
			message: "This share link couldn’t be opened.",
		});
	}
}

export interface ShareLinkOk {
	ok: true;
	url: string;
	decodedBytes: number;
	compressedBytes: number;
}

export type ShareLinkResult =
	| ShareLinkOk
	| Extract<ShareEncodeResult, { ok: false }>;

/**
 * Build the complete URL for a scene snapshot. The base URL keeps the current
 * origin + path (and query) but drops any existing hash.
 */
export function buildShareLink(
	name: string,
	snapshot: SceneSnapshot,
	baseUrl?: string,
): ShareLinkResult {
	const encoded = encodeShareLink(name, snapshot);
	if (!encoded.ok) return encoded;
	const base =
		baseUrl ??
		(typeof window === "undefined"
			? ""
			: (window.location.href.split("#")[0] ?? window.location.href));
	return {
		ok: true,
		url: `${base}${encoded.hash}`,
		decodedBytes: encoded.decodedBytes,
		compressedBytes: encoded.compressedBytes,
	};
}

/** Save the preview as a new editable scene, then leave read-only mode. */
export async function saveSharedCopy(name?: string): Promise<SaveCopyResult> {
	const result = await sceneLibrary.savePreviewAsCopy(name);
	if (result.ok) {
		useShare.getState().notifySaved(result.name);
		clearShareHash();
	}
	return result;
}

/** Exit the preview without saving; the recipient's scene is restored. */
export async function exitSharedPreview(): Promise<void> {
	await sceneLibrary.exitPreview();
	useShare.getState().clear();
	clearShareHash();
}

/** Dismiss an invalid-link error; the recipient's scene was never touched. */
export function dismissShareError(): void {
	useShare.getState().clear();
	clearShareHash();
}
