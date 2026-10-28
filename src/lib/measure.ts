import {
	boardWorldCorners,
	type CustomPedal,
	type Endpoint,
	itemWorldCorners,
	type PlacedBoard,
	type PlacedItem,
} from "../state/scene";
import { type DisplayUnits, type Point, PX_PER_CM } from "./geometry";
import { DEFAULT_GRID_STEP_CM, type GridStepCm, gridCellCm } from "./grid";
import { type AnchorIndex, anchorIndexFor } from "./jackAnchor";

/**
 * Distance measurement (F-03): nearest-anchor snapping and display formatting.
 * All geometry is world cm; screen radius is converted with the current zoom.
 */

export type MeasureSnap = "board" | "item" | "jack" | "endpoint" | "grid";

export interface MeasureScene {
	boards: PlacedBoard[];
	items: PlacedItem[];
	customPedals: CustomPedal[];
	endpoints: Endpoint[];
}

interface Candidate {
	point: Point;
	kind: MeasureSnap;
}

function midpoint(a: Point, b: Point): Point {
	return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function sceneCandidates(scene: MeasureScene): Candidate[] {
	const candidates: Candidate[] = [];
	for (const board of scene.boards) {
		const corners = boardWorldCorners(board);
		for (const corner of corners) {
			candidates.push({ point: corner, kind: "board" });
		}
		candidates.push({
			point: midpoint(corners[0], corners[2]),
			kind: "board",
		});
	}
	for (const item of scene.items) {
		const corners = itemWorldCorners(item, scene.boards, scene.customPedals);
		for (const corner of corners) {
			candidates.push({ point: corner, kind: "item" });
		}
		candidates.push({
			point: midpoint(corners[0], corners[2]),
			kind: "item",
		});
	}
	const anchors: AnchorIndex = anchorIndexFor(scene);
	for (const anchor of anchors.all) {
		candidates.push({
			point: anchor.point,
			kind: anchor.key.startsWith("endpoint:") ? "endpoint" : "jack",
		});
	}
	return candidates;
}

/**
 * Snap a world point to the nearest board/item corner or centre, jack/endpoint,
 * or the current grid cell (5 cm at 1×, LOD-aware). `radiusPx` is the screen
 * hit radius (mouse 12 / touch 24).
 */
export function snapMeasurePoint(
	point: Point,
	scale: number,
	radiusPx: number,
	scene: MeasureScene,
	gridStepCm: GridStepCm = DEFAULT_GRID_STEP_CM,
): { point: Point; kind: MeasureSnap } {
	const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
	const radiusCm = radiusPx / (PX_PER_CM * safeScale);
	let best: Candidate | null = null;
	let bestDistance = Number.POSITIVE_INFINITY;
	for (const candidate of sceneCandidates(scene)) {
		const distance = Math.hypot(
			candidate.point.x - point.x,
			candidate.point.y - point.y,
		);
		if (distance <= radiusCm && distance < bestDistance) {
			best = candidate;
			bestDistance = distance;
		}
	}
	if (best) return { point: best.point, kind: best.kind };

	const step = gridCellCm(safeScale, gridStepCm);
	return {
		point: {
			x: Math.round(point.x / step) * step,
			y: Math.round(point.y / step) * step,
		},
		kind: "grid",
	};
}

/** Straight-line world distance in cm. */
export function distanceCm(a: Point, b: Point): number {
	return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Display a measured distance in the active unit (1 dp; the grid is 5 cm). */
export function formatMeasureDistance(cm: number, units: DisplayUnits): string {
	const value = units === "in" ? cm / 2.54 : cm;
	return `${Math.round(value * 10) / 10} ${units}`;
}
