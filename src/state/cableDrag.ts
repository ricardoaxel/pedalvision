import { create } from "zustand";
import type { Point } from "../lib/geometry";

/**
 * Transient drag-connect state (P4-02). Nothing here is scene data: a pointer
 * press on a jack tick starts a source, pointermove updates the preview, and a
 * single `addCable` commit happens on release. This keeps history and autosave
 * to exactly one step (P4-01 performance finding).
 */
export interface CableDragSource {
	itemUid: string;
	jackIndex: number;
}

export type CableDragTarget =
	| { kind: "item"; uid: string; jackIndex: number }
	| { kind: "endpoint"; uid: string };

interface CableDragState {
	source: CableDragSource | null;
	/** Live pointer position in world cm (preview path end). */
	pointerWorldCm: Point | null;
	/** The jack/endpoint under the pointer, snapped within the hit threshold. */
	target: CableDragTarget | null;
	/** Inline refusal after a failed commit (duplicate / graph cap). */
	notice: string | null;
	begin: (source: CableDragSource) => void;
	/** Set/clear the inline refusal (cleared when a new drag starts). */
	setNotice: (notice: string | null) => void;
	setPointer: (point: Point) => void;
	setTarget: (target: CableDragTarget | null) => void;
	/** One store update per pointermove; keeps the target reference stable. */
	update: (point: Point, target: CableDragTarget | null) => void;
	cancel: () => void;
}

export const useCableDrag = create<CableDragState>((set) => ({
	source: null,
	pointerWorldCm: null,
	target: null,
	notice: null,
	begin: (source) =>
		set({ source, pointerWorldCm: null, target: null, notice: null }),
	setNotice: (notice) => set({ notice }),
	setPointer: (pointerWorldCm) => set({ pointerWorldCm }),
	setTarget: (target) => set({ target }),
	update: (pointerWorldCm, target) =>
		set((state) => ({
			pointerWorldCm,
			target: sameTarget(state.target, target) ? state.target : target,
		})),
	cancel: () => set({ source: null, pointerWorldCm: null, target: null }),
}));

/** Same destination identity? Keeps the store reference stable per move. */
function sameTarget(
	a: CableDragTarget | null,
	b: CableDragTarget | null,
): boolean {
	if (a === b) return true;
	if (!a || !b || a.kind !== b.kind) return false;
	if (a.kind === "endpoint" && b.kind === "endpoint") return a.uid === b.uid;
	if (a.kind === "item" && b.kind === "item") {
		return a.uid === b.uid && a.jackIndex === b.jackIndex;
	}
	return false;
}

/** Is `target` a valid destination for `source` (not the identical jack)? */
export function isCableTargetValid(
	source: CableDragSource,
	target: CableDragTarget,
): boolean {
	return !(
		target.kind === "item" &&
		target.uid === source.itemUid &&
		target.jackIndex === source.jackIndex
	);
}
