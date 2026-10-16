import { beforeEach, describe, expect, it } from "vitest";
import { catalog } from "../catalog/load";
import { itemsByZ, type PlacedItem, reorderItems, useScene } from "./scene";

const boss = catalog.boards.find((board) => board.id === "boss-bcb-1000");
if (!boss) throw new Error("test fixture board missing from the seed");

const PEDAL = "boss-bd-2-blues-driver";

/** A minimal loose item fixture with an explicit z. */
function fixture(
	uid: string,
	z: number,
	boardUid: string | null = null,
): PlacedItem {
	return {
		uid,
		refId: PEDAL,
		kind: "pedal",
		boardUid,
		x: 0,
		y: 0,
		rotationDeg: 0,
		z,
	};
}

/** uid → z lookup for the store's current items. */
function zByUid(items: PlacedItem[]): Record<string, number> {
	return Object.fromEntries(items.map((item) => [item.uid, item.z]));
}

describe("reorderItems (pure)", () => {
	it("brings an item forward / sends it back one step", () => {
		const items = [fixture("a", 0), fixture("b", 1), fixture("c", 2)];
		expect(zByUid(reorderItems(items, "a", "forward"))).toEqual({
			b: 0,
			a: 1,
			c: 2,
		});
		expect(zByUid(reorderItems(items, "c", "back"))).toEqual({
			a: 0,
			c: 1,
			b: 2,
		});
	});

	it("jumps an item to the front / bottom", () => {
		const items = [fixture("a", 0), fixture("b", 1), fixture("c", 2)];
		expect(zByUid(reorderItems(items, "a", "front"))).toEqual({
			b: 0,
			c: 1,
			a: 2,
		});
		expect(zByUid(reorderItems(items, "c", "bottom"))).toEqual({
			c: 0,
			a: 1,
			b: 2,
		});
	});

	it("is a no-op at the extremes", () => {
		const items = [fixture("a", 0), fixture("b", 1), fixture("c", 2)];
		expect(zByUid(reorderItems(items, "c", "forward"))).toEqual({
			a: 0,
			b: 1,
			c: 2,
		});
		expect(zByUid(reorderItems(items, "c", "front"))).toEqual({
			a: 0,
			b: 1,
			c: 2,
		});
		expect(zByUid(reorderItems(items, "a", "back"))).toEqual({
			a: 0,
			b: 1,
			c: 2,
		});
		expect(zByUid(reorderItems(items, "a", "bottom"))).toEqual({
			a: 0,
			b: 1,
			c: 2,
		});
	});

	it("re-normalises a gappy container to dense 0..n-1", () => {
		// z 0,5,1 → visual order a, c, b; after any reorder z is dense.
		const items = [fixture("a", 0), fixture("b", 5), fixture("c", 1)];
		expect(zByUid(reorderItems(items, "b", "forward"))).toEqual({
			a: 0,
			b: 2,
			c: 1,
		});
		expect(zByUid(reorderItems(items, "a", "front"))).toEqual({
			c: 0,
			b: 1,
			a: 2,
		});
	});

	it("only touches the item's own container", () => {
		const items = [
			fixture("board-a", 0, "board"),
			fixture("board-b", 1, "board"),
			fixture("loose-a", 0),
			fixture("loose-b", 1),
		];
		const next = reorderItems(items, "board-b", "bottom");
		// Board container swapped; loose container untouched.
		expect(zByUid(next)).toEqual({
			"board-b": 0,
			"board-a": 1,
			"loose-a": 0,
			"loose-b": 1,
		});
	});

	it("returns the input untouched for an unknown uid", () => {
		const items = [fixture("a", 0)];
		expect(reorderItems(items, "nope", "front")).toBe(items);
	});
});

describe("itemsByZ", () => {
	it("sorts ascending by z (later draws on top), stable on ties", () => {
		const items = [fixture("a", 2), fixture("b", 0), fixture("c", 1)];
		expect(itemsByZ(items).map((item) => item.uid)).toEqual(["b", "c", "a"]);
	});
});

describe("scene reorder integration", () => {
	beforeEach(() => {
		useScene.setState({ boards: [], items: [] });
	});

	it("keeps z dense per container after a removal, then reorders", () => {
		const boardUid = useScene.getState().addBoard(boss.id, { x: 0, y: 0 });
		const a = useScene
			.getState()
			.addItem(PEDAL, "pedal", boardUid, { x: 0, y: 0 });
		const b = useScene
			.getState()
			.addItem(PEDAL, "pedal", boardUid, { x: 1, y: 0 });
		const c = useScene
			.getState()
			.addItem(PEDAL, "pedal", boardUid, { x: 2, y: 0 });

		// Removing the middle item closes the gap (dense again).
		useScene.getState().removeItem(b);
		expect(zByUid(useScene.getState().items)).toEqual({ [a]: 0, [c]: 1 });

		// Bring the (now bottom) item to the front.
		useScene.getState().reorder(a, "front");
		expect(zByUid(useScene.getState().items)).toEqual({ [c]: 0, [a]: 1 });
	});

	it("lands an item on top when it is dropped into a new container", () => {
		const boardUid = useScene.getState().addBoard(boss.id, { x: 0, y: 0 });
		useScene.getState().moveBoard(boardUid, 100, 50);
		useScene.getState().addItem(PEDAL, "pedal", boardUid, { x: 5, y: 5 });
		useScene.getState().addItem(PEDAL, "pedal", boardUid, { x: 20, y: 5 });

		const loose = useScene
			.getState()
			.addItem(PEDAL, "pedal", null, { x: 0, y: 0 });
		// Drop the loose item onto the board (its visible centre lands inside).
		useScene.getState().dropItem(loose, { x: 105, y: 55 }, 0);

		const item = useScene
			.getState()
			.items.find((candidate) => candidate.uid === loose);
		expect(item?.boardUid).toBe(boardUid);
		expect(item?.z).toBe(2);
	});

	it("re-normalises the loose container when a board is removed", () => {
		const boardUid = useScene.getState().addBoard(boss.id, { x: 0, y: 0 });
		useScene.getState().addItem(PEDAL, "pedal", boardUid, { x: 0, y: 0 });
		useScene.getState().addItem(PEDAL, "pedal", boardUid, { x: 1, y: 0 });
		// A loose item already occupies loose z 0.
		useScene.getState().addItem(PEDAL, "pedal", null, { x: 0, y: 0 });

		useScene.getState().removeBoard(boardUid);
		const zs = useScene
			.getState()
			.items.map((item) => item.z)
			.sort((x, y) => x - y);
		// Board items become loose: the container is dense 0,1,2 (no collisions).
		expect(zs).toEqual([0, 1, 2]);
	});
});
