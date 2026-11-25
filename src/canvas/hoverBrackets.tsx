import { Line } from "react-konva";

/** Hover bracket arms / gap in **screen** px (counter-scaled for zoom). */
export const HOVER_ARM = 11;
export const HOVER_GAP = 5;
/** Under-stroke / over-stroke weights (screen px) — the two-tone construction. */
export const HOVER_UNDER = 4.5;
export const HOVER_STROKE = 2;

/** A larger frame for a board deck (F-07 "Construction Line"). */
export const BOARD_HOVER_ARM = 18;
export const BOARD_HOVER_GAP = 8;

/**
 * Four L-shaped corner brackets — the hover affordance (P2-01 "Specimen
 * Bench", shared by pedals and boards in F-07). They sit just **outside** the
 * footprint (outside reads as "targeting"; an inset ring read as odd padding)
 * and are drawn two-tone (a canvas-background under-stroke beneath the ink
 * stroke) so the bracket stays visible over any product photo. Neutral ink, so
 * hover never competes with the cyan selection halo; arms/thickness are
 * counter-scaled to stay constant on screen at any zoom.
 */
export function HoverBrackets({
	widthPx,
	heightPx,
	scale,
	color,
	underColor,
	armPx = HOVER_ARM,
	gapPx = HOVER_GAP,
}: {
	widthPx: number;
	heightPx: number;
	scale: number;
	color: string;
	underColor: string;
	armPx?: number;
	gapPx?: number;
}) {
	const gap = gapPx / scale;
	const arm = armPx / scale;
	// Clamp on very small footprints so the two brackets can't collide.
	const screenMin = Math.min(widthPx, heightPx) * scale;
	const armClamped = Math.min(arm, (screenMin * 0.34) / scale);
	const gapClamped = Math.min(gap, (screenMin * 0.12) / scale);
	const left = -gapClamped;
	const top = -gapClamped;
	const right = widthPx + gapClamped;
	const bottom = heightPx + gapClamped;
	const paths = [
		[left, top + armClamped, left, top, left + armClamped, top],
		[right - armClamped, top, right, top, right, top + armClamped],
		[right, bottom - armClamped, right, bottom, right - armClamped, bottom],
		[left + armClamped, bottom, left, bottom, left, bottom - armClamped],
	];
	return (
		<>
			{paths.map((points, index) => (
				<Line
					// biome-ignore lint/suspicious/noArrayIndexKey: fixed 4-bracket geometry
					key={`under-${index}`}
					points={points}
					stroke={underColor}
					strokeWidth={HOVER_UNDER / scale}
					lineCap="round"
					lineJoin="round"
					listening={false}
					perfectDrawEnabled={false}
				/>
			))}
			{paths.map((points, index) => (
				<Line
					// biome-ignore lint/suspicious/noArrayIndexKey: fixed 4-bracket geometry
					key={`over-${index}`}
					points={points}
					stroke={color}
					strokeWidth={HOVER_STROKE / scale}
					lineCap="round"
					lineJoin="round"
					listening={false}
					perfectDrawEnabled={false}
				/>
			))}
		</>
	);
}
