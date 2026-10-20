import { beforeEach, describe, expect, it } from "vitest";
import { catalog } from "../catalog/load";
import {
	captureScene,
	clearHistory,
	flushHistory,
	HISTORY_LIMIT,
	HISTORY_SCENE_KEYS,
	redo,
	undo,
	useHistory,
} from "./history";
import { useReadOnly } from "./readOnly";
import type { PlacedBoard, PlacedItem } from "./scene";
import { useScene } from "./scene";
import { useSelection } from "./selection";
import { useViewport } from "./viewport";

const pedalId = catalog.pedals[0]?.id;
const boardId = catalog.boards[0]?.id;
if (!pedalId || !boardId)
	throw new Error("test fixtures missing from the catalog seed");

function reset(): void {
	useScene.setState({ boards: [], items: [], customPedals: [] });
	clearHistory();
	useReadOnly.setState({ readOnly: false });
	useSelection.setState({ selection: null, hoveredItemUid: null });
	useViewport.setState({ scale: 1, x: 0, y: 0 });
}

function addPedal(x = 0): string {
	const uid = useScene.getState().addItem(pedalId, "pedal", null, { x, y: 0 });
	if (!uid) throw new Error("expected the add to succeed");
	flushHistory();
	return uid;
}

function addBoard(): string {
	const uid = useScene.getState().addBoard(boardId, { x: 20, y: 10 });
	if (!uid) throw new Error("expected the board add to succeed");
	flushHistory();
	return uid;
}

beforeEach(() => {
	reset();
});

describe("undo/redo history", () => {
	it("round-trips boards, items and inline custom pedals exactly", () => {
		const board = addBoard();
		const item = addPedal(2);
		useScene.getState().rotateItem(item, 37.5);
		useScene.getState().dropItem(item, { x: 3, y: 4 }, 12);
		flushHistory();
		const beforeCustom = captureScene();

		// Definition + placement land in one snapshot and restore together.
		const refId = useScene.getState().addCustomPedal({
			brand: "Homebrew",
			name: "Fuzz",
			widthCm: 7,
			heightCm: 12,
			category: "pedal",
			effectTypes: [],
		});
		if (!refId) throw new Error("expected the custom pedal to register");
		useScene.getState().addItem(refId, "pedal", null, { x: 1, y: 1 });
		flushHistory();
		expect(captureScene().customPedals).toHaveLength(1);

		expect(undo()).toBe(true);
		expect(captureScene()).toEqual(beforeCustom);
		expect(redo()).toBe(true);
		expect(captureScene().customPedals).toHaveLength(1);
		expect(captureScene().items).toHaveLength(2);

		const afterCustom = captureScene();
		useScene.getState().moveBoard(board, 5, 6);
		flushHistory();
		expect(undo()).toBe(true);
		expect(captureScene()).toEqual(afterCustom);
		expect(redo()).toBe(true);
		expect(useScene.getState().boards[0].x).toBe(5);
	});

	it("coalesces a synchronous burst via the production microtask", async () => {
		// No flushHistory: the real queueMicrotask coalescer must produce one step.
		const refId = useScene.getState().addCustomPedal({
			brand: "Homebrew",
			name: "Fuzz",
			widthCm: 7,
			heightCm: 12,
			category: "pedal",
			effectTypes: [],
		});
		if (!refId) throw new Error("expected the custom pedal to register");
		useScene.getState().addItem(refId, "pedal", null, { x: 1, y: 1 });
		await Promise.resolve();
		expect(useHistory.getState().past).toHaveLength(1);

		useScene.getState().addItem(pedalId, "pedal", null, { x: 5, y: 5 });
		await Promise.resolve();
		expect(useHistory.getState().past).toHaveLength(2);
	});

	it("keeps the newest 50 snapshots", () => {
		for (let index = 0; index < HISTORY_LIMIT + 5; index++) addPedal(index);
		expect(useHistory.getState().past).toHaveLength(HISTORY_LIMIT);
		let steps = 0;
		while (undo()) steps += 1;
		expect(steps).toBe(HISTORY_LIMIT);
		// Five oldest snapshots were dropped, so five items had already been there.
		expect(useScene.getState().items).toHaveLength(5);
	});

	it("clears redo when a new edit lands", () => {
		addPedal(0);
		addPedal(1);
		flushHistory();
		expect(undo()).toBe(true);
		expect(useHistory.getState().future).toHaveLength(1);
		addPedal(9);
		expect(useHistory.getState().future).toHaveLength(0);
		expect(redo()).toBe(false);
	});

	it("is a no-op at the extremes and records nothing for no-op edits", () => {
		const before = captureScene();
		expect(undo()).toBe(false);
		expect(redo()).toBe(false);
		expect(captureScene()).toEqual(before);
		expect(useHistory.getState()).toMatchObject({ past: [], future: [] });

		const first = addPedal(0);
		const second = addPedal(1);
		flushHistory();
		// `second` is already on top: forward is a documented no-op.
		useScene.getState().reorder(second, "forward");
		flushHistory();
		expect(undo()).toBe(true);
		// One undo removes `second`; the no-op reorder added no step.
		expect(useScene.getState().items.map((item) => item.uid)).not.toContain(
			second,
		);
		expect(useScene.getState().items.map((item) => item.uid)).toContain(first);
	});

	it("makes custom-pedal creation (definition + placement) one step", () => {
		const depth = useHistory.getState().past.length;
		const refId = useScene.getState().addCustomPedal({
			brand: "Homebrew",
			name: "Fuzz",
			widthCm: 7,
			heightCm: 12,
			category: "pedal",
			effectTypes: [],
		});
		if (!refId) throw new Error("expected the custom pedal to register");
		useScene.getState().addItem(refId, "pedal", null, { x: 1, y: 2 });
		flushHistory();
		expect(useHistory.getState().past).toHaveLength(depth + 1);
		expect(useScene.getState().customPedals).toHaveLength(1);

		expect(undo()).toBe(true);
		expect(useScene.getState().customPedals).toHaveLength(0);
		expect(useScene.getState().items).toHaveLength(0);

		expect(redo()).toBe(true);
		expect(useScene.getState().customPedals).toHaveLength(1);
		expect(useScene.getState().items).toHaveLength(1);
		expect(useScene.getState().items[0].refId).toBe(refId);
	});

	it("makes a board transform (rotate + origin shift) one step", () => {
		const board = addBoard();
		const original = useScene.getState().boards[0];
		const depth = useHistory.getState().past.length;
		useScene.getState().rotateBoard(board, 45);
		useScene.getState().moveBoard(board, 7, 8);
		flushHistory();
		expect(useHistory.getState().past).toHaveLength(depth + 1);
		expect(undo()).toBe(true);
		expect(useScene.getState().boards[0]).toEqual(original);
	});

	it("records add, duplicate, delete, z-order, edit and board delete as one step each", () => {
		const board = addBoard();
		const item = addPedal(0);
		addPedal(1);
		flushHistory();

		const scenesAfter: number[] = [];
		const depth = () => useHistory.getState().past.length;
		const step = (action: () => void) => {
			const before = depth();
			action();
			flushHistory();
			scenesAfter.push(depth() - before);
		};

		step(() => useScene.getState().duplicateItem(item));
		step(() => useScene.getState().reorder(item, "front"));
		step(() => useScene.getState().rotateItem(item, 10));
		step(() => useScene.getState().removeItem(item));
		step(() => useScene.getState().removeBoard(board));
		expect(scenesAfter).toEqual([1, 1, 1, 1, 1]);
	});

	it("does not record undo/redo themselves", () => {
		addPedal(0);
		const onAdd = useHistory.getState().past.length;
		undo();
		expect(useHistory.getState().past).toHaveLength(onAdd - 1);
		expect(useHistory.getState().future).toHaveLength(1);
		redo();
		expect(useHistory.getState().past).toHaveLength(onAdd);
		expect(useHistory.getState().future).toHaveLength(0);
	});

	it("does not touch selection or the viewport", () => {
		const item = addPedal(0);
		useSelection.getState().selectItem(item);
		useViewport.setState({ scale: 2, x: 30, y: -5 });
		const selection = useSelection.getState().selection;
		const viewport = useViewport.getState();

		undo();
		expect(useSelection.getState().selection).toEqual(selection);
		expect(useViewport.getState()).toMatchObject({
			scale: viewport.scale,
			x: viewport.x,
			y: viewport.y,
		});
		redo();
		expect(useSelection.getState().selection).toEqual(selection);
	});

	it("clearHistory empties both stacks (scene switch/new/boot)", () => {
		addPedal(0);
		addPedal(1);
		undo();
		expect(useHistory.getState().past.length).toBeGreaterThan(0);
		expect(useHistory.getState().future.length).toBeGreaterThan(0);
		clearHistory();
		expect(useHistory.getState()).toMatchObject({ past: [], future: [] });
		expect(undo()).toBe(false);
		expect(redo()).toBe(false);
	});

	it("is blocked in read-only share previews", () => {
		const item = addPedal(0);
		const before = captureScene();
		useReadOnly.setState({ readOnly: true });
		expect(undo()).toBe(false);
		expect(redo()).toBe(false);
		expect(captureScene()).toEqual(before);
		// Mutators stay no-ops too, so read-only never grows an editable history.
		useScene.getState().removeItem(item);
		flushHistory();
		expect(useScene.getState().items).toHaveLength(1);
	});

	it("restores a previously valid over-cap state without a capacity refusal", () => {
		const items: PlacedItem[] = Array.from({ length: 401 }, (_, index) => ({
			uid: `item-${index}`,
			refId: pedalId,
			kind: "pedal",
			boardUid: null,
			x: index,
			y: 0,
			rotationDeg: 0,
			z: index,
		}));
		useScene.setState({ boards: [], items, customPedals: [] });
		flushHistory();
		clearHistory();
		useScene.getState().removeItem(items[0].uid);
		flushHistory();

		expect(undo()).toBe(true);
		expect(useScene.getState().items).toHaveLength(401);
	});

	it("captures and restores every editable scene field (P4 extension point)", () => {
		const board: PlacedBoard = {
			uid: "b",
			boardRefId: boardId,
			x: 0,
			y: 0,
			rotationDeg: 0,
		};
		useScene.setState({
			boards: [board],
			items: [
				{
					uid: "i",
					refId: pedalId,
					kind: "pedal",
					boardUid: "b",
					x: 1,
					y: 1,
					rotationDeg: 0,
					z: 0,
				},
			],
			customPedals: [
				{
					refId: "custom-1",
					brand: "A",
					name: "B",
					widthCm: 7,
					heightCm: 12,
					category: "pedal",
					effectTypes: [],
				},
			],
		});
		flushHistory();
		const before = captureScene();
		// The `satisfies Record<keyof SceneSnapshot, true>` map makes this set
		// exhaustive at compile time: P4 must add cables/endpoints there.
		expect(Object.keys(before).sort()).toEqual([...HISTORY_SCENE_KEYS].sort());

		useScene.getState().removeItem("i");
		flushHistory();
		expect(undo()).toBe(true);
		expect(captureScene()).toEqual(before);
	});
});
