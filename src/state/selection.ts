import { create } from "zustand";

/** Which kind of scene object a selection points at. */
export type SelectionKind = "board" | "item";

/** The single selected object (uid + kind). */
export interface Selection {
	uid: string;
	kind: SelectionKind;
}

/**
 * Transient selection state — the `(uid, kind)` of the object whose Transformer
 * + action bar are showing, plus the item under the desktop pointer (hover
 * outline). Not part of the persisted scene document (design.md §Data model).
 * Selecting a board or an item replaces the previous selection, so only one
 * Transformer/action bar is ever attached (P1-05).
 */
interface SelectionStore {
	/** The selected object, or null. */
	selection: Selection | null;
	/** Item under the pointer for the desktop hover outline (null on touch). */
	hoveredItemUid: string | null;
	/** Select a board (clears any item selection); `null` clears selection. */
	selectBoard: (uid: string | null) => void;
	/** Select an item (clears any board selection); `null` clears selection. */
	selectItem: (uid: string | null) => void;
	/** Set/clear the desktop hover target (item only). */
	setHoveredItem: (uid: string | null) => void;
	/** Clear the selection (empty-canvas tap). */
	clearSelection: () => void;
}

export const useSelection = create<SelectionStore>((set) => ({
	selection: null,
	hoveredItemUid: null,
	selectBoard: (uid) => set({ selection: uid ? { uid, kind: "board" } : null }),
	selectItem: (uid) => set({ selection: uid ? { uid, kind: "item" } : null }),
	setHoveredItem: (uid) => set({ hoveredItemUid: uid }),
	clearSelection: () => set({ selection: null }),
}));

/** The selected board uid, or null when an item (or nothing) is selected. */
export function selectSelectedBoardUid(state: SelectionStore): string | null {
	return state.selection?.kind === "board" ? state.selection.uid : null;
}

/** The selected item uid, or null when a board (or nothing) is selected. */
export function selectSelectedItemUid(state: SelectionStore): string | null {
	return state.selection?.kind === "item" ? state.selection.uid : null;
}
