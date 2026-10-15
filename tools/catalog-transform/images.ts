import type { ImageSource, SourceRef } from "../../src/catalog/schema.ts";

/**
 * Image resolution (ADR-003 amendment, 2026-10-15): where an item has a
 * **direct-file** official image URL recorded in its `sources` (kind `image`),
 * render that URL directly (`imageSource: "url"`, `image` = the URL) instead of
 * the procedural mock. Items without one keep the mock (`<id>.png`). No image is
 * downloaded — only the recorded URL is reused.
 *
 * CORS is a render-time concern, not something we can know here: the canvas
 * loads `url` images with `crossOrigin="anonymous"`, so CORS-clean hosts display
 * (and keep the canvas untainted for export) while others fall back to the
 * labeled rectangle (design.md §Assets → image-resolution contract).
 */

/** A URL that points at an image *file* (not an HTML product page). */
const DIRECT_IMAGE_FILE = /\.(jpe?g|png|webp|gif|avif)(?:\?.*)?$/i;

/** The first direct-file `image`-kind source URL, or null. */
export function pickDirectImageUrl(sources?: SourceRef[]): string | null {
	if (!sources) return null;
	for (const ref of sources) {
		if (ref.kind.includes("image") && DIRECT_IMAGE_FILE.test(ref.url)) {
			return ref.url;
		}
	}
	return null;
}

interface ImageResolvable {
	sources?: SourceRef[];
	image: string;
	imageSource: ImageSource;
}

/**
 * Set `image`/`imageSource` from each item's `sources` in place: `url` when a
 * direct image URL exists, else unchanged (mock). Deterministic and idempotent.
 * Returns how many items changed.
 */
export function resolveImages(items: ImageResolvable[]): number {
	let changed = 0;
	for (const item of items) {
		const url = pickDirectImageUrl(item.sources);
		if (!url) continue;
		if (item.imageSource === "url" && item.image === url) continue;
		item.image = url;
		item.imageSource = "url";
		changed++;
	}
	return changed;
}
