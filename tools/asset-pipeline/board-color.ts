import sharp from "sharp";
import { isBackground, sampleBackgroundColor } from "./pixels.ts";

/**
 * Deterministic board-color sampler for generated board art.
 *
 * The real-first rule says generated boards must use the board color from the
 * reference image they were traced from. This samples the dominant opaque board
 * color (median + average) from a reference image. A transparent reference (like
 * a clean planner cutout) is supported: transparent corners mean "transparent
 * background", so alpha-0 pixels are skipped rather than treated as black.
 */

const CHANNELS = 4;

export type Rgb = { r: number; g: number; b: number };
export type ColorSample = Rgb & { hex: string };

export type BoardColorResult = {
	version: 1;
	input?: string;
	image: { width: number; height: number; hasAlpha: boolean };
	transparentBackground: boolean;
	background: Rgb & { alpha: number };
	samples: number;
	median: ColorSample;
	average: ColorSample;
};

export type BoardColorOptions = {
	/** Per-channel background tolerance (default 32). */
	tolerance?: number;
};

function hex({ r, g, b }: Rgb): string {
	return `#${[r, g, b]
		.map((value) => Math.max(0, Math.min(255, Math.round(value))))
		.map((value) => value.toString(16).padStart(2, "0"))
		.join("")}`;
}

function color(r: number, g: number, b: number): ColorSample {
	return { r, g, b, hex: hex({ r, g, b }) };
}

function luma({ r, g, b }: Rgb): number {
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export async function sampleBoardColor(
	input: Buffer | string,
	options: BoardColorOptions = {},
): Promise<BoardColorResult> {
	const tolerance = options.tolerance ?? 32;
	const metadata = await sharp(input).metadata();
	const { data, info } = await sharp(input)
		.rotate()
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });
	const pixels = new Uint8Array(data);
	const width = info.width;
	const height = info.height;

	const corners = [
		[0, 0],
		[width - 1, 0],
		[0, height - 1],
		[width - 1, height - 1],
	] as const;
	let cornerAlpha = 0;
	for (const [x, y] of corners) {
		cornerAlpha += pixels[(y * width + x) * CHANNELS + 3] ?? 0;
	}
	const background = sampleBackgroundColor(pixels, width, height);
	const transparentBackground = cornerAlpha / corners.length < 16;
	// A dark opaque corner is usually the board itself (board-only reference/crop
	// such as the clean planner cutout), not a background to subtract.
	const boardFillsFrame =
		!transparentBackground &&
		0.2126 * background.r + 0.7152 * background.g + 0.0722 * background.b < 48;

	const samples: Rgb[] = [];
	for (let i = 0; i < pixels.length; i += CHANNELS) {
		const alpha = pixels[i + 3] ?? 0;
		if (alpha < 200) continue;
		const r = pixels[i] ?? 0;
		const g = pixels[i + 1] ?? 0;
		const b = pixels[i + 2] ?? 0;
		if (
			!transparentBackground &&
			!boardFillsFrame &&
			isBackground(r, g, b, background, tolerance)
		) {
			continue;
		}
		samples.push({ r, g, b });
	}

	if (samples.length === 0) {
		throw new Error("no opaque board-colored pixels found in the reference");
	}

	const sorted = [...samples].sort((a, b) => luma(a) - luma(b));
	const median = sorted[Math.floor(sorted.length / 2)] ?? { r: 0, g: 0, b: 0 };
	const sum = samples.reduce(
		(acc, sample) => ({
			r: acc.r + sample.r,
			g: acc.g + sample.g,
			b: acc.b + sample.b,
		}),
		{ r: 0, g: 0, b: 0 },
	);

	return {
		version: 1,
		image: { width, height, hasAlpha: metadata.hasAlpha ?? false },
		transparentBackground,
		background: {
			...background,
			alpha: Math.round(cornerAlpha / corners.length),
		},
		samples: samples.length,
		median: color(median.r, median.g, median.b),
		average: color(
			sum.r / samples.length,
			sum.g / samples.length,
			sum.b / samples.length,
		),
	};
}
