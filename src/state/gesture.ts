import { create } from "zustand";

/**
 * Transient gesture state. `navigating` is true while the viewport owns the
 * pointer gesture (a one-finger pan or a two-finger pinch). While it is true,
 * board dragging + rotation are suppressed so an object interaction can't fight
 * the viewport navigation (Copilot review, 2026-10-15).
 */
interface GestureState {
	navigating: boolean;
	setNavigating: (navigating: boolean) => void;
}

export const useGesture = create<GestureState>((set) => ({
	navigating: false,
	setNavigating: (navigating) => set({ navigating }),
}));
