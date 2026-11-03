import type { JackEdge } from "../catalog/schema";
import { type Point, rotatePoint } from "./geometry";

/**
 * Free jack placement math (F-33 “Press Proof”). A corrected jack stores a
 * normalized point `{x, y}` in the item's unrotated footprint (0..1 across
 * width/height), so it can sit anywhere on the pedal face — not only on an
 * edge. Cable anchors still need an outward direction; an interior point uses a
 * radial normal from the footprint centre, falling back to the nearest edge.
 */

export interface NormalizedPoint {
	x: number;
	y: number;
}

export interface JackFootprint {
	widthCm: number;
	heightCm: number;
}

/** An item's placement frame (board transform optional) for world conversion. */
export interface ProofFrame {
	x: number;
	y: number;
	rotationDeg: number;
	board?: { x: number; y: number; rotationDeg: number };
}

export function clamp01(value: number): number {
	if (!Number.isFinite(value)) return 0.5;
	return Math.min(1, Math.max(0, value));
}

/** Quantize to 1/1000 so a drag can't create endless history churn. */
export function quantize(value: number): number {
	return Math.round(clamp01(value) * 1000) / 1000;
}

/** The jack's normalized point: a free x/y when present, else edge/pos. */
export function jackPointNormalized(
	jack: {
		xNorm?: number;
		yNorm?: number;
		edge: JackEdge;
		pos?: number;
	},
	_footprint: JackFootprint,
): NormalizedPoint {
	if (jack.xNorm !== undefined && jack.yNorm !== undefined) {
		return { x: clamp01(jack.xNorm), y: clamp01(jack.yNorm) };
	}
	const pos = clamp01(jack.pos ?? 0.5);
	switch (jack.edge) {
		case "top":
			return { x: pos, y: 0 };
		case "right":
			return { x: 1, y: pos };
		case "bottom":
			return { x: pos, y: 1 };
		case "left":
			return { x: 0, y: pos };
	}
}

/** Normalized face point → world cm (item rotation then board transform). */
export function normalizedToWorld(
	point: NormalizedPoint,
	frame: ProofFrame,
	footprint: JackFootprint,
): Point {
	const local = normalizedToLocal(point, footprint);
	const rotated = rotatePoint(local, { x: 0, y: 0 }, frame.rotationDeg);
	const parent = { x: frame.x + rotated.x, y: frame.y + rotated.y };
	if (!frame.board) return parent;
	const board = frame.board;
	const world = rotatePoint(parent, { x: 0, y: 0 }, board.rotationDeg);
	return { x: world.x + board.x, y: world.y + board.y };
}

/** World cm → normalized face point (inverse board then inverse item rotation). */
export function worldToNormalized(
	world: Point,
	frame: ProofFrame,
	footprint: JackFootprint,
): NormalizedPoint {
	let parent = world;
	if (frame.board) {
		const board = frame.board;
		parent = rotatePoint(
			{ x: world.x - board.x, y: world.y - board.y },
			{ x: 0, y: 0 },
			-board.rotationDeg,
		);
	}
	const local = rotatePoint(
		{ x: parent.x - frame.x, y: parent.y - frame.y },
		{ x: 0, y: 0 },
		-frame.rotationDeg,
	);
	return { x: local.x / footprint.widthCm, y: local.y / footprint.heightCm };
}

/** Convert a normalized point to local cm inside the unrotated footprint. */
export function normalizedToLocal(
	point: NormalizedPoint,
	footprint: JackFootprint,
): Point {
	return {
		x: clamp01(point.x) * footprint.widthCm,
		y: clamp01(point.y) * footprint.heightCm,
	};
}

/** The nearest edge + position along it, used for display/cable compatibility. */
export function deriveEdgePos(
	point: NormalizedPoint,
	footprint: JackFootprint,
): { edge: JackEdge; pos: number } {
	const x = clamp01(point.x);
	const y = clamp01(point.y);
	const distances: Array<{ edge: JackEdge; distance: number }> = [
		{ edge: "top", distance: y * footprint.heightCm },
		{ edge: "bottom", distance: (1 - y) * footprint.heightCm },
		{ edge: "left", distance: x * footprint.widthCm },
		{ edge: "right", distance: (1 - x) * footprint.widthCm },
	];
	let best = distances[0] as { edge: JackEdge; distance: number };
	for (const candidate of distances) {
		if (candidate.distance < best.distance) best = candidate;
	}
	const pos = best.edge === "top" || best.edge === "bottom" ? x : y;
	return { edge: best.edge, pos };
}

/**
 * Outward direction for a cable leaving a jack. Free/interior points use the
 * vector from the footprint centre to the point; near the centre or on an edge
 * fall back to the nearest edge normal so a cable still leaves plausibly.
 */
export function proofNormalFor(
	jack: {
		xNorm?: number;
		yNorm?: number;
		edge: JackEdge;
		pos?: number;
	},
	footprint: JackFootprint,
): Point {
	if (jack.xNorm === undefined || jack.yNorm === undefined) {
		return edgeNormal(jack.edge);
	}
	const local = normalizedToLocal({ x: jack.xNorm, y: jack.yNorm }, footprint);
	const dx = local.x - footprint.widthCm / 2;
	const dy = local.y - footprint.heightCm / 2;
	const length = Math.hypot(dx, dy);
	const minimum = Math.min(footprint.widthCm, footprint.heightCm) * 0.1;
	if (length > minimum) {
		return { x: dx / length, y: dy / length };
	}
	return edgeNormal(
		deriveEdgePos({ x: jack.xNorm, y: jack.yNorm }, footprint).edge,
	);
}

/** Unit normal of an edge in the item's unrotated local frame. */
export function edgeNormal(edge: JackEdge): Point {
	switch (edge) {
		case "top":
			return { x: 0, y: -1 };
		case "right":
			return { x: 1, y: 0 };
		case "bottom":
			return { x: 0, y: 1 };
		case "left":
			return { x: -1, y: 0 };
	}
}

/** Nudge a normalized point by cm, clamped to the footprint. */
export function nudgeNormalized(
	point: NormalizedPoint,
	dxCm: number,
	dyCm: number,
	footprint: JackFootprint,
): NormalizedPoint {
	return {
		x: quantize(point.x + dxCm / footprint.widthCm),
		y: quantize(point.y + dyCm / footprint.heightCm),
	};
}

/**
 * Snap to a boundary only when within `thresholdCm` of it. Returns the snapped
 * point plus the edge, or null when the point is comfortably interior.
 */
export function snapToBoundary(
	point: NormalizedPoint,
	footprint: JackFootprint,
	thresholdCm: number,
): { point: NormalizedPoint; edge: JackEdge } | null {
	const x = clamp01(point.x);
	const y = clamp01(point.y);
	const distances: Array<{
		edge: JackEdge;
		distance: number;
		point: NormalizedPoint;
	}> = [
		{ edge: "top", distance: y * footprint.heightCm, point: { x, y: 0 } },
		{
			edge: "bottom",
			distance: (1 - y) * footprint.heightCm,
			point: { x, y: 1 },
		},
		{ edge: "left", distance: x * footprint.widthCm, point: { x: 0, y } },
		{
			edge: "right",
			distance: (1 - x) * footprint.widthCm,
			point: { x: 1, y },
		},
	];
	let best = distances[0] as (typeof distances)[number];
	for (const candidate of distances) {
		if (candidate.distance < best.distance) best = candidate;
	}
	return best.distance <= thresholdCm
		? { point: best.point, edge: best.edge }
		: null;
}
