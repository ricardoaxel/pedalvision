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
		const uid = useScene.getState().addBoard(boss.id, { x: 100, y: 50 });
		const board = useScene.getState().boards[0];
		expect(board.uid).toBe(uid);
		expect(board.boardRefId).toBe(boss.id);
		expect(board.rotationDeg).toBe(0);
		// Stored x/y is the origin (top-left), so the centre lands on the point.
		expect(board.x).toBeCloseTo(100 - boss.widthCm / 2, 10);
		expect(board.y).toBeCloseTo(50 - boss.heightCm / 2, 10);
	});

	it("gives each board a unique uid", () => {
		const a = useScene.getState().addBoard(boss.id, { x: 0, y: 0 });
		const b = useScene.getState().addBoard(boss.id, { x: 0, y: 0 });
		expect(a).not.toBe(b);
	});

	it("moveBoard writes x/y in cm", () => {
		const uid = useScene.getState().addBoard(boss.id, { x: 0, y: 0 });
		useScene.getState().moveBoard(uid, 12.5, -3.25);
		const board = useScene.getState().boards[0];
		expect({ x: board.x, y: board.y }).toEqual({ x: 12.5, y: -3.25 });
	});

	it("rotateBoard sets any angle", () => {
		const uid = useScene.getState().addBoard(boss.id, { x: 0, y: 0 });
		useScene.getState().rotateBoard(uid, 37.5);
		expect(useScene.getState().boards[0].rotationDeg).toBe(37.5);
	});

	it("removeBoard drops only the target", () => {
		const first = useScene.getState().addBoard(boss.id, { x: 0, y: 0 });
		const second = useScene
			.getState()
			.addBoard(catalog.boards[1].id, { x: 0, y: 0 });
		useScene.getState().removeBoard(first);
		expect(useScene.getState().boards.map((board) => board.uid)).toEqual([
			second,
		]);
	});
});

describe("useScene custom boards (P2-05)", () => {
	beforeEach(() => {
		useScene.setState({ boards: [] });
	});

	const definition = {
		widthCm: 80,
		heightCm: 40,
		texture: "wood" as const,
		name: "Big Rig",
		brand: "Acme",
	};

	it("addCustomBoard stores an inline definition and centres on the point", () => {
		const uid = useScene
			.getState()
			.addCustomBoard(definition, { x: 100, y: 50 });
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
		const uid = useScene.getState().addCustomBoard(definition, { x: 0, y: 0 });
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
