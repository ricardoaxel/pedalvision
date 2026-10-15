import { create } from "zustand";

/**
 * Transient selection state — which board (if any) currently shows its
 * Transformer. Not part of the persisted scene document (design.md §Data
 * model). P1-05 replaces this with the full selection model (multi-item,
 * pedals, anchors); P1-03 only needs a single selected board.
 */
interface SelectionStore {
	selectedBoardUid: string | null;
	selectBoard: (uid: string | null) => void;
}

export const useSelection = create<SelectionStore>((set) => ({
	selectedBoardUid: null,
	selectBoard: (uid) => set({ selectedBoardUid: uid }),
}));
