import { create } from "zustand";

/**
 * Read-only recipient mode (P3-03). A shared scene is previewed in the normal
 * scene store so the canvas/export code needs no second rendering path, but
 * every mutation must be a no-op while this flag is set. Hiding the editing
 * chrome is the primary guard; the scene-store checks are defence in depth
 * (keyboard shortcuts, future callers).
 */
export interface ReadOnlyAttempt {
	uid: string;
	kind: "item" | "board";
	startClient: { x: number; y: number };
}

export interface ReadOnlyCue {
	uid: string;
	kind: "item" | "board";
	/** Changes on every attempt so the inline cue restarts its dismiss timer. */
	nonce: number;
}

interface ReadOnlyStore {
	readOnly: boolean;
	/** A pointer-down that could become a drag in read-only mode. */
	attempt: ReadOnlyAttempt | null;
	/** The inline "can't edit a shared copy" cue, tied to the attempted object. */
	cue: ReadOnlyCue | null;
	setReadOnly: (readOnly: boolean) => void;
	beginAttempt: (attempt: ReadOnlyAttempt) => void;
	cancelAttempt: () => void;
	showCue: () => void;
	/** Keyboard/edit path with no pointer attempt (e.g. Delete/Cmd-D). */
	showCueFor: (uid: string, kind: ReadOnlyAttempt["kind"]) => void;
	clearCue: () => void;
}

export const useReadOnly = create<ReadOnlyStore>((set) => ({
	readOnly: false,
	attempt: null,
	cue: null,
	setReadOnly: (readOnly) =>
		set({
			readOnly,
			attempt: null,
			cue: null,
		}),
	beginAttempt: (attempt) =>
		set((state) => (state.readOnly ? { attempt } : state)),
	cancelAttempt: () => set({ attempt: null }),
	showCue: () =>
		set((state) => {
			if (!state.attempt) return state;
			return {
				attempt: null,
				cue: {
					uid: state.attempt.uid,
					kind: state.attempt.kind,
					nonce: Date.now(),
				},
			};
		}),
	showCueFor: (uid, kind) =>
		set({ attempt: null, cue: { uid, kind, nonce: Date.now() } }),
	clearCue: () => set({ cue: null }),
}));

/** Non-reactive read for store actions and event handlers. */
export function isReadOnly(): boolean {
	return useReadOnly.getState().readOnly;
}
