import type { ImageSource } from "../catalog/schema";

export type AssetKind = "pedal" | "board";
export type AssetSize = 800 | 350;

/**
 * Single source of truth for **which rendition each surface uses**. Never
 * hardcode 800/350 at a call site — import this map instead, so the 350 thumb
 * is actually used and a future canvas rendition (e.g. 512) has one home.
 *
 * - `pickerRow` / `infoSleeve`: the 350 thumbnail (ledger rows, mobile sleeve).
 * - `specimen` / `canvas` / `export`: the 800 master (the specimen plate, the
 *   info-panel banner, the canvas and export; a 512 canvas LOD can be added
 *   here later).
 */
export const ASSET_RENDITIONS = {
	pickerRow: 350,
	infoSleeve: 350,
	specimen: 800,
	canvas: 800,
	export: 800,
} as const satisfies Record<string, AssetSize>;

/** The small-UI surfaces that use the 350 rendition. */
export type ThumbSurface = "pickerRow" | "infoSleeve";

const ASSET_BASE = "/pedal-assets";

const KIND_DIR: Record<AssetKind, string> = {
	pedal: "pedals",
	board: "boards",
};

/**
 * Single source of truth for v1 asset URLs. Images ship with the app
 * (same-origin, no CORS) — see docs/decisions/002-hosting-and-assets.md.
 *
 * assetUrl("pedal", 350, "boss-tr-2.png")
 *   → "/pedal-assets/pedals/350/boss-tr-2.png"
 */
export function assetUrl(
	kind: AssetKind,
	size: AssetSize,
	file: string,
): string {
	return `${ASSET_BASE}/${KIND_DIR[kind]}/${size}/${file}`;
}

/**
 * The image-resolution contract (design.md §Assets): how a catalog item's
 * `image` field turns into a loadable URL.
 *
 *   mock | static → assetUrl(kind, size, image)  (a committed same-origin file)
 *   url           → image                        (an absolute, CORS-clean URL)
 *
 * A failed/missing image is the renderer's concern — it falls back to a labeled
 * rectangle at the item's cm footprint (P1-03/P1-04).
 */
export function resolveImageUrl(
	imageSource: ImageSource,
	image: string,
	kind: AssetKind,
	size: AssetSize,
): string {
	return imageSource === "url" ? image : assetUrl(kind, size, image);
}

/**
 * The `350` rendition for small UI (picker ledger rows, mobile info-panel
 * sleeve). A `url` source has no derived rendition, so it is returned
 * unchanged.
 */
export function resolveThumbImageUrl(
	imageSource: ImageSource,
	image: string,
	kind: AssetKind,
	surface: ThumbSurface = "pickerRow",
): string {
	return resolveImageUrl(imageSource, image, kind, ASSET_RENDITIONS[surface]);
}

/**
 * The `800` master for large UI (specimen plate, info-panel banner, canvas and
 * export). A `url` source is returned unchanged.
 */
export function resolveMasterImageUrl(
	imageSource: ImageSource,
	image: string,
	kind: AssetKind,
): string {
	return resolveImageUrl(imageSource, image, kind, ASSET_RENDITIONS.specimen);
}

/**
 * The stable cache-busting key used by {@link bustCache}. Constant (not random)
 * so the busted URL caches normally once it has been fetched.
 */
export const CACHE_BUST_QUERY = "pedalvision-v=1";

/**
 * Return a variant of `url` under a **distinct** cache key, used to self-heal a
 * poisoned HTTP cache entry.
 *
 * Background: a plain no-CORS load of a hotlinked image (e.g. the picker's
 * `<img>`) caches a response with no `Access-Control-Allow-Origin`; a later
 * `crossOrigin="anonymous"` request (the canvas loader) reuses that cached copy
 * and fails the CORS check — for hosts that only send ACAO when the request
 * carries an `Origin`. A different URL is a different cache key, so the retry
 * fetches a fresh, CORS-clean response.
 *
 * Only absolute `http(s)` URLs are busted; same-origin asset paths are returned
 * unchanged (their cache can't be poisoned this way).
 */
export function bustCache(url: string): string {
	if (!/^https?:\/\//i.test(url)) return url;
	// Insert before any fragment so the query isn't parked inside `#…`.
	const hashIndex = url.indexOf("#");
	const base = hashIndex === -1 ? url : url.slice(0, hashIndex);
	const hash = hashIndex === -1 ? "" : url.slice(hashIndex);
	const separator = base.includes("?") ? "&" : "?";
	return `${base}${separator}${CACHE_BUST_QUERY}${hash}`;
}
