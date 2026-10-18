import { describe, expect, it } from "vitest";
import { spaceWarning } from "./overlap";
import type { CustomPedal, PlacedBoard, PlacedItem } from "./scene";

/** A custom pedal gives a deterministic footprint without touching the catalog. */
function part(
	refId: string,
	widthCm: number,
	heightCm: number,
	name = refId,
): CustomPedal {
	return {
		refId,
		brand: "",
		name,
		widthCm,
		heightCm,
		category: "pedal",
		effectTypes: [],
	};
}

function item(
	uid: string,
	refId: string,
	boardUid: string | null,
	x: number,
	y: number,
	rotationDeg = 0,
): PlacedItem {
	return { uid, refId, kind: "pedal", boardUid, x, y, rotationDeg, z: 0 };
}

function board(
	uid: string,
	widthCm: number,
	heightCm: number,
	x = 0,
	y = 0,
	rotationDeg = 0,
): PlacedBoard {
	return {
		uid,
		boardRefId: null,
		customSize: { widthCm, heightCm },
		x,
		y,
		rotationDeg,
	};
}

const A = part("custom-a", 4, 4, "Alpha");
const B = part("custom-b", 4, 4, "Bravo");

describe("spaceWarning — overlaps", () => {
	it("flags a same-container overlap by peer name", () => {
		const boardA = board("b1", 20, 20);
		const one = item("i1", A.refId, "b1", 2, 2);
		const two = item("i2", B.refId, "b1", 4, 4);
		const warning = spaceWarning(one, {
			items: [one, two],
			boards: [boardA],
			customPedals: [A, B],
		});
		expect(warning.overlaps).toEqual(["Bravo"]);
		expect(warning.outOfBounds).toBe(false);
		expect(warning.any).toBe(true);
	});

	it("does not flag items that are apart", () => {
		const boardA = board("b1", 20, 20);
		const one = item("i1", A.refId, "b1", 0, 0);
		const two = item("i2", B.refId, "b1", 10, 10);
		const warning = spaceWarning(one, {
			items: [one, two],
			boards: [boardA],
			customPedals: [A, B],
		});
		expect(warning.any).toBe(false);
	});

	it("treats an edge-touching placement as no overlap", () => {
		const boardA = board("b1", 20, 20);
		const one = item("i1", A.refId, "b1", 0, 0);
		const two = item("i2", B.refId, "b1", 4, 0); // one's right edge === two's left
		const warning = spaceWarning(one, {
			items: [one, two],
			boards: [boardA],
			customPedals: [A, B],
		});
		expect(warning.any).toBe(false);
	});

	it("collects every overlapping peer", () => {
		const boardA = board("b1", 20, 20);
		const one = item("i1", A.refId, "b1", 2, 2);
		const two = item("i2", B.refId, "b1", 3, 3);
		const three = item("i3", B.refId, "b1", 4, 4);
		const warning = spaceWarning(one, {
			items: [one, two, three],
			boards: [boardA],
			customPedals: [A, B],
		});
		expect(warning.overlaps).toHaveLength(2);
	});

	it("flags a loose item overlapping another loose item (no board)", () => {
		const one = item("i1", A.refId, null, 0, 0);
		const two = item("i2", B.refId, null, 1, 1);
		const warning = spaceWarning(one, {
			items: [one, two],
			boards: [],
			customPedals: [A, B],
		});
		expect(warning.overlaps).toEqual(["Bravo"]);
		expect(warning.outOfBounds).toBe(false);
	});

	it("flags an overlap across containers (a loose pedal over a board pedal)", () => {
		// Overlap is world-space: a container boundary does not hide a real
		// on-canvas overlap.
		const boardA = board("b1", 10, 10);
		const onBoard = item("i1", A.refId, "b1", 2, 2); // world 2..6
		const loose = item("i2", B.refId, null, 3, 3); // world 3..7
		const warning = spaceWarning(loose, {
			items: [onBoard, loose],
			boards: [boardA],
			customPedals: [A, B],
		});
		expect(warning.overlaps).toEqual(["Alpha"]);
	});

	it("uses the live placement while dragging", () => {
		const boardA = board("b1", 40, 40);
		const one = item("i1", A.refId, "b1", 0, 0); // stored far from two
		const two = item("i2", B.refId, "b1", 20, 20);
		// Not overlapping at the stored position…
		expect(
			spaceWarning(one, {
				items: [one, two],
				boards: [boardA],
				customPedals: [A, B],
			}).any,
		).toBe(false);
		// …but overlapping where it is currently lifted.
		const live = { originCm: { x: 19, y: 19 }, rotationDeg: 0 };
		expect(
			spaceWarning(one, {
				items: [one, two],
				boards: [boardA],
				customPedals: [A, B],
				live,
			}).overlaps,
		).toEqual(["Bravo"]);
	});
});

describe("spaceWarning — out of bounds", () => {
	it("is false for a loose item", () => {
		const one = item("i1", A.refId, null, 0, 0);
		expect(
			spaceWarning(one, { items: [one], boards: [], customPedals: [A] })
				.outOfBounds,
		).toBe(false);
	});

	it("flags each edge of the board footprint", () => {
		const boardA = board("b1", 10, 10);
		const cases: PlacedItem[] = [
			item("lo", A.refId, "b1", -1, 3),
			item("ro", A.refId, "b1", 7, 3),
			item("to", A.refId, "b1", 3, -1),
			item("bo", A.refId, "b1", 3, 7),
		];
		for (const placed of cases) {
			expect(
				spaceWarning(placed, {
					items: [placed],
					boards: [boardA],
					customPedals: [A],
				}).outOfBounds,
				placed.uid,
			).toBe(true);
		}
	});

	it("stays inside for an item fully on the board", () => {
		const boardA = board("b1", 10, 10);
		const one = item("i1", A.refId, "b1", 3, 3);
		expect(
			spaceWarning(one, { items: [one], boards: [boardA], customPedals: [A] })
				.outOfBounds,
		).toBe(false);
	});

	it("evaluates bounds in the board's frame when the board is rotated", () => {
		const rotated = board("b1", 10, 10, 0, 0, 90);
		// In the board's local frame this sits past the top edge even though the
		// world-space rectangle (after a 90° board rotation) looks elsewhere.
		const one = item("i1", A.refId, "b1", 3, -1);
		expect(
			spaceWarning(one, {
				items: [one],
				boards: [rotated],
				customPedals: [A],
			}).outOfBounds,
		).toBe(true);
	});

	it("uses the exact rotated corners, not the axis-aligned box", () => {
		const boardA = board("b1", 10, 10);
		// A 45° 4×4 square centred exactly on the board centre stays inside…
		const inside = item("i1", A.refId, "b1", 3, 3, 45);
		expect(
			spaceWarning(inside, {
				items: [inside],
				boards: [boardA],
				customPedals: [A],
			}).outOfBounds,
		).toBe(false);
		// …but shifted to the corner its rotated corners poke past the edge.
		const outside = item("i2", A.refId, "b1", 6, 6, 45);
		expect(
			spaceWarning(outside, {
				items: [outside],
				boards: [boardA],
				customPedals: [A],
			}).outOfBounds,
		).toBe(true);
	});

	it("checks the live drop target while dragging", () => {
		const boardA = board("b1", 10, 10);
		const one = item("i1", A.refId, null, 0, 0); // loose, stored at origin
		const live = { originCm: { x: 8, y: 8 }, rotationDeg: 0 };
		const warning = spaceWarning(one, {
			items: [one],
			boards: [boardA],
			customPedals: [A],
			live,
		});
		// Centred over the board (findBoardAt), extends past its far corner.
		expect(warning.outOfBounds).toBe(true);
	});
});
