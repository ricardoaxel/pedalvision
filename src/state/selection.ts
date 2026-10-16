import { create } from "zustand";

/**
 * Transient selection state — which board and/or item currently show their
 * Transformer. Not part of the persisted scene document (design.md §Data
 * model). Selecting a board and selecting an item are mutually exclusive, so
 * only one Transformer is ever attached. P1-05 replaces this with the full
 * selection model (multi-item, hover, anchors); P1-04 needs one board + one
 * pedal.
 */
interface SelectionStore {
	selectedBoardUid: string | null;
	selectedItemUid: string | null;
	/** Select a board (clears any item selection when a uid is given). */
	selectBoard: (uid: string | null) => void;
	/** Select an item (clears any board selection when a uid is given). */
	selectItem: (uid: string | null) => void;
	/** Clear both (empty-canvas tap). */
	clearSelection: () => void;
}

export const useSelection = create<SelectionStore>((set) => ({
	selectedBoardUid: null,
	selectedItemUid: null,
	selectBoard: (uid) =>
		set(
			uid
				? { selectedBoardUid: uid, selectedItemUid: null }
				: { selectedBoardUid: null },
		),
	selectItem: (uid) =>
		set(
			uid
				? { selectedItemUid: uid, selectedBoardUid: null }
				: { selectedItemUid: null },
		),
	clearSelection: () => set({ selectedBoardUid: null, selectedItemUid: null }),
}));
