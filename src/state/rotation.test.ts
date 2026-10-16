import { beforeEach, describe, expect, it } from "vitest";
import { catalog } from "../catalog/load";
import { boardToWorld, rotatePoint } from "../lib/geometry";
import {
	itemFootprint,
	itemVisualRotationDeg,
	itemWorldCorners,
	normalizeDegrees,
	type PlacedBoard,
	type PlacedItem,
	rotateItemAboutCenter,
	useScene,
} from "./scene";

/** Geometric centre (world cm) of a placed item's rotated footprint. */
function itemCentreWorld(
	item: PlacedItem,
	board: PlacedBoard,
): { x: number; y: number } {
	const { widthCm, heightCm } = itemFootprint(item);
	const rotatedHalf = rotatePoint(
		{ x: widthCm / 2, y: heightCm / 2 },
		{ x: 0, y: 0 },
		item.rotationDeg,
	);
	return boardToWorld(
		{ x: item.x + rotatedHalf.x, y: item.y + rotatedHalf.y },
		board,
	);
}

const board = catalog.boards.find((b) => b.id === "boss-bcb-1000");
if (!board) throw new Error("test fixture board missing from the seed");
const pedal = catalog.pedals.find((p) => p.id === "boss-bd-2-blues-driver");
if (!pedal) throw new Error("test fixture pedal missing from the seed");
const HALF = { x: pedal.widthCm / 2, y: pedal.heightCm / 2 };

describe("normalizeDegrees", () => {
	it("wraps to [0, 360)", () => {
		expect(normalizeDegrees(0)).toBe(0);
		expect(normalizeDegrees(45)).toBe(45);
		expect(normalizeDegrees(360)).toBe(0);
		expect(normalizeDegrees(450)).toBe(90);
		expect(normalizeDegrees(-90)).toBe(270);
		expect(normalizeDegrees(-450)).toBe(270);
		expect(normalizeDegrees(720)).toBe(0);
		expect(normalizeDegrees(37.5)).toBe(37.5);
	});

	it("handles -0 and non-finite values", () => {
		expect(Object.is(normalizeDegrees(-0), 0)).toBe(true);
		expect(normalizeDegrees(Number.NaN)).toBe(0);
		expect(normalizeDegrees(Number.POSITIVE_INFINITY)).toBe(0);
	});
});

describe("rotateItemAboutCenter", () => {
	it("spins the footprint about its own centre (origin moves, centre fixed)", () => {
		const item = {
			uid: "i",
			refId: pedal.id,
			kind: "pedal" as const,
			boardUid: null,
			x: 10,
			y: 20,
			rotationDeg: 0,
			z: 0,
		};
		const center = { x: item.x + HALF.x, y: item.y + HALF.y };
		const result = rotateItemAboutCenter(item, 90);
		expect(result.rotationDeg).toBe(90);
		// The origin is the old origin rotated 90° about the centre.
		const expectedOrigin = rotatePoint({ x: item.x, y: item.y }, center, 90);
		expect(result.x).toBeCloseTo(expectedOrigin.x, 10);
		expect(result.y).toBeCloseTo(expectedOrigin.y, 10);
		// The footprint's geometric centre (origin + the rotated half-vector) is
		// invariant — the rectangle spins in place.
		const rotatedHalf = rotatePoint(HALF, { x: 0, y: 0 }, 90);
		expect(result.x + rotatedHalf.x).toBeCloseTo(center.x, 10);
		expect(result.y + rotatedHalf.y).toBeCloseTo(center.y, 10);
	});

	it("keeps the true centre when rotating an already-rotated item", () => {
		const item = {
			uid: "i",
			refId: pedal.id,
			kind: "pedal" as const,
			boardUid: null,
			x: 3,
			y: 7,
			rotationDeg: 45,
			z: 0,
		};
		const { widthCm, heightCm } = itemFootprint(item);
		const half = { x: widthCm / 2, y: heightCm / 2 };
		const halfAt = (deg: number) => rotatePoint(half, { x: 0, y: 0 }, deg);
		const centreBefore = {
			x: item.x + halfAt(45).x,
			y: item.y + halfAt(45).y,
		};

		const result = rotateItemAboutCenter(item, 90);
		expect(result.rotationDeg).toBe(90);
		expect(result.x + halfAt(90).x).toBeCloseTo(centreBefore.x, 10);
		expect(result.y + halfAt(90).y).toBeCloseTo(centreBefore.y, 10);
	});

	it("normalises the resulting rotation", () => {
		const item = {
			uid: "i",
			refId: pedal.id,
			kind: "pedal" as const,
			boardUid: null,
			x: 0,
			y: 0,
			rotationDeg: 0,
			z: 0,
		};
		expect(rotateItemAboutCenter(item, 450).rotationDeg).toBe(90);
		expect(rotateItemAboutCenter(item, -90).rotationDeg).toBe(270);
	});
});

describe("rotateItem store action (S3 rotated parent)", () => {
	beforeEach(() => {
		useScene.setState({ boards: [], items: [] });
	});

	it("stores rotation relative to the pedal and leaves the board transform alone", () => {
		const boardUid = useScene.getState().addBoard(board.id, { x: 0, y: 0 });
		useScene.getState().moveBoard(boardUid, 100, 50);
		useScene.getState().rotateBoard(boardUid, 25);
		const uid = useScene
			.getState()
			.addItem(pedal.id, "pedal", boardUid, { x: 10, y: 5 });

		useScene.getState().rotateItem(uid, 30);

		const state = useScene.getState();
		const item = state.items[0];
		const placedBoard = state.boards[0];
		// Relative to the pedal, NOT composed with the board.
		expect(item.rotationDeg).toBe(30);
		// The board transform is untouched.
		expect(placedBoard.rotationDeg).toBe(25);
		expect(placedBoard.x).toBe(100);
		expect(placedBoard.y).toBe(50);
	});

	it("keeps the item's world centre fixed when rotating on a rotated board", () => {
		const boardUid = useScene.getState().addBoard(board.id, { x: 0, y: 0 });
		useScene.getState().moveBoard(boardUid, 100, 50);
		useScene.getState().rotateBoard(boardUid, 25);
		const uid = useScene
			.getState()
			.addItem(pedal.id, "pedal", boardUid, { x: 10, y: 5 });

		const boardBefore = { ...useScene.getState().boards[0] };
		const itemBefore = { ...useScene.getState().items[0] };
		const centreBefore = itemCentreWorld(itemBefore, boardBefore);

		useScene.getState().rotateItem(uid, 90);

		const itemAfter = useScene.getState().items[0];
		const boardAfter = useScene.getState().boards[0];
		const centreAfter = itemCentreWorld(itemAfter, boardAfter);
		expect(centreAfter.x).toBeCloseTo(centreBefore.x, 10);
		expect(centreAfter.y).toBeCloseTo(centreBefore.y, 10);
	});

	it("keeps the world centre under repeated action-bar rotations", () => {
		const boardUid = useScene.getState().addBoard(board.id, { x: 0, y: 0 });
		useScene.getState().moveBoard(boardUid, 100, 50);
		useScene.getState().rotateBoard(boardUid, 25);
		const uid = useScene
			.getState()
			.addItem(pedal.id, "pedal", boardUid, { x: 10, y: 5 });

		const before = itemCentreWorld(
			useScene.getState().items[0],
			useScene.getState().boards[0],
		);
		// Two presses: 0 → 45 → 90. The centre must hold each time.
		useScene.getState().rotateItem(uid, 45);
		useScene.getState().rotateItem(uid, 90);
		const after = itemCentreWorld(
			useScene.getState().items[0],
			useScene.getState().boards[0],
		);
		expect(after.x).toBeCloseTo(before.x, 10);
		expect(after.y).toBeCloseTo(before.y, 10);
	});

	it("transformItem commits an origin + normalised rotation", () => {
		const uid = useScene
			.getState()
			.addItem(pedal.id, "pedal", null, { x: 0, y: 0 });
		useScene.getState().transformItem(uid, 4.5, 6.25, -100);
		const item = useScene.getState().items[0];
		expect({ x: item.x, y: item.y }).toEqual({ x: 4.5, y: 6.25 });
		expect(item.rotationDeg).toBe(260);
	});
});

describe("itemVisualRotationDeg", () => {
	it("composes the board and item rotation for attached items", () => {
		const placedBoard = {
			uid: "b",
			boardRefId: board.id,
			x: 0,
			y: 0,
			rotationDeg: 30,
		};
		const item = {
			uid: "i",
			refId: pedal.id,
			kind: "pedal" as const,
			boardUid: "b",
			x: 0,
			y: 0,
			rotationDeg: 20,
			z: 0,
		};
		expect(itemVisualRotationDeg(item, [placedBoard])).toBe(50);
	});

	it("returns the item's own rotation when loose", () => {
		const item = {
			uid: "i",
			refId: pedal.id,
			kind: "pedal" as const,
			boardUid: null,
			x: 0,
			y: 0,
			rotationDeg: 20,
			z: 0,
		};
		expect(itemVisualRotationDeg(item, [])).toBe(20);
	});
});

describe("itemWorldCorners", () => {
	it("returns the axis-aligned footprint corners for a loose item", () => {
		const item = {
			uid: "i",
			refId: pedal.id,
			kind: "pedal" as const,
			boardUid: null,
			x: 10,
			y: 20,
			rotationDeg: 0,
			z: 0,
		};
		const { widthCm, heightCm } = itemFootprint(item);
		expect(itemWorldCorners(item, [])).toEqual([
			{ x: 10, y: 20 },
			{ x: 10 + widthCm, y: 20 },
			{ x: 10 + widthCm, y: 20 + heightCm },
			{ x: 10, y: 20 + heightCm },
		]);
	});

	it("composes the item rotation with the board transform", () => {
		const placedBoard = {
			uid: "b",
			boardRefId: board.id,
			x: 100,
			y: 50,
			rotationDeg: 25,
		};
		const item = {
			uid: "i",
			refId: pedal.id,
			kind: "pedal" as const,
			boardUid: "b",
			x: 10,
			y: 5,
			rotationDeg: 30,
			z: 0,
		};
		const { widthCm } = itemFootprint(item);
		const corners = itemWorldCorners(item, [placedBoard]);
		// Top-right corner = item origin + the (w, 0) vector rotated by the item
		// rotation, then through the board transform.
		const rotatedVector = rotatePoint({ x: widthCm, y: 0 }, { x: 0, y: 0 }, 30);
		const expected = boardToWorld(
			{ x: item.x + rotatedVector.x, y: item.y + rotatedVector.y },
			placedBoard,
		);
		expect(corners[1].x).toBeCloseTo(expected.x, 10);
		expect(corners[1].y).toBeCloseTo(expected.y, 10);
	});
});
