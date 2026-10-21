import { CABLE } from "../styles/theme";
import type { Point } from "./geometry";
import { cmToPx } from "./geometry";
import type { AnchorPoint } from "./jackAnchor";

/** A screen-px cubic Bezier + its destination arrowhead. */
export interface CableCurve {
	/** Anchor points (used for the arrow / midpoint). */
	start: Point;
	control1: Point;
	control2: Point;
	end: Point;
	/** Path points after trimming the socket collar at both ends. */
	pathStart: Point;
	pathEnd: Point;
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
	// Short patch runs are normal (adjacent pedals are ~2–3 cm apart = 8–16 px
	// at 1×). A fixed 14 + 10 px arrow would sit on/behind the source socket, so
	// clamp it to the run and fall back to a tiny midpoint chevron.
	const tickDiameter = 9 / safeScale;
	const free = Math.max(0, chord - tickDiameter);
	const short = free < 8 / safeScale;
	const arrowLength = short
		? 3 / safeScale
		: Math.min(
				CABLE.arrowLengthPx / safeScale,
				Math.max(4 / safeScale, free * 0.45),
			);
	const arrowGap = short
		? 0
		: Math.min(
				CABLE.arrowGapPx / safeScale,
				Math.max(3 / safeScale, free * 0.3),
			);
	const tip = short
		? { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }
		: sub(end, scalePoint(tangent, arrowGap));
	const baseCentre = sub(tip, scalePoint(tangent, arrowLength));
	const perpendicular = { x: -tangent.y, y: tangent.x };
	const halfWidth = short ? 1.5 / safeScale : arrowLength * 0.4;
	const left = add(baseCentre, scalePoint(perpendicular, halfWidth));
	const right = sub(baseCentre, scalePoint(perpendicular, halfWidth));

	// Trim the drawn path by the socket collar so the trace/halo never paints
	// over the jack ring (the cable layer sits above the pedal).
	const trim = Math.min(tickDiameter / 2 + 1 / safeScale, chord * 0.2);
	const startTangent = normalize(sub(control1, start));
	const pathStart = add(start, scalePoint(startTangent, trim));
	const pathEnd = sub(end, scalePoint(tangent, trim));

	return {
		start,
		control1,
		control2,
		end,
		pathStart,
		pathEnd,
		arrow: [tip, left, right],
	};
}

/**
 * Export cable metrics in **cm** (design.md §Cable visuals → export). The
 * exported PNG/PDF is a physical drawing, so the live screen-constant values are
 * re-derived here: 0.16 cm stroke, 0.32 cm halo, 0.62 × 0.5 cm arrowhead.
 */
export const EXPORT_CABLE = {
	strokeCm: 0.16,
	haloCm: 0.32,
	strokeSelectedCm: 0.2,
	arrowLengthCm: 0.62,
	arrowWidthCm: 0.5,
	arrowGapCm: 0.55,
	handleMinCm: 6,
	handleMaxCm: 24,
	handleChordFraction: 0.45,
} as const;

/**
 * The same cubic cable curve as the live canvas, but in **world cm** with
 * physical handles, for the export renderer. Path normals are unchanged, so the
 * exported trace matches the on-screen shape instead of a straight line.
 */
export function cableCurveCm(from: AnchorPoint, to: AnchorPoint): CableCurve {
	const start = from.point;
	const end = to.point;
	const chord = Math.hypot(end.x - start.x, end.y - start.y);
	const direction = normalize(sub(end, start));
	const handle = Math.max(
		EXPORT_CABLE.handleMinCm,
		Math.min(
			chord * EXPORT_CABLE.handleChordFraction,
			EXPORT_CABLE.handleMaxCm,
		),
	);
	const control1 = add(start, scalePoint(from.normal ?? direction, handle));
	const control2 = to.normal
		? add(end, scalePoint(to.normal, handle))
		: add(end, scalePoint(direction, -handle));
	const tangent = normalize(sub(end, control2));
	const tip = sub(end, scalePoint(tangent, EXPORT_CABLE.arrowGapCm));
	const baseCentre = sub(tip, scalePoint(tangent, EXPORT_CABLE.arrowLengthCm));
	const perpendicular = { x: -tangent.y, y: tangent.x };
	const halfWidth = EXPORT_CABLE.arrowWidthCm / 2;
	const left = add(baseCentre, scalePoint(perpendicular, halfWidth));
	const right = sub(baseCentre, scalePoint(perpendicular, halfWidth));
	return {
		start,
		control1,
		control2,
		end,
		pathStart: start,
		pathEnd: end,
		arrow: [tip, left, right],
	};
}

/**
 * Konva `Path` data for a world-cm curve, converted to export-stage px.
 * `pxPerCm` is the export density (32 standard / 64 HD).
 */
export function cablePathDataCm(curve: CableCurve, pxPerCm: number): string {
	const at = (point: Point) => `${point.x * pxPerCm} ${point.y * pxPerCm}`;
	return `M ${at(curve.start)} C ${at(curve.control1)} ${at(curve.control2)} ${at(curve.end)}`;
}

/** Konva `Path` data for a cubic curve. */
export function cablePathData(curve: CableCurve): string {
	const { pathStart, control1, control2, pathEnd } = curve;
	return `M ${pathStart.x} ${pathStart.y} C ${control1.x} ${control1.y} ${control2.x} ${control2.y} ${pathEnd.x} ${pathEnd.y}`;
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
