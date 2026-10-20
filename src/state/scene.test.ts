import { beforeEach, describe, expect, it } from "vitest";
import { catalog } from "../catalog/load";
import {
	boardDefinition,
	boardFootprint,
	boardWorldCorners,
	FALLBACK_BOARD_CM,
	isCustomBoard,
	useScene,
} from "./scene";

function required<T>(value: T | null): T {
	if (value === null) throw new Error("expected a value");
	return value;
}

const boss = catalog.boards.find((board) => board.id === "boss-bcb-1000");
if (!boss) throw new Error("test fixture board missing from the seed");

describe("boardFootprint / boardDefinition", () => {
	it("resolves the catalog footprint for a known ref", () => {
		const board = {
			uid: "a",
			boardRefId: boss.id,
			x: 0,
			y: 0,
			rotationDeg: 0,
		};
		expect(boardFootprint(board)).toEqual({
			widthCm: boss.widthCm,
			heightCm: boss.heightCm,
		});
		expect(boardDefinition(board)).toBe(boss);
	});

	it("prefers a custom size and has no catalog definition", () => {
		const board = {
			uid: "a",
			boardRefId: null,
			customSize: { widthCm: 12, heightCm: 7 },
			x: 0,
			y: 0,
			rotationDeg: 0,
		};
		expect(boardFootprint(board)).toEqual({ widthCm: 12, heightCm: 7 });
		expect(boardDefinition(board)).toBeNull();
	});

	it("falls back for an unknown ref", () => {
		const board = {
			uid: "a",
			boardRefId: "does-not-exist",
			x: 0,
			y: 0,
			rotationDeg: 0,
		};
		expect(boardFootprint(board)).toEqual(FALLBACK_BOARD_CM);
	});
});

describe("useScene boards slice", () => {
	beforeEach(() => {
		useScene.setState({ boards: [] });
	});

	it("addBoard centres the board on the given world point and returns its uid", () => {
		const uid = required(
			useScene.getState().addBoard(boss.id, { x: 100, y: 50 }),
		);
		const board = useScene.getState().boards[0];
		expect(board.uid).toBe(uid);
		expect(board.boardRefId).toBe(boss.id);
		expect(board.rotationDeg).toBe(0);
		// Stored x/y is the origin (top-left), so the centre lands on the point.
		expect(board.x).toBeCloseTo(100 - boss.widthCm / 2, 10);
		expect(board.y).toBeCloseTo(50 - boss.heightCm / 2, 10);
	});

	it("gives each board a unique uid", () => {
		const a = required(useScene.getState().addBoard(boss.id, { x: 0, y: 0 }));
		const b = required(useScene.getState().addBoard(boss.id, { x: 0, y: 0 }));
		expect(a).not.toBe(b);
	});

	it("moveBoard writes x/y in cm", () => {
		const uid = required(useScene.getState().addBoard(boss.id, { x: 0, y: 0 }));
		useScene.getState().moveBoard(uid, 12.5, -3.25);
		const board = useScene.getState().boards[0];
		expect({ x: board.x, y: board.y }).toEqual({ x: 12.5, y: -3.25 });
	});

	it("rotateBoard sets any angle", () => {
		const uid = required(useScene.getState().addBoard(boss.id, { x: 0, y: 0 }));
		useScene.getState().rotateBoard(uid, 37.5);
		expect(useScene.getState().boards[0].rotationDeg).toBe(37.5);
	});

	it("removeBoard drops only the target", () => {
		const first = required(
			useScene.getState().addBoard(boss.id, { x: 0, y: 0 }),
		);
		const second = required(
			useScene.getState().addBoard(catalog.boards[1].id, { x: 0, y: 0 }),
		);
		useScene.getState().removeBoard(first);
		expect(useScene.getState().boards.map((board) => board.uid)).toEqual([
			second,
		]);
	});
});

describe("useScene custom boards (P2-05)", () => {
	beforeEach(() => {
		useScene.setState({ boards: [], items: [] });
	});

	const definition = {
		widthCm: 80,
		heightCm: 40,
		texture: "wood" as const,
		name: "Big Rig",
		brand: "Acme",
	};

	it("addCustomBoard stores an inline definition and centres on the point", () => {
		const uid = required(
			useScene.getState().addCustomBoard(definition, { x: 100, y: 50 }),
		);
		const board = useScene.getState().boards[0];
		expect(board.uid).toBe(uid);
		expect(board.boardRefId).toBeNull();
		expect(board.customSize).toEqual({ widthCm: 80, heightCm: 40 });
		expect(board.texture).toBe("wood");
		expect(board.name).toBe("Big Rig");
		expect(board.brand).toBe("Acme");
		expect(board.rotationDeg).toBe(0);
		// Stored x/y is the origin (top-left), so the centre lands on the point.
		expect(board.x).toBe(60);
		expect(board.y).toBe(30);
		expect(isCustomBoard(board)).toBe(true);
		expect(boardDefinition(board)).toBeNull();
		expect(boardFootprint(board)).toEqual({ widthCm: 80, heightCm: 40 });
	});

	it("updateCustomBoard edits the definition but keeps position/rotation", () => {
		const uid = required(
			useScene.getState().addCustomBoard(definition, { x: 0, y: 0 }),
		);
		useScene.getState().moveBoard(uid, 11, 22);
		useScene.getState().rotateBoard(uid, 30);
		useScene.getState().updateCustomBoard(uid, {
			widthCm: 100,
			heightCm: 50,
			texture: "tolex",
			name: "Bigger Rig",
		});
		const board = useScene.getState().boards[0];
		expect(board.customSize).toEqual({ widthCm: 100, heightCm: 50 });
		expect(board.texture).toBe("tolex");
		expect(board.name).toBe("Bigger Rig");
		expect(board.brand).toBeUndefined();
		expect({ x: board.x, y: board.y, rotationDeg: board.rotationDeg }).toEqual({
			x: 11,
			y: 22,
			rotationDeg: 30,
		});
	});

	it("nudges attached pedals inside a board when it is shrunk", () => {
		const pedal = catalog.pedals.find(
			(candidate) => candidate.id === "boss-bd-2-blues-driver",
		);
		if (!pedal) throw new Error("test fixture pedal missing from the seed");
		const uid = required(
			useScene
				.getState()
				.addCustomBoard(
					{ widthCm: 60, heightCm: 30, texture: "matte" },
					{ x: 0, y: 0 },
				),
		);
		const itemUid = required(
			useScene.getState().addItem(pedal.id, "pedal", uid, { x: 55, y: 25 }),
		);
		useScene.getState().updateCustomBoard(uid, {
			widthCm: 30,
			heightCm: 20,
			texture: "matte",
		});
		const item = useScene
			.getState()
			.items.find((candidate) => candidate.uid === itemUid);
		expect(item).toBeDefined();
		if (!item) return;
		expect(item.x).toBeGreaterThanOrEqual(0);
		expect(item.y).toBeGreaterThanOrEqual(0);
		expect(item.x).toBeLessThanOrEqual(30 - pedal.widthCm);
		expect(item.y).toBeLessThanOrEqual(20 - pedal.heightCm);
	});

	it("does not nudge an item when the board only grows", () => {
		const pedal = catalog.pedals.find(
			(candidate) => candidate.id === "boss-bd-2-blues-driver",
		);
		if (!pedal) throw new Error("test fixture pedal missing from the seed");
		const uid = required(
			useScene
				.getState()
				.addCustomBoard(
					{ widthCm: 30, heightCm: 20, texture: "matte" },
					{ x: 0, y: 0 },
				),
		);
		const itemUid = required(
			useScene.getState().addItem(pedal.id, "pedal", uid, { x: 22, y: 6 }),
		);
		useScene.getState().updateCustomBoard(uid, {
			widthCm: 60,
			heightCm: 40,
			texture: "matte",
		});
		const item = useScene
			.getState()
			.items.find((candidate) => candidate.uid === itemUid);
		// A deliberate overhang is preserved when the board isn't shrunk.
		expect(item).toMatchObject({ x: 22, y: 6 });
	});

	it("clamps a pedal wider than the shrunk board to the origin", () => {
		const pedal = catalog.pedals.find(
			(candidate) => candidate.id === "boss-bd-2-blues-driver",
		);
		if (!pedal) throw new Error("test fixture pedal missing from the seed");
		const uid = required(
			useScene
				.getState()
				.addCustomBoard(
					{ widthCm: 5, heightCm: 30, texture: "matte" },
					{ x: 0, y: 0 },
				),
		);
		const itemUid = required(
			useScene.getState().addItem(pedal.id, "pedal", uid, { x: 3, y: 4 }),
		);
		useScene.getState().updateCustomBoard(uid, {
			widthCm: 4,
			heightCm: 30,
			texture: "matte",
		});
		const item = useScene
			.getState()
			.items.find((candidate) => candidate.uid === itemUid);
		expect(item?.x).toBe(0);
		// The non-shrunk axis is untouched.
		expect(item?.y).toBe(4);
	});

	it("clamps a rotated pedal by its unrotated footprint (documented residual)", () => {
		const pedal = catalog.pedals.find(
			(candidate) => candidate.id === "boss-bd-2-blues-driver",
		);
		if (!pedal) throw new Error("test fixture pedal missing from the seed");
		const uid = required(
			useScene
				.getState()
				.addCustomBoard(
					{ widthCm: 60, heightCm: 30, texture: "matte" },
					{ x: 0, y: 0 },
				),
		);
		const itemUid = required(
			useScene.getState().addItem(pedal.id, "pedal", uid, { x: 55, y: 20 }),
		);
		useScene.getState().rotateItem(itemUid, 45);
		useScene.getState().updateCustomBoard(uid, {
			widthCm: 30,
			heightCm: 30,
			texture: "matte",
		});
		const item = useScene
			.getState()
			.items.find((candidate) => candidate.uid === itemUid);
		expect(item?.x).toBe(30 - pedal.widthCm);
		expect(item?.rotationDeg).toBe(45);
	});

	it("boardWorldCorners maps the rotated footprint to world cm", () => {
		const board = {
			uid: "b",
			boardRefId: null,
			customSize: { widthCm: 10, heightCm: 20 },
			texture: "matte" as const,
			x: 5,
			y: 7,
			rotationDeg: 90,
		};
		const corners = boardWorldCorners(board);
		// 90° about the origin (5,7): local (10,0) → world (5, 17).
		expect(corners[0]).toEqual({ x: 5, y: 7 });
		expect(corners[1].x).toBeCloseTo(5, 10);
		expect(corners[1].y).toBeCloseTo(17, 10);
	});
});
