export type AssetKind = "pedal" | "board";
export type AssetSize = 800 | 350;

/**
 * How a catalog image is provided (mirrors `imageSource` in the catalog schema
 * — see design.md §Assets → image-resolution contract).
 */
export type ImageSource = "mock" | "static" | "url";

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
