/**
 * True-scale geometry — the guardrail for every canvas task.
 *
 * cm is the single source of truth for all geometry (AGENTS.md → Hard
 * constraints). Pixels exist only at render time:
 *
 *   px = cm × PX_PER_CM × zoom
 *
 * Everything here is a pure function: no Konva, no DOM, no rounding at the
 * storage level (round only for display, 2 decimals). See
 * docs/design.md §Canvas architecture and requirements.md (A1/A2).
 */

/** Render pixels per centimetre at zoom 1 (design.md — start: 4). */
export const PX_PER_CM = 4;

/** Centimetres in an inch (exact). */
const CM_PER_INCH = 2.54;

/** A point/vector in whatever frame the caller is working in (cm, usually). */
export interface Point {
	x: number;
	y: number;
}

/**
 * A placed board's transform in world cm. `x`/`y` locate the board's local
 * origin in world space; `rotationDeg` is clockwise-positive (Konva
 * convention). See docs/design.md §Data model (PlacedBoard).
 *
 * Pivot contract: board-local coordinates are relative to this origin, and
 * that origin is the board's **rotation pivot**. The Konva board group must
 * therefore be rendered with `offset` 0 (pivot = group position). If a board
 * is later pivoted about its centre via `offset = (w/2, h/2)`, callers must
 * pre-adjust before using {@link boardToWorld}/{@link worldToBoard}, or drop
 * hit-tests will land offset by the rotated half-footprint.
 */
export interface BoardTransform {
	x: number;
	y: number;
	rotationDeg: number;
}

/** Display unit for {@link cmToDisplay}. Storage is always cm. */
export type DisplayUnits = "cm" | "in";

const ORIGIN: Point = { x: 0, y: 0 };

/**
 * Convert a centimetre length to render pixels at a given zoom (stage scale):
 * `cm × PX_PER_CM × zoom`. `zoom` defaults to 1.
 */
export function cmToPx(cm: number, zoom = 1): number {
	return cm * PX_PER_CM * zoom;
}

/**
 * Inverse of {@link cmToPx}: render pixels back to centimetres.
 * `zoom` defaults to 1.
 */
export function pxToCm(px: number, zoom = 1): number {
	return px / (PX_PER_CM * zoom);
}

/**
 * Rotate `point` around `center` by `deg` degrees, clockwise-positive
 * (screen coordinates, y growing down — matches Konva's `rotation`).
 */
export function rotatePoint(point: Point, center: Point, deg: number): Point {
	const rad = (deg * Math.PI) / 180;
	const cos = Math.cos(rad);
	const sin = Math.sin(rad);
	const dx = point.x - center.x;
	const dy = point.y - center.y;
	return {
		x: center.x + dx * cos - dy * sin,
		y: center.y + dx * sin + dy * cos,
	};
}

/**
 * Map a board-local point (cm, board's unrotated frame) to world cm:
 * rotate about the board's local origin (the rotation pivot — see
 * {@link BoardTransform}), then translate by the board's world position.
 * Board-attached items are stored board-relative (design.md).
 */
export function boardToWorld(item: Point, board: BoardTransform): Point {
	const rotated = rotatePoint(item, ORIGIN, board.rotationDeg);
	return { x: rotated.x + board.x, y: rotated.y + board.y };
}

/**
 * Inverse of {@link boardToWorld}: map a world-cm point back to the board's
 * local unrotated frame.
 */
export function worldToBoard(point: Point, board: BoardTransform): Point {
	const translated = { x: point.x - board.x, y: point.y - board.y };
	return rotatePoint(translated, ORIGIN, -board.rotationDeg);
}

/**
 * Convert a stored cm value to the active display unit, rounded to
 * 2 decimals (display-only — storage stays exact cm). The unit suffix is
 * left to the UI.
 */
export function cmToDisplay(cm: number, units: DisplayUnits): number {
	const value = units === "in" ? cm / CM_PER_INCH : cm;
	const rounded = Math.round(value * 100) / 100;
	// Normalise -0 → 0 so display paths never format "-0".
	return rounded === 0 ? 0 : rounded;
}
