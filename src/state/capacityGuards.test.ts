import { beforeEach, describe, expect, it } from "vitest";
import { catalog } from "../catalog/load";
import { useScene } from "./scene";

/**
 * Store-level hard-cap guards (P3-06). The pure capacity model is covered in
 * `src/lib/capacity.test.ts`; these tests prove the scene store itself refuses
 * the mutation (so a future import/paste can't bypass the UI).
 */

const BOARD = catalog.boards[0].id;
const PEDAL = catalog.pedals[0].id;

function reset() {
	useScene.setState({ boards: [], items: [], customPedals: [] });
}

function looseItem(index: number) {
	return {
		uid: `seed-${index}`,
		refId: PEDAL,
		kind: "pedal" as const,
		boardUid: null,
		x: index,
		y: 0,
		rotationDeg: 0,
		z: index,
	};
}

function required<T>(value: T | null): T {
	if (value === null) throw new Error("expected a value");
	return value;
}

describe("capacity guards in the scene store", () => {
	beforeEach(reset);

	it("allows the 400th item and refuses the 401st", () => {
		useScene.setState({
			items: Array.from({ length: 399 }, (_, index) => looseItem(index)),
		});
		expect(
			useScene.getState().addItem(PEDAL, "pedal", null, { x: 0, y: 0 }),
		).toBeTruthy();
		expect(useScene.getState().items).toHaveLength(400);

		expect(
			useScene.getState().addItem(PEDAL, "pedal", null, { x: 0, y: 0 }),
		).toBeNull();
		expect(useScene.getState().items).toHaveLength(400);
	});

	it("refuses a duplicate at the item cap and allows it below", () => {
		useScene.setState({
			items: Array.from({ length: 400 }, (_, index) => looseItem(index)),
		});
		expect(useScene.getState().duplicateItem("seed-0")).toBeNull();
		expect(useScene.getState().items).toHaveLength(400);

		useScene.setState({
			items: Array.from({ length: 399 }, (_, index) => looseItem(index)),
		});
		expect(useScene.getState().duplicateItem("seed-0")).toBeTruthy();
		expect(useScene.getState().items).toHaveLength(400);
	});

	it("allows the 10th board and refuses catalog + custom boards after it", () => {
		for (let index = 0; index < 10; index++) {
			required(useScene.getState().addBoard(BOARD, { x: 0, y: 0 }));
		}
		expect(useScene.getState().boards).toHaveLength(10);
		expect(useScene.getState().addBoard(BOARD, { x: 0, y: 0 })).toBeNull();
		expect(
			useScene.getState().addCustomBoard(
				{
					widthCm: 40,
					heightCm: 20,
					texture: "matte",
				},
				{ x: 0, y: 0 },
			),
		).toBeNull();
		expect(useScene.getState().boards).toHaveLength(10);
	});

	it("keeps an over-cap recovered scene intact and refuses new objects", () => {
		const boards = Array.from({ length: 11 }, (_, index) => ({
			uid: `board-${index}`,
			boardRefId: null,
			customSize: { widthCm: 40, heightCm: 20 },
			texture: "matte" as const,
			x: index * 50,
			y: 0,
			rotationDeg: 0,
		}));
		const items = Array.from({ length: 401 }, (_, index) => looseItem(index));
		useScene.setState({ boards, items });

		expect(
			useScene.getState().addItem(PEDAL, "pedal", null, { x: 0, y: 0 }),
		).toBeNull();
		expect(useScene.getState().addBoard(BOARD, { x: 0, y: 0 })).toBeNull();
		// Load never trims or rejects the stored content.
		expect(useScene.getState().items).toHaveLength(401);
		expect(useScene.getState().boards).toHaveLength(11);
	});
});
