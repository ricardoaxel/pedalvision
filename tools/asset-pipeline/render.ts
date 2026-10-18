import sharp from "sharp";
import { fitToLongEdge, RENDITIONS, type RenditionSize } from "./naming.ts";
import {
	removeBackground,
	sampleBackgroundColor,
	trimBounds,
} from "./pixels.ts";

/**
 * Image processing for the asset pipeline: background → transparent, trim, then
 * resize to the two committed renditions. Works on **buffers only** (no paths, no
 * filesystem) so the CLI owns all IO and the transform stays easy to test.
 *
 * Deterministic: the same input + options always yield byte-identical PNGs.
 */

/** Per-channel background tolerance (0–255). The seeded image is a top-down
 * cutout on a neutral background, so a modest default keeps it forgiving. */
export const DEFAULT_TOLERANCE = 32;

export type RenderOptions = { tolerance?: number };

/** The two encoded PNG renditions keyed by long-edge size. */
export type Renditions = Record<RenditionSize, Buffer>;

export async function renderRenditions(
	input: Buffer,
	options: RenderOptions = {},
): Promise<Renditions> {
	const tolerance = options.tolerance ?? DEFAULT_TOLERANCE;

	// Normalise to raw RGBA so the pure pixel helpers can operate on it.
	const { data, info } = await sharp(input)
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });
	const width = info.width;
	const height = info.height;

	const background = sampleBackgroundColor(data, width, height);
	removeBackground(data, width, height, background, tolerance);

	// Nothing survived the knockout? Keep the full frame rather than fail.
	const bounds = trimBounds(data, width, height) ?? {
		left: 0,
		top: 0,
		width,
		height,
	};

	// Extract the trimmed cutout once, then downscale it per rendition.
	const cutout = await sharp(data, {
		raw: { width, height, channels: 4 },
	})
		.extract(bounds)
		.png()
		.toBuffer();

	const renditions = {} as Renditions;
	for (const size of RENDITIONS) {
		const target = fitToLongEdge(bounds.width, bounds.height, size);
		renditions[size] = await sharp(cutout)
			.resize(target.width, target.height, { fit: "fill" })
			.png({ compressionLevel: 9 })
			.toBuffer();
	}
	return renditions;
}
