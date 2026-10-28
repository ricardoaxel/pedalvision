import { create } from "zustand";
import type { Point } from "../lib/geometry";

/** What the current measure endpoint snapped to. */
export type MeasureSnap =
	| "board"
	| "item"
	| "jack"
	| "endpoint"
	| "grid"
	| null;

interface MeasureStore {
	/** Measure mode is armed (drag to measure). */
	active: boolean;
	/** Start/end in world cm; null until a drag begins. */
	start: Point | null;
	end: Point | null;
	snapStart: MeasureSnap;
	snapEnd: MeasureSnap;
	setActive: (active: boolean) => void;
	toggle: () => void;
	startAt: (point: Point, snap: MeasureSnap) => void;
	moveTo: (point: Point, snap: MeasureSnap) => void;
	/** Clear the measurement but stay armed. */
	clear: () => void;
}

const cleared = {
	start: null,
	end: null,
	snapStart: null,
	snapEnd: null,
} as const;

/** Transient measure mode — never persisted, shared or exported. */
export const useMeasure = create<MeasureStore>((set) => ({
	active: false,
	...cleared,
	setActive: (active) =>
		set(active ? { active: true } : { active: false, ...cleared }),
	toggle: () =>
		set((state) =>
			state.active
				? { active: false, ...cleared }
				: { active: true, ...cleared },
		),
	startAt: (start, snapStart) =>
		set({ start, end: null, snapStart, snapEnd: null }),
	moveTo: (end, snapEnd) =>
		set((state) => (state.start ? { end, snapEnd } : state)),
	clear: () => set(cleared),
}));
