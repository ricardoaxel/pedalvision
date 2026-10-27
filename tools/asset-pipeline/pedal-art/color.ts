/**
 * Deterministic colour helpers for generated pedal art.
 *
 * The art palette is a toolchain constant (see `docs/catalog/pedal-art.md`):
 * body colours are sampled from an official/authorized reference and clamped in
 * OKLCh so one pedal cannot import a neon fill; hardware, ink and the cutline
 * use the fixed "Catalog Specimen" palette. This module is pure and unit-tested
 * so the renderer never depends on a color library.
 */

export type Rgb = { r: number; g: number; b: number };
export type Oklch = { l: number; c: number; h: number };

export const ART_PALETTE = {
	cutline: "#78828C",
	printLight: "#EEF1F4",
	printDark: "#16191D",
	metalHi: "#C7CDD3",
	metal: "#9AA3AC",
	metalLo: "#6E7781",
	hardwareInk: "#3A4048",
	display: "#23282D",
	displayBorder: "#4A5158",
	ledHousing: "#2B3036",
} as const;

/** Body fills keep their sampled hue/lightness but may not exceed this chroma. */
export const BODY_MAX_CHROMA = 0.18;
/** Printed bands/legends may not exceed this chroma. */
export const PRINT_MAX_CHROMA = 0.14;

const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/;

export function isHex(value: string): boolean {
	return HEX_PATTERN.test(value);
}

export function parseHex(hex: string): Rgb {
	if (!HEX_PATTERN.test(hex)) {
		throw new Error(`"${hex}" is not a #RRGGBB colour`);
	}
	return {
		r: Number.parseInt(hex.slice(1, 3), 16),
		g: Number.parseInt(hex.slice(3, 5), 16),
		b: Number.parseInt(hex.slice(5, 7), 16),
	};
}

function channel(value: number): number {
	return Math.max(0, Math.min(255, Math.round(value)));
}

export function rgbToHex(rgb: Rgb): string {
	return `#${[rgb.r, rgb.g, rgb.b]
		.map((value) => channel(value).toString(16).padStart(2, "0"))
		.join("")
		.toUpperCase()}`;
}

function srgbToLinear(value: number): number {
	const c = value / 255;
	return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(value: number): number {
	const c =
		value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055;
	return c * 255;
}

export function relativeLuminance(hex: string): number {
	const { r, g, b } = parseHex(hex);
	return (
		0.2126 * srgbToLinear(r) +
		0.7152 * srgbToLinear(g) +
		0.0722 * srgbToLinear(b)
	);
}

/** WCAG 2 contrast ratio (1–21). */
export function contrastRatio(a: string, b: string): number {
	const first = relativeLuminance(a);
	const second = relativeLuminance(b);
	const lighter = Math.max(first, second);
	const darker = Math.min(first, second);
	return (lighter + 0.05) / (darker + 0.05);
}

export function hexToOklch(hex: string): Oklch {
	const { r, g, b } = parseHex(hex);
	const lr = srgbToLinear(r);
	const lg = srgbToLinear(g);
	const lb = srgbToLinear(b);

	const l = Math.cbrt(
		0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb,
	);
	const m = Math.cbrt(
		0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb,
	);
	const s = Math.cbrt(
		0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb,
	);

	const okL = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
	const okA = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
	const okB = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;

	const c = Math.hypot(okA, okB);
	const h = (Math.atan2(okB, okA) * 180) / Math.PI;
	return { l: okL, c, h: h < 0 ? h + 360 : h };
}

export function oklchToHex({ l, c, h }: Oklch): string {
	const radians = (h * Math.PI) / 180;
	const okA = c * Math.cos(radians);
	const okB = c * Math.sin(radians);

	const l1 = l + 0.3963377774 * okA + 0.2158037573 * okB;
	const m1 = l - 0.1055613458 * okA - 0.0638541728 * okB;
	const s1 = l - 0.0894841775 * okA - 1.291485548 * okB;

	const l3 = l1 ** 3;
	const m3 = m1 ** 3;
	const s3 = s1 ** 3;

	const r = 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
	const g = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
	const b = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3;

	return rgbToHex({
		r: linearToSrgb(Math.max(0, Math.min(1, r))),
		g: linearToSrgb(Math.max(0, Math.min(1, g))),
		b: linearToSrgb(Math.max(0, Math.min(1, b))),
	});
}

/** Preserve sampled L/H, cap chroma. Idempotent; the shipped body fill. */
export function clampChroma(hex: string, maxChroma: number): string {
	const color = hexToOklch(hex);
	if (color.c <= maxChroma) return hex.toUpperCase();
	// sRGB gamut clipping can nudge the round-trip chroma slightly above the
	// cap; step down until the encoded fill really respects it.
	let chroma = maxChroma;
	for (let attempt = 0; attempt < 24 && chroma > 0; attempt++) {
		const candidate = oklchToHex({ ...color, c: chroma });
		if (hexToOklch(candidate).c <= maxChroma) return candidate;
		chroma -= 0.001;
	}
	return oklchToHex({ ...color, c: 0 });
}

/** Multiply every sRGB channel (0–255) by `factor`, clamped. */
export function shade(hex: string, factor: number): string {
	const { r, g, b } = parseHex(hex);
	return rgbToHex({ r: r * factor, g: g * factor, b: b * factor });
}

/**
 * Pick the higher-contrast house ink. `meets` is false when even the better ink
 * cannot reach 4.5:1 — the renderer then omits control legends. Brand/model
 * text may use the WCAG large-text 3:1 floor (`largeMeets`).
 */
export function pickInk(
	body: string,
	light: string = ART_PALETTE.printLight,
	dark: string = ART_PALETTE.printDark,
): { hex: string; contrast: number; meets: boolean; largeMeets: boolean } {
	const lightContrast = contrastRatio(body, light);
	const darkContrast = contrastRatio(body, dark);
	const chosen =
		lightContrast >= darkContrast
			? { hex: light, contrast: lightContrast }
			: { hex: dark, contrast: darkContrast };
	return {
		...chosen,
		meets: chosen.contrast >= 4.5,
		largeMeets: chosen.contrast >= 3,
	};
}
