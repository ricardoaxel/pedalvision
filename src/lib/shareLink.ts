import { deflateSync, Inflate, strFromU8, strToU8 } from "fflate";
import { z } from "zod";
import { EFFECT_TYPES, JACK_EDGES, JACK_KINDS } from "../catalog/schema";
import type { CustomPedal, PlacedBoard, PlacedItem } from "../state/scene";
import {
	normalizeSceneContent,
	type SceneSnapshot,
} from "../state/sceneDocument";
import { BOARD_TEXTURES } from "./boardTexture";
import { MAX_BOARD_DIMENSION_CM } from "./customBoard";
import { MAX_DIMENSION_CM } from "./customPedal";

/**
 * Share-link codec (P3-03, design.md §Persistence).
 *
 * Format: `#s=v1:<base64url(deflate(JSON))>`. The payload is self-contained:
 * boards, placed items and inline custom pedals travel together, so a shared
 * scene renders identically on any device even after the catalog changes (A5).
 * Unknown refIds are deliberately accepted — `resolveItem` renders a labeled
 * fallback at the stored footprint rather than failing the scene.
 *
 * Untrusted input is validated with zod **before** it reaches the store. The
 * decoded JSON is capped at ~200 KB and the compressed input is capped and
 * inflated into a bounded output buffer, so a link bomb can't allocate memory
 * proportional to its expansion ratio. The capacity hard caps are NOT applied
 * on load: an over-cap shared scene still opens (read-only, warned; A4/A5).
 */

export const SHARE_HASH_PREFIX = "#s=";
export const SHARE_VERSION = 1;
export const SHARE_DECODED_LIMIT_BYTES = 200 * 1024;
export const SHARE_COMPRESSED_LIMIT_BYTES = 256 * 1024;
/** Base64 of the compressed limit, +4 for rounding. */
export const SHARE_BASE64_LIMIT_LENGTH = Math.ceil(
	(SHARE_COMPRESSED_LIMIT_BYTES * 4) / 3 + 4,
);
/** Matches the scene-name cap used by the library (`SCENE_NAME_MAX_LENGTH`). */
export const SHARE_NAME_MAX_LENGTH = 48;

/** Giving up on the share panel's "large but valid" hint. */
export const SHARE_LONG_LINK_THRESHOLD = 8_000;

export type ShareErrorReason =
	| "invalid"
	| "unsupported-version"
	| "too-large"
	| "corrupt";

export interface ShareError {
	ok: false;
	reason: ShareErrorReason;
	message: string;
}

export interface ShareEncodeOk {
	ok: true;
	hash: string;
	decodedBytes: number;
	compressedBytes: number;
}

export interface ShareEncodeTooLarge {
	ok: false;
	reason: "too-large";
	decodedBytes: number;
	compressedBytes: number;
	limitBytes: number;
	message: string;
}

export type ShareEncodeResult = ShareEncodeOk | ShareEncodeTooLarge;

export interface ShareDecodeOk {
	ok: true;
	name: string;
	snapshot: SceneSnapshot;
	decodedBytes: number;
	compressedBytes: number;
}

export type ShareDecodeResult = ShareDecodeOk | ShareError;

export interface SharePayload {
	version: 1;
	name: string;
	boards: PlacedBoard[];
	items: PlacedItem[];
	customPedals: CustomPedal[];
}

const COORD_LIMIT_CM = 1_000_000;

const boundedString = (max: number) => z.string().min(1).max(max);
const optionalString = (max: number) => z.string().max(max).optional();
const coordinate = z.number().finite().min(-COORD_LIMIT_CM).max(COORD_LIMIT_CM);

const sizeSchema = z.object({
	widthCm: z.number().finite().positive().max(MAX_BOARD_DIMENSION_CM),
	heightCm: z.number().finite().positive().max(MAX_BOARD_DIMENSION_CM),
});

const boardSchema = z
	.object({
		uid: boundedString(128),
		boardRefId: z.string().min(1).max(200).nullable(),
		customSize: sizeSchema.optional(),
		texture: z.enum(BOARD_TEXTURES).optional(),
		name: optionalString(200),
		brand: optionalString(200),
		x: coordinate,
		y: coordinate,
		rotationDeg: z.number().finite(),
	})
	.superRefine((board, ctx) => {
		// Mirrors sceneDocument.isPlacedBoard: a custom board carries a bounded
		// inline size; a catalog board must not carry one (it would stretch art).
		if (board.boardRefId === null && !board.customSize) {
			ctx.addIssue({
				code: "custom",
				path: ["customSize"],
				message: "A custom board needs an inline size",
			});
		}
		if (board.boardRefId !== null && board.customSize !== undefined) {
			ctx.addIssue({
				code: "custom",
				path: ["customSize"],
				message: "A catalog board must not carry a custom size",
			});
		}
	});

const itemSchema = z.object({
	uid: boundedString(128),
	refId: boundedString(200),
	kind: z.enum(["pedal", "supply"]),
	boardUid: z.string().min(1).max(128).nullable(),
	x: coordinate,
	y: coordinate,
	rotationDeg: z.number().finite(),
	z: z.number().finite(),
});

const jackSchema = z.object({
	kind: z.enum(JACK_KINDS),
	edge: z.enum(JACK_EDGES),
	pos: z.number().finite().min(0).max(1),
});

const powerSchema = z.object({
	voltage: z.number().finite(),
	acDc: z.enum(["DC", "AC"]),
	currentMa: z.number().finite(),
});

const customPedalSchema = z.object({
	refId: boundedString(200),
	brand: z.string().max(200),
	name: z.string().max(200),
	widthCm: z.number().finite().positive().max(MAX_DIMENSION_CM),
	heightCm: z.number().finite().positive().max(MAX_DIMENSION_CM),
	category: z.enum(["pedal", "supply"]),
	effectTypes: z.array(z.enum(EFFECT_TYPES)).max(32),
	jacks: z.array(jackSchema).max(32).optional(),
	power: powerSchema.optional(),
});

const payloadSchema = z.object({
	version: z.literal(SHARE_VERSION),
	name: optionalString(200),
	boards: z.array(boardSchema).max(5_000),
	items: z.array(itemSchema).max(5_000),
	customPedals: z.array(customPedalSchema).max(5_000),
});

function tooLargeEncode(
	decodedBytes: number,
	compressedBytes: number,
): ShareEncodeTooLarge {
	return {
		ok: false,
		reason: "too-large",
		decodedBytes,
		compressedBytes,
		limitBytes: SHARE_DECODED_LIMIT_BYTES,
		message: `This scene is too large to share (${formatKb(decodedBytes)} of the ${formatKb(SHARE_DECODED_LIMIT_BYTES)} limit).`,
	};
}

function tooLargeDecode(): ShareError {
	return {
		ok: false,
		reason: "too-large",
		message:
			"This share link is too big to open. It is over the 200 KB share limit.",
	};
}

function formatKb(bytes: number): string {
	return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Encode a base64url string (RFC 4648 §5) without a dependency. */
function bytesToBase64Url(bytes: Uint8Array): string {
	let binary = "";
	const chunkSize = 0x8000;
	for (let index = 0; index < bytes.length; index += chunkSize) {
		binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
	}
	return btoa(binary)
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
}

/** Decode base64url; null for any character/padding error (never throws). */
function base64UrlToBytes(value: string): Uint8Array | null {
	if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
	const remainder = value.length % 4;
	if (remainder === 1) return null;
	const padded =
		value.replace(/-/g, "+").replace(/_/g, "/") +
		"=".repeat(remainder === 0 ? 0 : 4 - remainder);
	try {
		const binary = atob(padded);
		const bytes = new Uint8Array(binary.length);
		for (let index = 0; index < binary.length; index += 1) {
			bytes[index] = binary.charCodeAt(index);
		}
		return bytes;
	} catch {
		return null;
	}
}

/** Trim a shared name to the same length the library accepts. */
function normalizeShareName(name: string | undefined): string {
	const trimmed = (name ?? "").trim();
	if (!trimmed) return "Shared scene";
	return trimmed.slice(0, SHARE_NAME_MAX_LENGTH);
}

/**
 * Keep the first entry per key. Untrusted payloads can repeat uids/refIds;
 * duplicates would collide in React and in the reference graph. Keeping the
 * first is resilient (the scene still opens) without letting a later entry
 * overwrite a valid one.
 */
function uniqueBy<T>(values: T[], key: (value: T) => string): T[] {
	const seen = new Set<string>();
	const result: T[] = [];
	for (const value of values) {
		const id = key(value);
		if (seen.has(id)) continue;
		seen.add(id);
		result.push(value);
	}
	return result;
}

/**
 * Build the share hash for a scene snapshot. Returns an inline-safe result;
 * an over-ceiling scene is refused (never truncated) so the sender can remove
 * parts and try again.
 */
export function encodeShareLink(
	name: string,
	snapshot: SceneSnapshot,
): ShareEncodeResult {
	const payload: SharePayload = {
		version: SHARE_VERSION,
		name: normalizeShareName(name),
		boards: snapshot.boards,
		items: snapshot.items,
		customPedals: snapshot.customPedals,
	};
	const json = JSON.stringify(payload);
	const decoded = strToU8(json);
	if (decoded.length > SHARE_DECODED_LIMIT_BYTES) {
		return tooLargeEncode(decoded.length, 0);
	}
	const compressed = deflateSync(decoded);
	if (compressed.length > SHARE_COMPRESSED_LIMIT_BYTES) {
		return tooLargeEncode(decoded.length, compressed.length);
	}
	return {
		ok: true,
		hash: `${SHARE_HASH_PREFIX}v${SHARE_VERSION}:${bytesToBase64Url(compressed)}`,
		decodedBytes: decoded.length,
		compressedBytes: compressed.length,
	};
}

/**
 * Decode a `#s=v1:…` hash. Never throws. Returns a typed reason so the UI can
 * show a precise inline message; the recipient's stored scene is never touched.
 */
export function decodeShareHash(hash: string): ShareDecodeResult {
	if (!hash.startsWith(SHARE_HASH_PREFIX)) {
		return {
			ok: false,
			reason: "invalid",
			message: "This share link didn’t work.",
		};
	}
	const body = hash.slice(SHARE_HASH_PREFIX.length);
	const separator = body.indexOf(":");
	if (separator <= 0) {
		return {
			ok: false,
			reason: "invalid",
			message: "This share link didn’t work.",
		};
	}
	const versionTag = body.slice(0, separator);
	const versionMatch = /^v(\d+)$/.exec(versionTag);
	if (!versionMatch) {
		return {
			ok: false,
			reason: "invalid",
			message: "This share link didn’t work.",
		};
	}
	if (Number(versionMatch[1]) !== SHARE_VERSION) {
		return {
			ok: false,
			reason: "unsupported-version",
			message: "This share link is from a newer version of Pedalvision.",
		};
	}
	const encoded = body.slice(separator + 1);
	if (!encoded) {
		return {
			ok: false,
			reason: "invalid",
			message: "This share link didn’t work.",
		};
	}
	if (encoded.length > SHARE_BASE64_LIMIT_LENGTH) return tooLargeDecode();
	const compressed = base64UrlToBytes(encoded);
	if (!compressed) {
		return {
			ok: false,
			reason: "invalid",
			message: "This share link didn’t work.",
		};
	}
	if (compressed.length > SHARE_COMPRESSED_LIMIT_BYTES) return tooLargeDecode();

	// Stream the inflation and abort as soon as the decoded payload crosses the
	// cap. A plain `inflateSync({ out })` would bound memory but still decode the
	// whole stream, turning a malicious link into a blocking main-thread freeze
	// before first render. Throwing out of the chunk callback stops fflate.
	let inflated: Uint8Array;
	let tooLarge = false;
	try {
		const chunks: Uint8Array[] = [];
		let total = 0;
		const inflator = new Inflate((chunk) => {
			if (tooLarge) return;
			total += chunk.length;
			if (total > SHARE_DECODED_LIMIT_BYTES) {
				tooLarge = true;
				throw new RangeError("share-payload-too-large");
			}
			chunks.push(chunk.slice());
		});
		for (let index = 0; index < compressed.length; index += 8_192) {
			const end = Math.min(index + 8_192, compressed.length);
			inflator.push(compressed.subarray(index, end), end === compressed.length);
		}
		if (tooLarge) return tooLargeDecode();
		inflated = new Uint8Array(total);
		let offset = 0;
		for (const chunk of chunks) {
			inflated.set(chunk, offset);
			offset += chunk.length;
		}
	} catch {
		if (tooLarge) return tooLargeDecode();
		return {
			ok: false,
			reason: "corrupt",
			message: "This share link is damaged.",
		};
	}

	let raw: unknown;
	try {
		raw = JSON.parse(strFromU8(inflated));
	} catch {
		return {
			ok: false,
			reason: "corrupt",
			message: "This share link is damaged.",
		};
	}
	const parsed = payloadSchema.safeParse(raw);
	if (!parsed.success) {
		return {
			ok: false,
			reason: "invalid",
			message: "This share link didn’t contain a valid scene.",
		};
	}

	const boards = uniqueBy(parsed.data.boards, (board) => board.uid);
	const items = uniqueBy(parsed.data.items, (item) => item.uid);
	const customPedals = uniqueBy(
		parsed.data.customPedals,
		(custom) => custom.refId,
	);
	// Orphan items, dense z and unreferenced custom definitions: the same
	// normalization every stored document gets (sceneDocument.ts).
	const snapshot = normalizeSceneContent({ boards, items, customPedals });
	return {
		ok: true,
		name: normalizeShareName(parsed.data.name),
		snapshot,
		decodedBytes: inflated.length,
		compressedBytes: compressed.length,
	};
}
