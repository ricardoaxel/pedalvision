import { join } from "node:path";
import { IMAGE_PATTERN } from "../../src/catalog/schema.ts";
import { toSlug } from "../catalog-transform/slug.ts";

/**
 * Pure naming/geometry for the asset pipeline — no filesystem, no sharp. Kept
 * separate so the output contract (slug filenames, rendition sizes, paths) is
 * unit-testable without touching an image.
 */

/** The two committed renditions: 800 = master, 350 = thumb (ADR-002). */
export const RENDITIONS = [800, 350] as const;
export type RenditionSize = (typeof RENDITIONS)[number];

export type AssetKind = "pedal" | "board";

/** The app folder a kind ships under (design.md §Assets & catalog). */
export function kindDir(kind: AssetKind): "pedals" | "boards" {
	return kind === "board" ? "boards" : "pedals";
}

/** Stable catalog id for a brand + display name (same slug rule as the catalog). */
export function slugId(brand: string, name: string): string {
	return toSlug(`${brand.trim()} ${name.trim()}`);
}

/**
 * The committed `<id>.png` filename. Asserts `IMAGE_PATTERN` so an unsafe id can
 * never reach `assetUrl()` (which does not URL-encode) or the filesystem.
 */
export function imageFilename(id: string): string {
	const filename = `${id}.png`;
	if (!IMAGE_PATTERN.test(filename)) {
		throw new Error(
			`id "${id}" does not form a safe image filename (expected ${IMAGE_PATTERN})`,
		);
	}
	return filename;
}

/**
 * Scale so the **long edge** equals `size`, preserving aspect ratio (never pads —
 * the renderer stretches the cutout to the item's true cm footprint). Every
 * dimension is at least 1px.
 */
export function fitToLongEdge(
	width: number,
	height: number,
	size: RenditionSize,
): { width: number; height: number } {
	if (width <= 0 || height <= 0) {
		throw new Error(`invalid image size ${width}x${height}`);
	}
	const scale = size / Math.max(width, height);
	return {
		width: Math.max(1, Math.round(width * scale)),
		height: Math.max(1, Math.round(height * scale)),
	};
}

/** Absolute-ish output path for one rendition: `<assetsDir>/<kindDir>/<size>/<file>`. */
export function outputPath(
	assetsDir: string,
	kind: AssetKind,
	size: RenditionSize,
	file: string,
): string {
	return join(assetsDir, kindDir(kind), String(size), file);
}
