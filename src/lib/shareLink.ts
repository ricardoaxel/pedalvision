import { deflateSync, Inflate, strFromU8, strToU8 } from "fflate";
import { z } from "zod";
import { EFFECT_TYPES, JACK_EDGES, JACK_KINDS } from "../catalog/schema";
import type {
	Cable,
	CustomPedal,
	Endpoint,
	PlacedBoard,
	PlacedItem,
} from "../state/scene";
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
 * Format: `#s=v2:<base64url(deflate(JSON))>`. The payload is self-contained:
 * boards, placed items, inline custom pedals, endpoints and cables travel
 * together, so a shared scene renders identically on any device even after the
 * catalog changes (A5). Decoding still accepts legacy `v1` links (no graph).
 * Unknown refIds are deliberately accepted — `resolveItem` renders a labeled
 * fallback at the stored footprint rather than failing the scene.
 *
 * Untrusted input is validated with zod **before** it reaches the store. The
 * decoded JSON is capped at ~200 KB and the compressed input is capped; the
 * inflation is streamed and aborted as soon as the output crosses the cap, so a
 * link bomb can't allocate memory proportional to its expansion ratio or block
 * the main thread for the whole stream. The capacity hard caps are NOT applied
 * on load: an over-cap shared scene still opens (read-only, warned; A4/A5).
 */

export const SHARE_HASH_PREFIX = "#s=";
export const SHARE_VERSION = 2;
export const SHARE_DECODED_LIMIT_BYTES = 200 * 1024;
/**
 * Delivery limit (owner-facing): a URL that is too long is silently truncated
 * by chat apps / mobile address bars long before a browser's parser gives up.
 * Chrome displays ~32 KB, Android ~8 KB, Safari ~80 KB practical. We cap the
 * whole hash at 32 KB (the sender gets an inline refusal) and warn at 4 KB.
 * The compressed limit is derived from this so the two can never drift.
 */
export const SHARE_URL_SOFT_LIMIT_CHARS = 4_000;
export const SHARE_URL_HARD_LIMIT_CHARS = 32_000;
export const SHARE_BASE64_LIMIT_LENGTH =
	SHARE_URL_HARD_LIMIT_CHARS - SHARE_HASH_PREFIX.length - "v1:".length;
export const SHARE_COMPRESSED_LIMIT_BYTES = Math.floor(
	(SHARE_BASE64_LIMIT_LENGTH * 3) / 4,
);
/** Matches the scene-name cap used by the library (`SCENE_NAME_MAX_LENGTH`). */
export const SHARE_NAME_MAX_LENGTH = 48;

/** Soft "large but valid" hint in the Share panel. */
export const SHARE_LONG_LINK_THRESHOLD = SHARE_URL_SOFT_LIMIT_CHARS;

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
	/** The full `#s=v2:…` length that would have been produced. */
	hashLength: number;
	limitChars: number;
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
	version: 2;
	name: string;
	boards: PlacedBoard[];
	items: PlacedItem[];
	customPedals: CustomPedal[];
	endpoints: Endpoint[];
	cables: Cable[];
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
	stereo: z.boolean().optional(),
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

const endpointSchema = z.object({
	uid: boundedString(128),
	kind: z.enum(["amp", "instrument"]),
	x: coordinate,
	y: coordinate,
});

const cableEndSchema = z.union([
	z.object({
		itemUid: boundedString(128),
		jack: z.string().regex(/^(0|[1-9]\d*)$/),
	}),
	z.object({ endpointUid: boundedString(128) }),
]);

const cableSchema = z.object({
	uid: boundedString(128),
	from: cableEndSchema,
	to: cableEndSchema,
	color: optionalString(40),
});

const legacyPayloadSchema = z.object({
	version: z.literal(1),
	name: optionalString(200),
	boards: z.array(boardSchema).max(5_000),
	items: z.array(itemSchema).max(5_000),
	customPedals: z.array(customPedalSchema).max(5_000),
});

const currentPayloadSchema = z.object({
	version: z.literal(2),
	name: optionalString(200),
	boards: z.array(boardSchema).max(5_000),
	items: z.array(itemSchema).max(5_000),
	customPedals: z.array(customPedalSchema).max(5_000),
	endpoints: z.array(endpointSchema).max(5_000),
	cables: z.array(cableSchema).max(5_000),
});

const payloadSchema = z.discriminatedUnion("version", [
	legacyPayloadSchema,
	currentPayloadSchema,
]);

function tooLargeEncode(
	decodedBytes: number,
	compressedBytes: number,
	hashLength = 0,
	counts?: { parts: number; graph: number },
): ShareEncodeTooLarge {
	const overPayload = decodedBytes > SHARE_DECODED_LIMIT_BYTES;
	const graphNote = counts
		? ` (${counts.parts} parts + ${counts.graph} cables/endpoints)`
		: "";
	return {
		ok: false,
		reason: "too-large",
		decodedBytes,
		compressedBytes,
		limitBytes: SHARE_DECODED_LIMIT_BYTES,
		hashLength,
		limitChars: SHARE_URL_HARD_LIMIT_CHARS,
		message: overPayload
			? `This scene is too large to share (${formatKb(decodedBytes)} of the ${formatKb(SHARE_DECODED_LIMIT_BYTES)} limit). Remove custom parts or split it into two scenes.`
			: `This scene’s link would be too long to share reliably (${hashLength.toLocaleString("en-US")} of ${SHARE_URL_HARD_LIMIT_CHARS.toLocaleString("en-US")} characters${graphNote}). Remove parts or split it into two scenes.`,
	};
}

function tooLargeDecode(
	message = "This share link is too big to open. It is over the 200 KB share limit.",
): ShareError {
	return {
		ok: false,
		reason: "too-large",
		message,
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
	// v2 (owner decision 2026-10-21): cables/endpoints travel in the payload.
	// Old v1 clients reject a v2 link cleanly instead of silently dropping them.
	const payload: SharePayload = {
		version: SHARE_VERSION,
		name: normalizeShareName(name),
		boards: snapshot.boards,
		items: snapshot.items,
		customPedals: snapshot.customPedals,
		endpoints: snapshot.endpoints,
		cables: snapshot.cables,
	};
	const json = JSON.stringify(payload);
	const decoded = strToU8(json);
	if (decoded.length > SHARE_DECODED_LIMIT_BYTES) {
		return tooLargeEncode(decoded.length, 0);
	}
	const compressed = deflateSync(decoded);
	const hash = `${SHARE_HASH_PREFIX}v${SHARE_VERSION}:${bytesToBase64Url(compressed)}`;
	// The URL is the delivery mechanism: cap the whole hash (not just the
	// compressed bytes) so chat apps / mobile address bars can't truncate it.
	if (
		hash.length > SHARE_URL_HARD_LIMIT_CHARS ||
		compressed.length > SHARE_COMPRESSED_LIMIT_BYTES
	) {
		return tooLargeEncode(decoded.length, compressed.length, hash.length, {
			parts: snapshot.items.length,
			graph: snapshot.cables.length + snapshot.endpoints.length,
		});
	}
	return {
		ok: true,
		hash,
		decodedBytes: decoded.length,
		compressedBytes: compressed.length,
	};
}

/**
 * Decode a `#s=v1:…` / `#s=v2:…` hash. Never throws. Returns a typed reason so the UI can
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
	const version = Number(versionMatch[1]);
	// Decode the current version and the legacy graph-less v1. Anything else
	// (older/newer) is rejected with a precise reason — never silently dropped.
	if (version !== 1 && version !== SHARE_VERSION) {
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
	if (
		hash.length > SHARE_URL_HARD_LIMIT_CHARS ||
		encoded.length > SHARE_BASE64_LIMIT_LENGTH
	) {
		return tooLargeDecode(
			`This share link is too long to open reliably (over ${SHARE_URL_HARD_LIMIT_CHARS.toLocaleString("en-US")} characters).`,
		);
	}
	const compressed = base64UrlToBytes(encoded);
	if (!compressed) {
		return {
			ok: false,
			reason: "invalid",
			message: "This share link didn’t work.",
		};
	}
	if (compressed.length > SHARE_COMPRESSED_LIMIT_BYTES) {
		return tooLargeDecode(
			`This share link is too long to open reliably (over ${SHARE_URL_HARD_LIMIT_CHARS.toLocaleString("en-US")} characters).`,
		);
	}

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
	// v1 is graph-less by construction; v2 carries both arrays. Read them off the
	// discriminated union so the legacy path can't accidentally read undefined.
	const endpoints =
		parsed.data.version === 2
			? uniqueBy(parsed.data.endpoints, (e) => e.uid)
			: [];
	const cables =
		parsed.data.version === 2 ? uniqueBy(parsed.data.cables, (c) => c.uid) : [];
	// Orphan items, dense z, unreferenced custom definitions and dead cable
	// references get the same normalization every stored document gets.
	const snapshot = normalizeSceneContent({
		boards,
		items,
		customPedals,
		endpoints,
		cables,
	});
	return {
		ok: true,
		name: normalizeShareName(parsed.data.name),
		snapshot,
		decodedBytes: inflated.length,
		compressedBytes: compressed.length,
	};
}
