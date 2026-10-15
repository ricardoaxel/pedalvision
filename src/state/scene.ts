import { create } from "zustand";
import { catalog } from "../catalog/load";
import type { CatalogBoard, CatalogPedal } from "../catalog/schema";
import { boardToWorld, type Point, worldToBoard } from "../lib/geometry";

/**
 * The scene document (design.md §Data model). The boards and pedal/supply
 * items slices exist so far — cables/endpoints arrive in later tasks. All
 * geometry is in cm; pixels are computed at render time only.
 */
export interface PlacedBoard {
	uid: string;
	/** Catalog board id, or null for a custom-size board (P2-05). */
	boardRefId: string | null;
	/** Footprint override for custom boards (P2-05). */
	customSize?: { widthCm: number; heightCm: number };
	/** World cm of the board's local origin (its unrotated top-left — the
	 * rotation pivot; see geometry.ts §BoardTransform). */
	x: number;
	y: number;
	/** Clockwise-positive (Konva convention), any angle. */
	rotationDeg: number;
}

/**
 * A placed pedal/supply (design.md §Data model, PlacedItem). `x`/`y` are cm in
 * the parent frame: relative to the owning board's **unrotated** local origin
 * when `boardUid` is set, or world cm when the item is loose (`boardUid` null).
 * `refId` resolves to a catalog pedal (its `category` must match `kind`).
 */
export interface PlacedItem {
	uid: string;
	refId: string;
	kind: "pedal" | "supply";
	/** Owning board uid, or null when the item is loose (world cm). */
	boardUid: string | null;
	x: number;
	y: number;
	/** Clockwise-positive (Konva convention); always 0 until P1-05. */
	rotationDeg: number;
	/** Dense integer ordered within the item's container (P1-06 uses it). */
	z: number;
}

const BOARD_BY_ID = new Map<string, CatalogBoard>(
	catalog.boards.map((board) => [board.id, board]),
);

const PEDAL_BY_ID = new Map<string, CatalogPedal>(
	catalog.pedals.map((pedal) => [pedal.id, pedal]),
);

/** Used only when a board has neither a known ref nor a custom size. */
export const FALLBACK_BOARD_CM = { widthCm: 40, heightCm: 20 };

/** Used only when a pedal ref is unknown (custom pedals keep their own size). */
export const FALLBACK_PEDAL_CM = { widthCm: 7, heightCm: 12 };

/** How far a duplicate lands from its source (cm), so it's visibly offset. */
export const DUPLICATE_OFFSET_CM = 1.5;

/** Resolve a placed board's footprint in cm (catalog ref → custom → fallback). */
export function boardFootprint(board: PlacedBoard): {
	widthCm: number;
	heightCm: number;
} {
	if (board.customSize) return board.customSize;
	const definition = board.boardRefId
		? BOARD_BY_ID.get(board.boardRefId)
		: undefined;
	return definition
		? { widthCm: definition.widthCm, heightCm: definition.heightCm }
		: FALLBACK_BOARD_CM;
}

/** Resolve the catalog entry backing a placed board (null for custom boards). */
export function boardDefinition(board: PlacedBoard): CatalogBoard | null {
	return board.boardRefId ? (BOARD_BY_ID.get(board.boardRefId) ?? null) : null;
}

/** Resolve the catalog entry backing a placed item (null if unknown). */
export function itemDefinition(item: PlacedItem): CatalogPedal | null {
	return PEDAL_BY_ID.get(item.refId) ?? null;
}

/** Resolve a placed item's footprint in cm (catalog ref → fallback). */
export function itemFootprint(item: PlacedItem): {
	widthCm: number;
	heightCm: number;
} {
	const definition = itemDefinition(item);
	return definition
		? { widthCm: definition.widthCm, heightCm: definition.heightCm }
		: FALLBACK_PEDAL_CM;
}

/**
 * Map an item's stored position to world cm. Attached items (boardUid set) are
 * stored in the board's unrotated frame, so this applies the board transform
 * (`boardToWorld`); loose items are already world cm. Items whose board is gone
 * fall back to treating their position as world (never throws).
 */
export function itemWorldOrigin(
	item: PlacedItem,
	boards: PlacedBoard[],
): Point {
	if (!item.boardUid) return { x: item.x, y: item.y };
	const board = boards.find((candidate) => candidate.uid === item.boardUid);
	if (!board) return { x: item.x, y: item.y };
	return boardToWorld({ x: item.x, y: item.y }, board);
}

/**
 * The topmost board whose rotated footprint contains `worldPoint` (world cm),
 * or null. Later boards render on top, so the search runs back-to-front. The
 * hit-test converts the point into each board's unrotated frame with
 * `worldToBoard`, so it is correct for any board rotation.
 */
export function findBoardAt(
	boards: PlacedBoard[],
	worldPoint: Point,
): PlacedBoard | null {
	for (let index = boards.length - 1; index >= 0; index--) {
		const board = boards[index];
		const local = worldToBoard(worldPoint, board);
		const footprint = boardFootprint(board);
		if (
			local.x >= 0 &&
			local.x <= footprint.widthCm &&
			local.y >= 0 &&
			local.y <= footprint.heightCm
		) {
			return board;
		}
	}
	return null;
}

/** The next dense z within a container (board or loose). */
function nextZ(items: PlacedItem[], boardUid: string | null): number {
	let max = -1;
	for (const item of items) {
		if (item.boardUid !== boardUid) continue;
		if (item.z > max) max = item.z;
	}
	return max + 1;
}

interface SceneStore {
	boards: PlacedBoard[];
	items: PlacedItem[];
	/**
	 * Add a catalog pedal/supply with its origin at `posCm` (parent frame:
	 * board-local when `boardUid` is set, world cm when loose), returning its uid.
	 */
	addItem: (
		refId: string,
		kind: PlacedItem["kind"],
		boardUid: string | null,
		posCm: Point,
	) => string;
	/** Clone an item, offset slightly, in the same container. Returns the new uid. */
	duplicateItem: (uid: string) => string | null;
	removeItem: (uid: string) => void;
	/**
	 * Finish a drag: hit-test the item's world centre against the boards and move
	 * it to the topmost containing board (storing board-relative cm) or leave it
	 * loose (world cm). `worldOriginCm` is the item's origin in world cm at drop
	 * time. All the move + re-parenting math lives here so it is unit-testable
	 * (the rotated-board case).
	 */
	dropItem: (uid: string, worldOriginCm: Point) => void;
	/**
	 * Add a catalog board centred on `centerCm` (world cm), returning its uid.
	 * Stored `x`/`y` is the board's origin (top-left), so the caller stays free
	 * of footprint math; see `viewportCenterCm` for the usual "drop at centre".
	 */
	addBoard: (boardRefId: string, centerCm: Point) => string;
	moveBoard: (uid: string, xCm: number, yCm: number) => void;
	rotateBoard: (uid: string, rotationDeg: number) => void;
	/** Remove a board; its attached items fall loose at their world positions. */
	removeBoard: (uid: string) => void;
}

/**
 * User scene state. Positions + sizes are cm in world coordinates (AGENTS.md
 * hard constraint); the renderer multiplies by PX_PER_CM × zoom at draw time.
 * Selection is deliberately *not* here — it is transient UI state
 * (`state/selection.ts`) and is not part of the scene document.
 */
export const useScene = create<SceneStore>((set) => ({
	boards: [],
	items: [],
	addItem: (refId, kind, boardUid, posCm) => {
		const uid = crypto.randomUUID();
		set((state) => ({
			items: [
				...state.items,
				{
					uid,
					refId,
					kind,
					boardUid,
					x: posCm.x,
					y: posCm.y,
					rotationDeg: 0,
					z: nextZ(state.items, boardUid),
				},
			],
		}));
		return uid;
	},
	duplicateItem: (uid) => {
		let cloneUid: string | null = null;
		set((state) => {
			const source = state.items.find((item) => item.uid === uid);
			if (!source) return state;
			cloneUid = crypto.randomUUID();
			return {
				items: [
					...state.items,
					{
						...source,
						uid: cloneUid,
						x: source.x + DUPLICATE_OFFSET_CM,
						y: source.y + DUPLICATE_OFFSET_CM,
						z: nextZ(state.items, source.boardUid),
					},
				],
			};
		});
		return cloneUid;
	},
	removeItem: (uid) =>
		set((state) => ({
			items: state.items.filter((item) => item.uid !== uid),
		})),
	dropItem: (uid, worldOriginCm) =>
		set((state) => {
			const item = state.items.find((candidate) => candidate.uid === uid);
			if (!item) return state;
			const footprint = itemFootprint(item);
			// Hit-test the item's centre (its origin + half-footprint, no pedal
			// rotation until P1-05), so the drop reads by where the pedal sits.
			const centre = {
				x: worldOriginCm.x + footprint.widthCm / 2,
				y: worldOriginCm.y + footprint.heightCm / 2,
			};
			const board = findBoardAt(state.boards, centre);
			const next = board
				? { boardUid: board.uid, ...worldToBoard(worldOriginCm, board) }
				: { boardUid: null, x: worldOriginCm.x, y: worldOriginCm.y };
			return {
				items: state.items.map((candidate) =>
					candidate.uid === uid ? { ...candidate, ...next } : candidate,
				),
			};
		}),
	addBoard: (boardRefId, centerCm) => {
		const uid = crypto.randomUUID();
		const definition = BOARD_BY_ID.get(boardRefId);
		const widthCm = definition?.widthCm ?? FALLBACK_BOARD_CM.widthCm;
		const heightCm = definition?.heightCm ?? FALLBACK_BOARD_CM.heightCm;
		const board: PlacedBoard = {
			uid,
			boardRefId,
			x: centerCm.x - widthCm / 2,
			y: centerCm.y - heightCm / 2,
			rotationDeg: 0,
		};
		set((state) => ({ boards: [...state.boards, board] }));
		return uid;
	},
	moveBoard: (uid, xCm, yCm) =>
		set((state) => ({
			boards: state.boards.map((board) =>
				board.uid === uid ? { ...board, x: xCm, y: yCm } : board,
			),
		})),
	rotateBoard: (uid, rotationDeg) =>
		set((state) => ({
			boards: state.boards.map((board) =>
				board.uid === uid ? { ...board, rotationDeg } : board,
			),
		})),
	removeBoard: (uid) =>
		set((state) => {
			const board = state.boards.find((candidate) => candidate.uid === uid);
			if (!board) return state;
			return {
				boards: state.boards.filter((candidate) => candidate.uid !== uid),
				// Keep the user's work: attached items fall loose where they sit.
				items: state.items.map((item) => {
					if (item.boardUid !== uid) return item;
					const world = boardToWorld({ x: item.x, y: item.y }, board);
					return { ...item, boardUid: null, x: world.x, y: world.y };
				}),
			};
		}),
}));
