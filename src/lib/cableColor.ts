import {
	CABLE_INK,
	type CableInkId,
	canvasTheme,
	lightCanvasTheme,
} from "../styles/theme";

/**
 * The fixed cable palette (Q-05 "Patch Ink"). One table read by the action-bar
 * UI and its tests; the canvas uses the stored hex directly. The fixed values
 * are theme-invariant because `Cable.color` is persisted as a hex string and the
 * PDF always prints on white paper — see `theme.ts` / `tokens.css`.
 *
 * A stored hex outside this table is a **custom ink** (owner revision
 * 2026-11-05), picked with the native color input; it is persisted the same way.
 */
export interface CableInkOption {
	id: CableInkId;
	label: string;
	/** The stored `Cable.color` value. */
	value: string;
}

export const CABLE_INK_OPTIONS: readonly CableInkOption[] = [
	{ id: "red", label: "Red", value: CABLE_INK.red },
	{ id: "orange", label: "Orange", value: CABLE_INK.orange },
	{ id: "green", label: "Green", value: CABLE_INK.green },
	{ id: "blue", label: "Blue", value: CABLE_INK.blue },
	{ id: "violet", label: "Violet", value: CABLE_INK.violet },
] as const;

/** Normalize a stored/picked color to a lower-case 6-digit hex, or null. */
export function normalizeHexColor(
	value: string | null | undefined,
): string | null {
	if (!value) return null;
	const trimmed = value.trim().toLowerCase();
	const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(trimmed);
	if (!match) return null;
	const hex = match[1];
	if (!hex) return null;
	return hex.length === 3
		? `#${hex
				.split("")
				.map((character) => `${character}${character}`)
				.join("")}`
		: `#${hex}`;
}

/** Match a stored cable color against the fixed palette. */
export function cableInkOption(
	color: string | null | undefined,
): CableInkOption | undefined {
	const normalized = normalizeHexColor(color);
	if (!normalized) return undefined;
	return CABLE_INK_OPTIONS.find((option) => option.value === normalized);
}

const SUBSTRATES = [
	{
		id: "dark",
		label: "dark canvas",
		background: canvasTheme.canvasBackground,
	},
	{
		id: "light",
		label: "light canvas",
		background: lightCanvasTheme.canvasBackground,
	},
	{ id: "paper", label: "white paper", background: lightCanvasTheme.pdfPaper },
] as const;

function channelLuminance(value: number): number {
	const channel = value / 255;
	return channel <= 0.03928
		? channel / 12.92
		: ((channel + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
	const normalized = normalizeHexColor(hex);
	if (!normalized) return 0;
	const red = Number.parseInt(normalized.slice(1, 3), 16);
	const green = Number.parseInt(normalized.slice(3, 5), 16);
	const blue = Number.parseInt(normalized.slice(5, 7), 16);
	return (
		0.2126 * channelLuminance(red) +
		0.7152 * channelLuminance(green) +
		0.0722 * channelLuminance(blue)
	);
}

function contrastRatio(a: string, b: string): number {
	const first = luminance(a);
	const second = luminance(b);
	const lighter = Math.max(first, second);
	const darker = Math.min(first, second);
	return (lighter + 0.05) / (darker + 0.05);
}

export interface CableInkContrast {
	/** Contrast against the dark canvas, light canvas and white PDF paper. */
	ratios: { dark: number; light: number; paper: number };
	/** Substrates below the 3:1 non-text floor. */
	failing: Array<"dark" | "light" | "paper">;
}

/** Contrast audit for a custom ink; null when the value isn't a valid hex. */
export function cableInkContrast(
	color: string | null | undefined,
): CableInkContrast | null {
	const normalized = normalizeHexColor(color);
	if (!normalized) return null;
	const ratios = {
		dark: contrastRatio(normalized, SUBSTRATES[0].background),
		light: contrastRatio(normalized, SUBSTRATES[1].background),
		paper: contrastRatio(normalized, SUBSTRATES[2].background),
	};
	const failing = SUBSTRATES.filter(
		(substrate) => ratios[substrate.id] < 3,
	).map((substrate) => substrate.id);
	return { ratios, failing };
}

/**
 * One-line reason a custom ink may be hard to see, or null. The five fixed inks
 * are the guaranteed set; custom is explicitly unguaranteed (owner revision).
 */
export function cableInkWarning(
	color: string | null | undefined,
): string | null {
	if (color === undefined || color === null || color.trim() === "") return null;
	if (!normalizeHexColor(color)) {
		return "Stored color isn’t a hex value.";
	}
	const contrast = cableInkContrast(color);
	if (!contrast || contrast.failing.length === 0) return null;
	const labels = contrast.failing.map(
		(id) => SUBSTRATES.find((substrate) => substrate.id === id)?.label,
	);
	return `Faint on ${labels.join(" / ")}.`;
}
