import { describe, expect, it } from "vitest";
import type { CatalogBoard } from "../catalog/schema";
import type { PlacedBoard } from "../state/scene";
import { buildBoardReadout } from "./boardInfo";

const catalogBoard: PlacedBoard = {
	uid: "b1",
	boardRefId: "boss-bcb-1000",
	x: 0,
	y: 0,
	rotationDeg: 0,
};

const definition: CatalogBoard = {
	id: "boss-bcb-1000",
	brand: "BOSS",
	name: "BCB-1000",
	widthCm: 82,
	heightCm: 48,
	image: "boss-bcb-1000.avif",
	imageSource: "static",
	source: "public-asset",
};

const footprint = { widthCm: 82, heightCm: 48 };

describe("buildBoardReadout", () => {
	it("reads a catalog board from its definition", () => {
		const readout = buildBoardReadout(catalogBoard, definition, footprint);
		expect(readout).toMatchObject({
			kind: "catalog",
			brand: "BOSS",
			name: "BCB-1000",
			widthCm: 82,
			heightCm: 48,
			finish: null,
			texture: null,
			image: { source: "static", value: "boss-bcb-1000.avif" },
		});
	});

	it("reads a custom board's name, brand and finish", () => {
		const custom: PlacedBoard = {
			uid: "b2",
			boardRefId: null,
			customSize: { widthCm: 80, heightCm: 40 },
			texture: "wood",
			name: "  Big Rig  ",
			brand: " Ashel ",
			x: 0,
			y: 0,
			rotationDeg: 0,
		};
		const readout = buildBoardReadout(custom, null, {
			widthCm: 80,
			heightCm: 40,
		});
		expect(readout).toMatchObject({
			kind: "custom",
			brand: "Ashel",
			name: "Big Rig",
			finish: "Wood",
			texture: "wood",
			image: null,
		});
	});

	it("falls back to a named custom board with the default finish", () => {
		const custom: PlacedBoard = {
			uid: "b3",
			boardRefId: null,
			customSize: { widthCm: 60, heightCm: 30 },
			x: 0,
			y: 0,
			rotationDeg: 0,
		};
		const readout = buildBoardReadout(custom, null, {
			widthCm: 60,
			heightCm: 30,
		});
		expect(readout.name).toBe("Custom board");
		expect(readout.brand).toBe("");
		expect(readout.finish).toBe("Matte");
		expect(readout.texture).toBe("matte");
	});

	it("flags a catalog ref that no longer resolves", () => {
		const readout = buildBoardReadout(catalogBoard, null, footprint);
		expect(readout.kind).toBe("catalog");
		expect(readout.name).toBe("Board");
		expect(readout.image).toBeNull();
	});
});
