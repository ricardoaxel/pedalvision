import {
	type Point,
	type RectCm,
	rectsOverlap,
	rotatePoint,
	worldToBoard,
} from "../lib/geometry";
import {
	boardFootprint,
	type CustomPedal,
	findBoardAt,
	itemFootprint,
	itemWorldCorners,
	type PlacedBoard,
	type PlacedItem,
	resolveItem,
} from "./scene";

/**
 * Space warning (P2-03) — the pure, pixel-free predicate behind the non-blocking
 * "this overlaps / extends beyond its board" cue (owner folded 2026-10-18). It
 * only **reports**; it never constrains a placement (no auto-avoidance/reflow).
 *
 * Overlap is an axis-aligned bounding-box test in **world cm**, across **every**
 * item regardless of container (a loose pedal over a board pedal is a real
 * visual overlap), so it is correct across container boundaries and board
 * rotations — but deliberately an approximation for a rotated item. Out-of-bounds
 * is exact: the item's four corners are mapped into its board's unrotated frame
 * and compared edge-by-edge against the board footprint.
 */
export interface SpaceWarning {
	/** Names of the items this one overlaps (world AABB), in scene order. */
	overlaps: string[];
	/**
	 * Names of items this one is close to but does not overlap. A patch cable
	 * (right-angle plug) needs a little edge clearance, so "no warning" means
	 * comfortably cableable, not merely non-overlapping (P4-02 / pedal-user).
	 */
	tight: string[];
	/** True when the item extends past its (drop-target) board's footprint. */
	outOfBounds: boolean;
	/** True when any condition holds. */
	any: boolean;
}

/**
 * Live placement override while an item is being dragged: its world-cm origin +
 * **visible** world rotation (`liftedWorldCm`/`liftedRotationDeg`). When present
 * the item is evaluated where it currently floats, not at its stored position.
 */
export interface LivePlacement {
	originCm: Point;
	rotationDeg: number;
}

export interface SpaceWarningContext {
	items: PlacedItem[];
	boards: PlacedBoard[];
	customPedals: CustomPedal[];
	live?: LivePlacement;
}

const ORIGIN: Point = { x: 0, y: 0 };
/** Corners exactly on an edge are inside — treat sub-pixel drift as inside. */
const EPSILON = 1e-6;
/**
 * Minimum edge clearance for a right-angle patch cable (cm). Below this the
 * pedals can be non-overlapping but still awkward/impossible to cable; the cue
 * is a separate "Cable gap" advisory, never an error.
 */
export const PATCH_CABLE_GAP_CM = 2.5;

function footprintCorners(widthCm: number, heightCm: number): Point[] {
	return [
		{ x: 0, y: 0 },
		{ x: widthCm, y: 0 },
		{ x: widthCm, y: heightCm },
		{ x: 0, y: heightCm },
	];
}

/** The axis-aligned bounding box (cm) of a set of points. */
function aabb(points: Point[]): RectCm {
	let minX = Number.POSITIVE_INFINITY;
	let minY = Number.POSITIVE_INFINITY;
	let maxX = Number.NEGATIVE_INFINITY;
	let maxY = Number.NEGATIVE_INFINITY;
	for (const point of points) {
		if (point.x < minX) minX = point.x;
		if (point.y < minY) minY = point.y;
		if (point.x > maxX) maxX = point.x;
		if (point.y > maxY) maxY = point.y;
	}
	return { x: minX, y: minY, widthCm: maxX - minX, heightCm: maxY - minY };
}

/**
 * The item's four footprint corners in **world cm** — from the live override
 * while dragging, otherwise from the resolved geometry (`itemWorldCorners`,
 * which applies the board transform for attached items).
 */
function placedCorners(
	item: PlacedItem,
	boards: PlacedBoard[],
	customPedals: CustomPedal[],
	live?: LivePlacement,
): Point[] {
	if (!live) return itemWorldCorners(item, boards, customPedals);
	const { widthCm, heightCm } = itemFootprint(item, customPedals);
	return footprintCorners(widthCm, heightCm).map((corner) => {
		const rotated = rotatePoint(corner, ORIGIN, live.rotationDeg);
		return { x: rotated.x + live.originCm.x, y: rotated.y + live.originCm.y };
	});
}

/**
 * The board the item is currently over: while dragging, the topmost board under
 * its live centre (`findBoardAt`, so the warning follows the drop target);
 * otherwise the item's owning board (null for loose items — no bounds check).
 */
function containingBoard(
	item: PlacedItem,
	boards: PlacedBoard[],
	customPedals: CustomPedal[],
	live?: LivePlacement,
): PlacedBoard | null {
	if (live) {
		const rect = aabb(placedCorners(item, boards, customPedals, live));
		return findBoardAt(boards, {
			x: rect.x + rect.widthCm / 2,
			y: rect.y + rect.heightCm / 2,
		});
	}
	if (!item.boardUid) return null;
	return boards.find((board) => board.uid === item.boardUid) ?? null;
}

/**
 * Compute the space warning for `item` against the rest of the scene. An item is
 * only ever flagged when the caller asks (the item under attention), so passive
 * peers are never marked.
 */
export function spaceWarning(
	item: PlacedItem,
	context: SpaceWarningContext,
): SpaceWarning {
	const { items, boards, customPedals, live } = context;
	const targetRect = aabb(placedCorners(item, boards, customPedals, live));

	const overlaps: string[] = [];
	const tight: string[] = [];
	for (const peer of items) {
		if (peer.uid === item.uid) continue;
		const peerRect = aabb(placedCorners(peer, boards, customPedals));
		const name = resolveItem(peer, customPedals).name;
		if (rectsOverlap(targetRect, peerRect)) {
			overlaps.push(name);
		} else if (rectsOverlap(targetRect, peerRect, PATCH_CABLE_GAP_CM)) {
			tight.push(name);
		}
	}

	const board = containingBoard(item, boards, customPedals, live);
	let outOfBounds = false;
	if (board) {
		const footprint = boardFootprint(board);
		outOfBounds = placedCorners(item, boards, customPedals, live).some(
			(world) => {
				const local = worldToBoard(world, board);
				return (
					local.x < -EPSILON ||
					local.x > footprint.widthCm + EPSILON ||
					local.y < -EPSILON ||
					local.y > footprint.heightCm + EPSILON
				);
			},
		);
	}

	return {
		overlaps,
		tight,
		outOfBounds,
		any: overlaps.length > 0 || tight.length > 0 || outOfBounds,
	};
}
