export type AssetKind = "pedal" | "board";
export type AssetSize = 800 | 350;

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
