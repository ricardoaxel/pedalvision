import { create } from "zustand";
import { catalog } from "../catalog/load";
import type { CatalogBoard } from "../catalog/schema";
import type { Point } from "../lib/geometry";

/**
 * The scene document (design.md §Data model). Only the boards slice exists so
 * far — pedals/cables/endpoints arrive in later tasks. All geometry is in cm,
 * world coordinates; pixels are computed at render time only.
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

const BOARD_BY_ID = new Map<string, CatalogBoard>(
	catalog.boards.map((board) => [board.id, board]),
);

/** Used only when a board has neither a known ref nor a custom size. */
export const FALLBACK_BOARD_CM = { widthCm: 40, heightCm: 20 };

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

interface SceneStore {
	boards: PlacedBoard[];
	/**
	 * Add a catalog board centred on `centerCm` (world cm), returning its uid.
	 * Stored `x`/`y` is the board's origin (top-left), so the caller stays free
	 * of footprint math; see `viewportCenterCm` for the usual "drop at centre".
	 */
	addBoard: (boardRefId: string, centerCm: Point) => string;
	moveBoard: (uid: string, xCm: number, yCm: number) => void;
	rotateBoard: (uid: string, rotationDeg: number) => void;
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
		set((state) => ({
			boards: state.boards.filter((board) => board.uid !== uid),
		})),
}));
