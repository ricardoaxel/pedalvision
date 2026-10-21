import { CABLE } from "../styles/theme";
import type { Point } from "./geometry";
import { cmToPx } from "./geometry";
import type { AnchorPoint } from "./jackAnchor";

/** A screen-px cubic Bezier + its destination arrowhead. */
export interface CableCurve {
	start: Point;
	control1: Point;
	control2: Point;
	end: Point;
	/** Arrow triangle: tip, base-left, base-right (screen px). */
	arrow: [Point, Point, Point];
}

function add(a: Point, b: Point): Point {
	return { x: a.x + b.x, y: a.y + b.y };
}

function scalePoint(point: Point, factor: number): Point {
	return { x: point.x * factor, y: point.y * factor };
}

function sub(a: Point, b: Point): Point {
	return { x: a.x - b.x, y: a.y - b.y };
}

function normalize(point: Point): Point {
	const length = Math.hypot(point.x, point.y);
	return length > 0
		? { x: point.x / length, y: point.y / length }
		: { x: 1, y: 0 };
}

/**
 * Build the visible cable curve in **render px** from two world-cm anchors.
 * Handles leave a jack along its outward normal (rotated with the pedal) so a
 * cable exits sideways/topwards instead of cutting through the artwork; an
 * endpoint-side handle points back along the chord. All screen metrics are
 * divided by `scale` so stroke distance and arrow size stay constant at any zoom.
 * Pure + unit-testable (no Konva imports).
 */
export function cableCurve(
	from: AnchorPoint,
	to: AnchorPoint,
	scale: number,
): CableCurve {
	const safeScale = Math.max(scale, 0.0001);
	const start = { x: cmToPx(from.point.x), y: cmToPx(from.point.y) };
	const end = { x: cmToPx(to.point.x), y: cmToPx(to.point.y) };
	const chord = Math.hypot(end.x - start.x, end.y - start.y);
	const direction = normalize(sub(end, start));
	const handle = Math.max(
		CABLE.handleMinPx / safeScale,
		Math.min(chord * CABLE.handleChordFraction, CABLE.handleMaxPx / safeScale),
	);
	// A jack handle leaves along its outward normal. An endpoint has no edge, so
	// its handle points back along the chord (the cable plugs into the tag).
	const control1 = add(start, scalePoint(from.normal ?? direction, handle));
	const control2 = to.normal
		? add(end, scalePoint(to.normal, handle))
		: add(end, scalePoint(direction, -handle));

	const tangent = normalize(sub(end, control2));
	const tip = sub(end, scalePoint(tangent, CABLE.arrowGapPx / safeScale));
	const baseCentre = sub(
		tip,
		scalePoint(tangent, CABLE.arrowLengthPx / safeScale),
	);
	const perpendicular = { x: -tangent.y, y: tangent.x };
	const halfWidth = CABLE.arrowWidthPx / 2 / safeScale;
	const left = add(baseCentre, scalePoint(perpendicular, halfWidth));
	const right = sub(baseCentre, scalePoint(perpendicular, halfWidth));

	return { start, control1, control2, end, arrow: [tip, left, right] };
}

/** Konva `Path` data for a cubic curve. */
export function cablePathData(curve: CableCurve): string {
	const { start, control1, control2, end } = curve;
	return `M ${start.x} ${start.y} C ${control1.x} ${control1.y} ${control2.x} ${control2.y} ${end.x} ${end.y}`;
}

/** A point on the curve (t = 0..1) — used to anchor the cable action bar. */
export function cablePointAt(curve: CableCurve, t = 0.5): Point {
	const mt = 1 - t;
	const a = mt * mt * mt;
	const b = 3 * mt * mt * t;
	const c = 3 * mt * t * t;
	const d = t * t * t;
	return {
		x:
			a * curve.start.x +
			b * curve.control1.x +
			c * curve.control2.x +
			d * curve.end.x,
		y:
			a * curve.start.y +
			b * curve.control1.y +
			c * curve.control2.y +
			d * curve.end.y,
	};
}
