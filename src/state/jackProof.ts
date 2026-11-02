import { create } from "zustand";

/**
 * Transient “Press Proof” state (F-33). Nothing here is scene data: entering the
 * mode, selecting a jack row and dragging a canvas pin are UI state; the scene
 * commit happens once on release through `setJackOverride`.
 */
export interface JackProofDrag {
	uid: string;
	jack: number;
	/** Live normalized point on the pedal face. */
	x: number;
	y: number;
	/** Committed point at press (for Esc/cancel). */
	startX: number;
	startY: number;
	moved: boolean;
}

interface JackProofState {
	/** The item being proofed, or null when the mode is off. */
	activeUid: string | null;
	/** Row/pin selected for kind/TRS/reset/keyboard nudge. */
	selectedJack: number | null;
	drag: JackProofDrag | null;
	/** Inline refusal from a failed commit (ledger, never a toast). */
	notice: string | null;
	begin: (uid: string) => void;
	exit: () => void;
	select: (jack: number | null) => void;
	beginDrag: (uid: string, jack: number, x: number, y: number) => void;
	/** One store update per pointermove; keeps the drag object stable. */
	setDrag: (x: number, y: number, moved: boolean) => void;
	cancelDrag: () => void;
	endDrag: () => void;
	setNotice: (notice: string | null) => void;
}

export const useJackProof = create<JackProofState>((set, get) => ({
	activeUid: null,
	selectedJack: null,
	drag: null,
	notice: null,
	begin: (uid) =>
		set((state) => ({
			activeUid: uid,
			selectedJack: state.activeUid === uid ? state.selectedJack : 0,
			drag: null,
			notice: null,
		})),
	exit: () =>
		set({
			activeUid: null,
			selectedJack: null,
			drag: null,
			notice: null,
		}),
	select: (jack) => set({ selectedJack: jack, notice: null }),
	beginDrag: (uid, jack, x, y) =>
		set({
			activeUid: uid,
			selectedJack: jack,
			drag: { uid, jack, x, y, startX: x, startY: y, moved: false },
			notice: null,
		}),
	setDrag: (x, y, moved) => {
		const drag = get().drag;
		if (!drag) return;
		if (drag.x === x && drag.y === y && drag.moved === moved) return;
		set({ drag: { ...drag, x, y, moved } });
	},
	cancelDrag: () =>
		set((state) => (state.drag ? { drag: null, notice: null } : state)),
	endDrag: () => set((state) => (state.drag ? { drag: null } : state)),
	setNotice: (notice) => set({ notice }),
}));
