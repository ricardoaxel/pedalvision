import {
	CABLE_INK_OPTIONS,
	cableInkOption,
	cableInkWarning,
	normalizeHexColor,
} from "./cableColor";

/**
 * Organization colors for placed parts and boards (F-16 "Field Marks"). The
 * palette is deliberately the **same five inks** as Q-05 Patch Ink plus a custom
 * hex: one color vocabulary across the app, already contrast-tested on the dark
 * canvas, the light canvas and white PDF paper. Cables remain a separate field.
 */
export const SCENE_COLOR_OPTIONS = CABLE_INK_OPTIONS;

export { normalizeHexColor };

/** Match a stored item/board color against the fixed palette. */
export const sceneColorOption = cableInkOption;

/** One-line reason a custom scene color may be hard to see, or null. */
export const sceneColorWarning = cableInkWarning;

/** Human label for a stored color: a palette name, "Custom", or "Default". */
export function sceneColorLabel(color: string | null | undefined): string {
	const option = cableInkOption(color);
	if (option) return option.label;
	return normalizeHexColor(color) ? "Custom" : "Default";
}

/** The drawable hex for a stored color, or null when absent/invalid. */
export function sceneColorValue(
	color: string | null | undefined,
): string | null {
	return normalizeHexColor(color);
}

/**
 * Inset the notched custom-board silhouette for the F-16 "Deck Spine" mark.
 * Scaling each axis from [0, size] to [inset, size − inset] keeps the notch
 * proportion and clears the selected board's Transformer border (1.5 px on the
 * outer edge) so the organization color stays visible while the board is
 * selected. Returns a flat Konva points array.
 */
export function insetBoardMarkPoints(
	width: number,
	height: number,
	notch: number,
	inset: number,
): number[] {
	const scaleX = Math.max(0, width - inset * 2) / width;
	const scaleY = Math.max(0, height - inset * 2) / height;
	const mapX = (x: number) => inset + x * scaleX;
	const mapY = (y: number) => inset + y * scaleY;
	return [
		mapX(0),
		mapY(0),
		mapX(width - notch),
		mapY(0),
		mapX(width),
		mapY(notch),
		mapX(width),
		mapY(height),
		mapX(0),
		mapY(height),
	];
}
