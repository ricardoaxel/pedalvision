import { beforeEach, describe, expect, it } from "vitest";
import {
	selectSelectedBoardUid,
	selectSelectedItemUid,
	useSelection,
} from "./selection";

describe("selection store", () => {
	beforeEach(() => {
		useSelection.setState({ selection: null, hoveredItemUid: null });
	});

	it("starts empty", () => {
		const state = useSelection.getState();
		expect(state.selection).toBeNull();
		expect(state.hoveredItemUid).toBeNull();
		expect(selectSelectedBoardUid(state)).toBeNull();
		expect(selectSelectedItemUid(state)).toBeNull();
	});

	it("selects a board with its kind", () => {
		useSelection.getState().selectBoard("board-1");
		const state = useSelection.getState();
		expect(state.selection).toEqual({ uid: "board-1", kind: "board" });
		expect(selectSelectedBoardUid(state)).toBe("board-1");
		expect(selectSelectedItemUid(state)).toBeNull();
	});

	it("selects an item with its kind", () => {
		useSelection.getState().selectItem("item-1");
		const state = useSelection.getState();
		expect(state.selection).toEqual({ uid: "item-1", kind: "item" });
		expect(selectSelectedItemUid(state)).toBe("item-1");
		expect(selectSelectedBoardUid(state)).toBeNull();
	});

	it("a board and an item selection are mutually exclusive", () => {
		useSelection.getState().selectItem("item-1");
		useSelection.getState().selectBoard("board-9");
		expect(useSelection.getState().selection).toEqual({
			uid: "board-9",
			kind: "board",
		});
		useSelection.getState().selectItem("item-2");
		expect(useSelection.getState().selection).toEqual({
			uid: "item-2",
			kind: "item",
		});
	});

	it("selecting null clears the selection", () => {
		useSelection.getState().selectItem("item-1");
		useSelection.getState().selectItem(null);
		expect(useSelection.getState().selection).toBeNull();
		useSelection.getState().selectBoard("board-1");
		useSelection.getState().selectBoard(null);
		expect(useSelection.getState().selection).toBeNull();
	});

	it("clearSelection drops the selection but not the hover", () => {
		useSelection.getState().selectItem("item-1");
		useSelection.getState().setHoveredItem("item-2");
		useSelection.getState().clearSelection();
		expect(useSelection.getState().selection).toBeNull();
		expect(useSelection.getState().hoveredItemUid).toBe("item-2");
	});

	it("tracks the hovered item independently", () => {
		useSelection.getState().setHoveredItem("item-7");
		expect(useSelection.getState().hoveredItemUid).toBe("item-7");
		useSelection.getState().setHoveredItem(null);
		expect(useSelection.getState().hoveredItemUid).toBeNull();
	});
});
