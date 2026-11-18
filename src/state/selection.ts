import { create } from "zustand";

/** Which kind of scene object a selection points at. */
export type SelectionKind = "board" | "item" | "endpoint" | "cable";

/** The single selected object (uid + kind). */
export interface Selection {
	uid: string;
	kind: SelectionKind;
}

/** The object under the desktop pointer for a hover preview (F-07). */
export interface HoveredTarget {
	uid: string;
	kind: SelectionKind;
}

/**
 * Transient selection state — the `(uid, kind)` of the object whose Transformer
 * + action bar are showing, plus the object under the desktop pointer (hover
 * preview). Not part of the persisted scene document (design.md §Data model).
 * Selecting a board or an item replaces the previous selection, so only one
 * Transformer/action bar is ever attached (P1-05).
 */
interface SelectionStore {
	/** The selected object, or null. */
	selection: Selection | null;
	/** Object under the pointer for the desktop hover preview (null on touch). */
	hoveredTarget: HoveredTarget | null;
	/** Select a board (clears any item selection); `null` clears selection. */
	selectBoard: (uid: string | null) => void;
	/** Select an item (clears any board selection); `null` clears selection. */
	selectItem: (uid: string | null) => void;
	/** Select an amp/instrument endpoint (P4-02); `null` clears selection. */
	selectEndpoint: (uid: string | null) => void;
	/** Select a cable (P4-02); `null` clears selection. */
	selectCable: (uid: string | null) => void;
	/** Set/clear the desktop hover target. */
	setHoveredTarget: (target: HoveredTarget | null) => void;
	/** Clear the selection (empty-canvas tap). */
	clearSelection: () => void;
}

export const useSelection = create<SelectionStore>((set) => ({
	selection: null,
	hoveredTarget: null,
	selectBoard: (uid) => set({ selection: uid ? { uid, kind: "board" } : null }),
	selectItem: (uid) => set({ selection: uid ? { uid, kind: "item" } : null }),
	selectEndpoint: (uid) =>
		set({ selection: uid ? { uid, kind: "endpoint" } : null }),
	selectCable: (uid) => set({ selection: uid ? { uid, kind: "cable" } : null }),
	setHoveredTarget: (target) => set({ hoveredTarget: target }),
	clearSelection: () => set({ selection: null }),
}));

/** The hovered item uid, or null (used by the pedal hover outline). */
export function selectHoveredItemUid(state: SelectionStore): string | null {
	return state.hoveredTarget?.kind === "item" ? state.hoveredTarget.uid : null;
}

/** The hovered cable uid, or null. */
export function selectHoveredCableUid(state: SelectionStore): string | null {
	return state.hoveredTarget?.kind === "cable" ? state.hoveredTarget.uid : null;
}

/** The hovered endpoint uid, or null. */
export function selectHoveredEndpointUid(state: SelectionStore): string | null {
	return state.hoveredTarget?.kind === "endpoint"
		? state.hoveredTarget.uid
		: null;
}

/** The hovered board uid, or null. */
export function selectHoveredBoardUid(state: SelectionStore): string | null {
	return state.hoveredTarget?.kind === "board" ? state.hoveredTarget.uid : null;
}

/**
 * The object whose incident cables stay lit (F-07): a selected item, a hovered
 * **item** (never a hovered cable/board/endpoint), or a selected endpoint.
 * Hovering one cable must not dim every other cable.
 */
export function selectCableDimFocus(state: SelectionStore): string | null {
	const selectedItem = selectSelectedItemUid(state);
	const hoveredItem = selectHoveredItemUid(state);
	const selectedEndpoint =
		state.selection?.kind === "endpoint" ? state.selection.uid : null;
	return selectedItem ?? hoveredItem ?? selectedEndpoint;
}

/** The selected board uid, or null when an item (or nothing) is selected. */
export function selectSelectedBoardUid(state: SelectionStore): string | null {
	return state.selection?.kind === "board" ? state.selection.uid : null;
}

/** The selected item uid, or null when a board (or nothing) is selected. */
export function selectSelectedItemUid(state: SelectionStore): string | null {
	return state.selection?.kind === "item" ? state.selection.uid : null;
}

/** The selected endpoint uid, or null. */
export function selectSelectedEndpointUid(
	state: SelectionStore,
): string | null {
	return state.selection?.kind === "endpoint" ? state.selection.uid : null;
}

/** The selected cable uid, or null. */
export function selectSelectedCableUid(state: SelectionStore): string | null {
	return state.selection?.kind === "cable" ? state.selection.uid : null;
}
