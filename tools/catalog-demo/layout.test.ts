import { describe, expect, it } from "vitest";
import {
	boardRowSnapshots,
	chainCables,
	chooseBoard,
	type DemoItem,
	packItems,
} from "./layout.ts";

const items = [
	{ id: "a", widthCm: 10, heightCm: 11.43, category: "pedal" as const },
	{ id: "b", widthCm: 18.42, heightCm: 11.43, category: "pedal" as const },
	{ id: "c", widthCm: 9.4, heightCm: 6.6, category: "pedal" as const },
];

describe("packItems", () => {
	it("lays items out inside the board without overlap", () => {
		const pack = packItems(items, { widthCm: 60.96, heightCm: 31.75 });
		expect(pack).not.toBeNull();
		expect(pack?.placements).toHaveLength(3);
		for (const placement of pack?.placements ?? []) {
			expect(placement.x).toBeGreaterThanOrEqual(0);
			expect(placement.y).toBeGreaterThanOrEqual(0);
			expect(placement.x + 18.42).toBeLessThanOrEqual(60.96);
			expect(placement.y + 11.43).toBeLessThanOrEqual(31.75);
		}
	});

	it("returns null when an item cannot fit", () => {
		expect(
			packItems(
				[{ id: "wide", widthCm: 70, heightCm: 10, category: "pedal" }],
				{ widthCm: 60, heightCm: 30 },
			),
		).toBeNull();
	});
});

describe("chooseBoard", () => {
	it("picks a catalog board when it fits", () => {
		const chosen = chooseBoard(items, [
			{ id: "small", widthCm: 20, heightCm: 20 },
			{ id: "large", widthCm: 80, heightCm: 30 },
		]);
		expect(chosen.board.boardRefId).toBe("large");
	});

	it("falls back to a custom board when no catalog board fits", () => {
		const chosen = chooseBoard(
			[{ id: "huge", widthCm: 90, heightCm: 40, category: "pedal" }],
			[{ id: "small", widthCm: 20, heightCm: 20 }],
		);
		expect(chosen.board.boardRefId).toBeNull();
		expect(chosen.board.widthCm).toBeGreaterThanOrEqual(90);
		expect(chosen.board.heightCm).toBeGreaterThanOrEqual(40);
	});
});

describe("chainCables", () => {
	it("connects consecutive items with an output and an input", () => {
		const cables = chainCables([
			{ ...(items[0] as DemoItem), jacks: [{ kind: "in" }, { kind: "out" }] },
			{ ...(items[1] as DemoItem), jacks: [{ kind: "in" }, { kind: "out" }] },
		]);
		expect(cables).toHaveLength(1);
		expect(cables[0]?.from).toEqual({ itemUid: "demo-item-a", jack: "1" });
		expect(cables[0]?.to).toEqual({ itemUid: "demo-item-b", jack: "0" });
	});

	it("skips a non-audio item and keeps chaining the rest", () => {
		const cables = chainCables([
			{ ...(items[0] as DemoItem), jacks: [{ kind: "in" }, { kind: "out" }] },
			{ ...(items[2] as DemoItem), jacks: [{ kind: "midi" }] },
			{ ...(items[1] as DemoItem), jacks: [{ kind: "in" }, { kind: "out" }] },
		]);
		expect(cables).toHaveLength(1);
		expect(cables[0]?.from).toEqual({ itemUid: "demo-item-a", jack: "1" });
		expect(cables[0]?.to).toEqual({ itemUid: "demo-item-b", jack: "0" });
	});

	it("returns no cables when no item has both an input and an output", () => {
		expect(chainCables([items[0] as DemoItem, items[1] as DemoItem])).toEqual(
			[],
		);
	});
});

describe("boardRowSnapshots", () => {
	it("places board-batch items in a wrapping row", () => {
		const boards = boardRowSnapshots(
			[
				{ id: "a", widthCm: 60, heightCm: 30 },
				{ id: "b", widthCm: 60, heightCm: 30 },
				{ id: "c", widthCm: 40, heightCm: 20 },
			],
			{ gapCm: 4, maxRowWidthCm: 130 },
		);
		expect(boards).toHaveLength(3);
		expect(boards[0]).toMatchObject({ boardRefId: "a", x: 0, y: 0 });
		expect(boards[1]).toMatchObject({ boardRefId: "b", x: 64, y: 0 });
		expect(boards[2]).toMatchObject({ boardRefId: "c", x: 0, y: 34 });
	});
});
