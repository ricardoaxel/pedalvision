import sharp from "sharp";
import {
	fitToLongEdge,
	type ImageFormat,
	RENDITIONS,
	type RenditionSize,
} from "./naming.ts";
import {
	removeBackground,
	removeBackgroundSoft,
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

export type RenderOptions = {
	tolerance?: number;
	/** `flood` is the default hard key; `soft` is the gradient fallback. */
	matte?: "flood" | "soft";
	/** Delivery format; P5 hosted assets use `avif`, PNG is the fallback. */
	format?: ImageFormat;
};

/** The two encoded renditions (PNG or AVIF) keyed by long-edge size. */
export type Renditions = Record<RenditionSize, Buffer>;

export async function renderRenditions(
	input: Buffer,
	options: RenderOptions = {},
): Promise<Renditions> {
	const tolerance = options.tolerance ?? DEFAULT_TOLERANCE;

	// Auto-orient from EXIF first: phone/camera photos commonly carry an
	// orientation tag, and the raw→PNG path below drops metadata, so a missed
	// rotation would bake a sideways asset into the catalog.
	const { data, info } = await sharp(input)
		.rotate()
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });
	const width = info.width;
	const height = info.height;

	const background = sampleBackgroundColor(data, width, height);
	if (options.matte === "soft") {
		removeBackgroundSoft(data, width, height, background, tolerance);
	} else {
		removeBackground(data, width, height, background, tolerance);
	}

	// If the key matched the whole frame there is nothing to ship — fail loudly
	// rather than write an invisible asset the catalog would treat as real.
	const bounds = trimBounds(data, width, height);
	if (!bounds) {
		throw new Error(
			"background removal left no visible pixels — the corner key matched the " +
				"subject; retry with a lower --tolerance or a different source image",
		);
	}

	// Extract the trimmed cutout once, then downscale it per rendition.
	const cutout = await sharp(data, {
		raw: { width, height, channels: 4 },
	})
		.extract(bounds)
		.png()
		.toBuffer();

	const format = options.format ?? "png";
	const renditions = {} as Renditions;
	for (const size of RENDITIONS) {
		const target = fitToLongEdge(bounds.width, bounds.height, size);
		const resized = sharp(cutout).resize(target.width, target.height, {
			fit: "fill",
		});
		renditions[size] =
			format === "avif"
				? await resized.avif({ quality: 80, effort: 6 }).toBuffer()
				: await resized.png({ compressionLevel: 9 }).toBuffer();
	}
	return renditions;
}
