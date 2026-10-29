import { create } from "zustand";
import { ASSET_RENDITIONS, resolveImageUrl } from "../lib/cdn";
import { prefersReducedMotion } from "../lib/motion";
import {
	boardDefinition,
	boardFootprint,
	itemFootprint,
	itemVisualRotationDeg,
	itemWorldOrigin,
	resolveItem,
	useScene,
} from "./scene";

/**
 * Transient canvas motion (F-05). Nothing here is persisted, transported or
 * part of history: a pulse briefly emphasises a newly placed item, and a ghost
 * is a presentation-only farewell for an explicit delete. Scene data is always
 * mutated synchronously before/after these calls.
 */

export type ItemPulseKind = "add" | "duplicate";

export interface BoardPulse {
	uid: string;
	nonce: number;
}

export interface DepartingBoard {
	uid: string;
	nonce: number;
	/** World cm of the board's unrotated top-left. */
	xCm: number;
	yCm: number;
	rotationDeg: number;
	widthCm: number;
	heightCm: number;
	imageSrc: string | null;
	custom: boolean;
	/** Presentation delay (ms) before the fade starts. */
	delayMs: number;
}

export interface ItemPulse {
	uid: string;
	kind: ItemPulseKind;
	nonce: number;
}

export interface DepartingGhost {
	uid: string;
	nonce: number;
	/** World cm of the item's unrotated top-left (rotation is composed). */
	xCm: number;
	yCm: number;
	rotationDeg: number;
	widthCm: number;
	heightCm: number;
	/** Resolved canvas image, or null for a text-only custom part. */
	imageSrc: string | null;
}

interface MotionStore {
	pulse: ItemPulse | null;
	ghost: DepartingGhost | null;
	boardPulse: BoardPulse | null;
	boardGhost: DepartingBoard | null;
	/** Monotonic counters exposed to E2E (survive the transient clearing). */
	pulseSeq: number;
	ghostSeq: number;
	boardPulseSeq: number;
	boardGhostSeq: number;
	pulseItem: (uid: string, kind: ItemPulseKind) => void;
	clearPulse: (nonce: number) => void;
	departItem: (uid: string) => void;
	clearGhost: (uid: string) => void;
	pulseBoard: (uid: string) => void;
	clearBoardPulse: (nonce: number) => void;
	departBoard: (uid: string, delayMs?: number) => void;
	clearBoardGhost: (uid: string) => void;
}

export const useMotion = create<MotionStore>((set) => ({
	pulse: null,
	ghost: null,
	boardPulse: null,
	boardGhost: null,
	pulseSeq: 0,
	ghostSeq: 0,
	boardPulseSeq: 0,
	boardGhostSeq: 0,
	pulseItem: (uid, kind) => {
		if (prefersReducedMotion()) return;
		set((state) => {
			const nonce = state.pulseSeq + 1;
			return {
				pulseSeq: nonce,
				pulse: { uid, kind, nonce },
			};
		});
	},
	clearPulse: (nonce) =>
		set((state) => (state.pulse?.nonce === nonce ? { pulse: null } : state)),
	departItem: (uid) => {
		if (prefersReducedMotion()) return;
		const scene = useScene.getState();
		const item = scene.items.find((candidate) => candidate.uid === uid);
		if (!item) return;
		const origin = itemWorldOrigin(item, scene.boards);
		const footprint = itemFootprint(item, scene.customPedals);
		const resolved = resolveItem(item, scene.customPedals);
		const imageSrc = resolved.definition
			? resolveImageUrl(
					resolved.definition.imageSource,
					resolved.definition.image,
					"pedal",
					ASSET_RENDITIONS.canvas,
				)
			: null;
		set((state) => {
			const nonce = state.ghostSeq + 1;
			return {
				ghostSeq: nonce,
				ghost: {
					uid,
					nonce,
					xCm: origin.x,
					yCm: origin.y,
					rotationDeg: itemVisualRotationDeg(item, scene.boards),
					widthCm: footprint.widthCm,
					heightCm: footprint.heightCm,
					imageSrc,
				},
			};
		});
	},
	clearGhost: (uid) =>
		set((state) => (state.ghost?.uid === uid ? { ghost: null } : state)),
	pulseBoard: (uid) => {
		if (prefersReducedMotion()) return;
		set((state) => {
			const nonce = state.boardPulseSeq + 1;
			return { boardPulseSeq: nonce, boardPulse: { uid, nonce } };
		});
	},
	clearBoardPulse: (nonce) =>
		set((state) =>
			state.boardPulse?.nonce === nonce ? { boardPulse: null } : state,
		),
	departBoard: (uid, delayMs = 0) => {
		if (prefersReducedMotion()) return;
		const scene = useScene.getState();
		const board = scene.boards.find((candidate) => candidate.uid === uid);
		if (!board) return;
		const footprint = boardFootprint(board);
		const definition = boardDefinition(board);
		const imageSrc = definition
			? resolveImageUrl(
					definition.imageSource,
					definition.image,
					"board",
					ASSET_RENDITIONS.canvas,
				)
			: null;
		set((state) => {
			const nonce = state.boardGhostSeq + 1;
			return {
				boardGhostSeq: nonce,
				boardGhost: {
					uid,
					nonce,
					xCm: board.x,
					yCm: board.y,
					rotationDeg: board.rotationDeg,
					widthCm: footprint.widthCm,
					heightCm: footprint.heightCm,
					imageSrc,
					custom: definition === null,
					delayMs,
				},
			};
		});
	},
	clearBoardGhost: (uid) =>
		set((state) =>
			state.boardGhost?.uid === uid ? { boardGhost: null } : state,
		),
}));
