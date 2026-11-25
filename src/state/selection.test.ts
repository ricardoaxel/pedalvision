import { beforeEach, describe, expect, it } from "vitest";
import {
	selectCableDimFocus,
	selectHoveredBoardUid,
	selectHoveredCableUid,
	selectHoveredEndpointUid,
	selectHoveredItemUid,
	selectSelectedBoardUid,
	selectSelectedItemUid,
	useSelection,
} from "./selection";

describe("selection store", () => {
	beforeEach(() => {
		useSelection.setState({ selection: null, hoveredTarget: null });
	});

	it("starts empty", () => {
		const state = useSelection.getState();
		expect(state.selection).toBeNull();
		expect(state.hoveredTarget).toBeNull();
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
		useSelection.getState().setHoveredTarget({ uid: "item-2", kind: "item" });
		useSelection.getState().clearSelection();
		expect(useSelection.getState().selection).toBeNull();
		expect(selectHoveredItemUid(useSelection.getState())).toBe("item-2");
	});

	it("tracks a hovered target by kind", () => {
		useSelection.getState().setHoveredTarget({ uid: "item-7", kind: "item" });
		const itemState = useSelection.getState();
		expect(selectHoveredItemUid(itemState)).toBe("item-7");
		expect(selectHoveredBoardUid(itemState)).toBeNull();
		expect(selectHoveredCableUid(itemState)).toBeNull();
		expect(selectHoveredEndpointUid(itemState)).toBeNull();

		useSelection.getState().setHoveredTarget({ uid: "board-2", kind: "board" });
		const boardState = useSelection.getState();
		expect(selectHoveredBoardUid(boardState)).toBe("board-2");
		expect(selectHoveredItemUid(boardState)).toBeNull();

		useSelection.getState().setHoveredTarget({ uid: "cable-3", kind: "cable" });
		const cableState = useSelection.getState();
		expect(selectHoveredCableUid(cableState)).toBe("cable-3");
		expect(selectHoveredItemUid(cableState)).toBeNull();

		useSelection
			.getState()
			.setHoveredTarget({ uid: "endpoint-4", kind: "endpoint" });
		const endpointState = useSelection.getState();
		expect(selectHoveredEndpointUid(endpointState)).toBe("endpoint-4");
		expect(selectHoveredItemUid(endpointState)).toBeNull();

		useSelection.getState().setHoveredTarget(null);
		expect(useSelection.getState().hoveredTarget).toBeNull();
	});

	it("only an item hover feeds the incident-cable dim focus", () => {
		useSelection.getState().setHoveredTarget({ uid: "cable-1", kind: "cable" });
		expect(selectCableDimFocus(useSelection.getState())).toBeNull();

		useSelection.getState().setHoveredTarget({ uid: "board-1", kind: "board" });
		expect(selectCableDimFocus(useSelection.getState())).toBeNull();

		useSelection
			.getState()
			.setHoveredTarget({ uid: "endpoint-1", kind: "endpoint" });
		expect(selectCableDimFocus(useSelection.getState())).toBeNull();

		useSelection.getState().setHoveredTarget({ uid: "item-1", kind: "item" });
		expect(selectCableDimFocus(useSelection.getState())).toBe("item-1");

		useSelection.getState().selectEndpoint("endpoint-2");
		useSelection.getState().setHoveredTarget(null);
		expect(selectCableDimFocus(useSelection.getState())).toBe("endpoint-2");
	});
});
