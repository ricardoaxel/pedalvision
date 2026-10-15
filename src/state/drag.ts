import { create } from "zustand";
import type { Point } from "../lib/geometry";

/**
 * Transient pointer-drag state for pedals (design.md §Canvas architecture →
 * DragLayer). A pointer-down on a pedal starts a *candidate*; once the pointer
 * passes a small threshold the item is *lifted* into the world-space DragLayer
 * (so it renders unskewed and its Transformer travels with it). On release the
 * item is re-parented (`scene.dropItem`); if a two-finger pan interrupts the
 * drag, the item drops in place. None of this is scene data.
 */
export interface DragCandidate {
	uid: string;
	/** Client-space pointer position where the press began. */
	startClient: Point;
}

interface DragState {
	/** Pointer-down on a pedal below the move threshold (no lift yet). */
	candidate: DragCandidate | null;
	/** The item currently lifted into the DragLayer. */
	liftedUid: string | null;
	/** Live world-cm origin of the lifted item. */
	liftedWorldCm: Point | null;
	/** Begin tracking a possible drag (pointer-down on an item). */
	beginCandidate: (candidate: DragCandidate) => void;
	/** Promote the candidate to a lift at its current world-cm origin. */
	lift: (uid: string, worldCm: Point) => void;
	/** Update a lifted item's world-cm origin as the pointer moves. */
	setLiftedWorldCm: (worldCm: Point) => void;
	/** End the drag (committed elsewhere) and reset. */
	clear: () => void;
}

export const useDrag = create<DragState>((set) => ({
	candidate: null,
	liftedUid: null,
	liftedWorldCm: null,
	beginCandidate: (candidate) => set({ candidate }),
	lift: (uid, worldCm) =>
		set({ candidate: null, liftedUid: uid, liftedWorldCm: worldCm }),
	setLiftedWorldCm: (worldCm) => set({ liftedWorldCm: worldCm }),
	clear: () => set({ candidate: null, liftedUid: null, liftedWorldCm: null }),
}));
