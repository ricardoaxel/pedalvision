import { create } from "zustand";

/**
 * Read-only recipient mode (P3-03). A shared scene is previewed in the normal
 * scene store so the canvas/export code needs no second rendering path, but
 * every mutation must be a no-op while this flag is set. Hiding the editing
 * chrome is the primary guard; the scene-store checks are defence in depth
 * (keyboard shortcuts, future callers).
 */
interface ReadOnlyStore {
	readOnly: boolean;
	setReadOnly: (readOnly: boolean) => void;
}

export const useReadOnly = create<ReadOnlyStore>((set) => ({
	readOnly: false,
	setReadOnly: (readOnly) => set({ readOnly }),
}));

/** Non-reactive read for store actions and event handlers. */
export function isReadOnly(): boolean {
	return useReadOnly.getState().readOnly;
}
