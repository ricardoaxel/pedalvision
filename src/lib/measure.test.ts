import { describe, expect, it } from "vitest";
import type {
	CustomPedal,
	Endpoint,
	PlacedBoard,
	PlacedItem,
} from "../state/scene";
import { distanceCm, formatMeasureDistance, snapMeasurePoint } from "./measure";

const board: PlacedBoard = {
	uid: "b1",
	boardRefId: null,
	customSize: { widthCm: 60, heightCm: 40 },
	texture: "matte",
	name: "Bench",
	brand: "",
	x: 0,
	y: 0,
	rotationDeg: 0,
};
const scene = { boards: [board], items: [], customPedals: [], endpoints: [] };

describe("measure snapping", () => {
	it("snaps to a board corner and centre", () => {
		expect(snapMeasurePoint({ x: 1, y: 1 }, 1, 12, scene)).toEqual({
			point: { x: 0, y: 0 },
			kind: "board",
		});
		expect(snapMeasurePoint({ x: 31, y: 19 }, 1, 12, scene)).toEqual({
			point: { x: 30, y: 20 },
			kind: "board",
		});
	});

	it("falls back to the current grid cell", () => {
		expect(snapMeasurePoint({ x: 12.2, y: 7.1 }, 1, 12, scene)).toEqual({
			point: { x: 10, y: 5 },
			kind: "grid",
		});
	});

	it("uses a zoom-aware radius and grid step", () => {
		// At 0.25× the dominant cell is 20 cm; the point snaps to 20/0.
		expect(snapMeasurePoint({ x: 21, y: 1 }, 0.25, 12, scene)).toEqual({
			point: { x: 20, y: 0 },
			kind: "grid",
		});
	});
});

describe("measure snapping priority", () => {
	const custom: CustomPedal = {
		refId: "custom-x",
		brand: "",
		name: "X",
		widthCm: 7,
		heightCm: 12,
		category: "pedal",
		effectTypes: [],
		jacks: [
			{ kind: "in", edge: "left", pos: 0.5 },
			{ kind: "out", edge: "right", pos: 0.5 },
		],
	};
	const item: PlacedItem = {
		uid: "i1",
		refId: "custom-x",
		kind: "pedal",
		boardUid: "b1",
		x: 10,
		y: 10,
		rotationDeg: 0,
		z: 0,
	};
	const endpoint: Endpoint = { uid: "e1", kind: "amp", x: 50, y: 50 };
	const withItem = {
		boards: [board],
		items: [item],
		customPedals: [custom],
		endpoints: [endpoint],
	};

	it("snaps to a jack at its exact edge position", () => {
		expect(snapMeasurePoint({ x: 10.5, y: 16.2 }, 1, 12, withItem)).toEqual({
			point: { x: 10, y: 16 },
			kind: "jack",
		});
	});

	it("snaps to an endpoint and labels the kind", () => {
		expect(snapMeasurePoint({ x: 51, y: 50 }, 1, 12, withItem)).toEqual({
			point: { x: 50, y: 50 },
			kind: "endpoint",
		});
	});
});

describe("measure formatting", () => {
	it("measures straight-line cm and formats in the active unit", () => {
		expect(distanceCm({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
		expect(formatMeasureDistance(5, "cm")).toBe("5 cm");
		expect(formatMeasureDistance(5.08, "in")).toBe("2 in");
		expect(formatMeasureDistance(7.3, "in")).toBe("2.9 in");
	});
});
