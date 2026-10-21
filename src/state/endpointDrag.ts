import { create } from "zustand";
import type { Point } from "../lib/geometry";

/**
 * Transient endpoint-drag state (P4-02). While the endpoint tag is dragged its
 * world cm lives here so incident cables follow frame-by-frame; the scene store
 * is written exactly once on pointerup (one history step, one autosave).
 */
interface EndpointDragState {
	uid: string | null;
	worldCm: Point | null;
	begin: (uid: string, worldCm: Point) => void;
	setWorldCm: (worldCm: Point) => void;
	clear: () => void;
}

export const useEndpointDrag = create<EndpointDragState>((set) => ({
	uid: null,
	worldCm: null,
	begin: (uid, worldCm) => set({ uid, worldCm }),
	setWorldCm: (worldCm) => set({ worldCm }),
	clear: () => set({ uid: null, worldCm: null }),
}));
