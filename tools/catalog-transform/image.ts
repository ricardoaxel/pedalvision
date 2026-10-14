import sharp from "sharp";
import { GLYPH_ROWS, labelPathData, labelWidthUnits } from "./font.ts";
import { hashString } from "./hash.ts";

/**
 * Procedural ("mocked") placeholder art for the catalog seed: a rounded
 * rectangle with a short label, rasterized from an inline SVG with sharp.
 * Shapes only — no `<text>` — so the output is byte-reproducible on any machine.
 *
 * This is intentionally a dev-only stopgap; it must not grow into a second
 * asset pipeline (P2-04 owns real image processing).
 */

export type RenditionSize = 350 | 800;

export type RenderInput = {
	id: string;
	label: string;
	widthCm: number;
	heightCm: number;
	size: RenditionSize;
};

/** Muted palette so placeholders never compete with the Blueprint chrome. */
const PALETTE = [
	{ fill: "#3b4250", stroke: "#616b7c" },
	{ fill: "#46505e", stroke: "#6b7688" },
	{ fill: "#3f4a45", stroke: "#5f7068" },
	{ fill: "#4a4440", stroke: "#6f665f" },
	{ fill: "#44485a", stroke: "#656b82" },
	{ fill: "#3d4652", stroke: "#5c6874" },
] as const;

const LABEL_COLOR = "#e6ebf2";

export function paletteFor(id: string): { fill: string; stroke: string } {
	return PALETTE[hashString(id) % PALETTE.length];
}

/** Pixel dimensions of a rendition: long edge = `size`, aspect from the footprint. */
export function renditionPixels(
	widthCm: number,
	heightCm: number,
	size: RenditionSize,
): { width: number; height: number } {
	const scale = size / Math.max(widthCm, heightCm);
	return {
		width: Math.max(1, Math.round(widthCm * scale)),
		height: Math.max(1, Math.round(heightCm * scale)),
	};
}

/** Build the placeholder SVG for one rendition. */
export function buildSvg(input: RenderInput): string {
	const { width, height } = renditionPixels(
		input.widthCm,
		input.heightCm,
		input.size,
	);
	const pad = Math.max(1, Math.round(Math.min(width, height) * 0.08));
	const radius = Math.max(2, Math.round(Math.min(width, height) * 0.09));
	const strokeWidth = Math.max(1, Math.round(Math.min(width, height) * 0.012));
	const { fill, stroke } = paletteFor(input.id);

	const innerPad = pad * 2;
	const availableWidth = width - innerPad * 2;
	const availableHeight = height - innerPad * 2;
	const units = Math.max(1, labelWidthUnits(input.label));
	const cell = Math.max(
		1,
		Math.min(
			Math.floor(availableWidth / units),
			Math.floor((availableHeight * 0.5) / GLYPH_ROWS),
		),
	);
	const labelWidth = units * cell;
	const labelHeight = GLYPH_ROWS * cell;
	const labelX = Math.round((width - labelWidth) / 2);
	const labelY = Math.round((height - labelHeight) / 2);

	const path = labelPathData(input.label, labelX, labelY, cell);

	return [
		`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
		`<rect x="${pad}" y="${pad}" width="${width - pad * 2}" height="${height - pad * 2}" rx="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`,
		`<path d="${path}" fill="${LABEL_COLOR}"/>`,
		"</svg>",
	].join("");
}

/** Rasterize the placeholder to a PNG buffer. Deterministic for identical input. */
export async function renderPng(input: RenderInput): Promise<Buffer> {
	return sharp(Buffer.from(buildSvg(input)))
		.png({ compressionLevel: 9 })
		.toBuffer();
}
