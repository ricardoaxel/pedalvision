import { readFileSync } from "node:fs";

/**
 * Deterministic text outlines for generated pedal art.
 *
 * SVG text is rendered by the OS font stack inside `sharp`/librsvg, which is not
 * portable (macOS uses CoreText and ignores a bundled font). Instead the
 * renderer composes text from pre-extracted glyph outlines (IBM Plex Sans,
 * OFL — see `fonts/`). The font never ships to the app; the AVIF contains only
 * filled paths.
 */

export type Glyph = {
	advance: number;
	path: string;
	bbox?: [number, number, number, number];
};

export type GlyphFont = {
	family: string;
	weight: "medium" | "semibold";
	upm: number;
	ascent: number;
	descent: number;
	glyphs: Record<string, Glyph>;
};

function loadFont(file: string): GlyphFont {
	const parsed = JSON.parse(
		readFileSync(new URL(`./fonts/${file}`, import.meta.url), "utf8"),
	) as GlyphFont;
	if (
		typeof parsed.upm !== "number" ||
		typeof parsed.glyphs !== "object" ||
		parsed.glyphs === null
	) {
		throw new Error(`fonts/${file}: invalid glyph atlas`);
	}
	return parsed;
}

const FONTS: Record<"medium" | "semibold", GlyphFont> = {
	medium: loadFont("plex-medium.json"),
	semibold: loadFont("plex-semibold.json"),
};

export function glyphFont(weight: "medium" | "semibold"): GlyphFont {
	return FONTS[weight];
}

export type TextRunGlyph = { xPx: number; path: string };

export type TextRun = {
	widthPx: number;
	/** Outline bounds in font units (y-up). Renderer builds the baseline. */
	minY: number;
	maxY: number;
	glyphs: TextRunGlyph[];
};

export function applyCase(
	value: string,
	mode: "upper" | "title" | "as-is",
): string {
	if (mode === "upper") return value.toUpperCase();
	if (mode === "as-is") return value;
	return value
		.toLowerCase()
		.replace(/(^|[\s/().-])([a-z0-9])/g, (_, prefix, letter) => {
			return `${prefix}${letter.toUpperCase()}`;
		});
}

/**
 * Lay out one line at `sizePx`, centred later by the caller. `trackingEm` adds
 * space between glyphs only (never after the last). The caller applies
 * `translate(x, baseline) scale(scale, -scale)` to each path.
 */
export function layoutText(
	font: GlyphFont,
	value: string,
	sizePx: number,
	trackingEm: number,
): TextRun {
	const scale = sizePx / font.upm;
	const trackingPx = trackingEm * sizePx;
	const glyphs: TextRunGlyph[] = [];
	let x = 0;
	let minY = Number.POSITIVE_INFINITY;
	let maxY = Number.NEGATIVE_INFINITY;

	for (const [index, character] of [...value].entries()) {
		const glyph = font.glyphs[character];
		if (!glyph) {
			throw new Error(
				`glyph "${character}" is not in the bundled ${font.family} atlas`,
			);
		}
		if (glyph.path) glyphs.push({ xPx: x, path: glyph.path });
		if (glyph.bbox) {
			minY = Math.min(minY, glyph.bbox[1]);
			maxY = Math.max(maxY, glyph.bbox[3]);
		}
		x += glyph.advance * scale;
		if (index < [...value].length - 1) x += trackingPx;
	}

	if (!Number.isFinite(minY) || !Number.isFinite(maxY)) {
		minY = -font.descent;
		maxY = font.ascent;
	}

	return { widthPx: x, minY, maxY, glyphs };
}

/** Height of a laid-out line at the render scale. */
export function textHeightPx(
	font: GlyphFont,
	run: TextRun,
	sizePx: number,
): number {
	return ((run.maxY - run.minY) / font.upm) * sizePx;
}
