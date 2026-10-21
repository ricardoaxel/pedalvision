import { describe, expect, it } from "vitest";
import type { CustomPedal, PlacedBoard, PlacedItem } from "../state/scene";
import {
	FALLBACK_JACKS,
	itemFootprint,
	resolveJackLayout,
	usesFallbackJacks,
} from "../state/scene";
import {
	anchorIndexFor,
	buildAnchorIndex,
	cableEndAnchorFromIndex,
	cableEndAnchorWorld,
	cableEndKey,
	jackAnchorWorld,
	jackIndex,
	jackLocalPoint,
	liftedJackAnchor,
	resolveItemJacks,
} from "./jackAnchor";

const customPedal: CustomPedal = {
	refId: "custom-1",
	brand: "Acme",
	name: "Anchor",
	widthCm: 10,
	heightCm: 20,
	category: "pedal",
	effectTypes: [],
	jacks: [
		{ kind: "in", edge: "top", pos: 0.5 },
		{ kind: "out", edge: "right", pos: 0.25 },
		{ kind: "exp-out", edge: "bottom", pos: 1 },
		{ kind: "send", edge: "left", pos: 0.5 },
	],
};

const item = (overrides: Partial<PlacedItem> = {}): PlacedItem => ({
	uid: "i1",
	refId: "custom-1",
	kind: "pedal",
	boardUid: null,
	x: 10,
	y: 20,
	rotationDeg: 0,
	z: 0,
	...overrides,
});

describe("jack local points", () => {
	it("maps each edge's pos along the footprint", () => {
		const footprint = { widthCm: 10, heightCm: 20 };
		const [top, right, bottom, left] = customPedal.jacks ?? [];
		if (!top || !right || !bottom || !left) {
			throw new Error("jack fixture missing");
		}
		expect(jackLocalPoint(top, footprint)).toEqual({ x: 5, y: 0 });
		expect(jackLocalPoint(right, footprint)).toEqual({ x: 10, y: 5 });
		expect(jackLocalPoint(bottom, footprint)).toEqual({ x: 10, y: 20 });
		expect(jackLocalPoint(left, footprint)).toEqual({ x: 0, y: 10 });
	});

	it("distributes edge-only jacks evenly and marks them approximate", () => {
		const jacks = resolveJackLayout([
			{ kind: "in", edge: "top" },
			{ kind: "in", edge: "top" },
			{ kind: "out", edge: "left", pos: 0.25 },
			{ kind: "out", edge: "left" },
		]);
		expect(jacks.map((jack) => jack.pos)).toEqual([1 / 3, 2 / 3, 0.25, 0.625]);
		expect(jacks.map((jack) => jack.approximate === true)).toEqual([
			true,
			true,
			false,
			true,
		]);
	});
});

describe("jack anchors in world cm", () => {
	it("resolves a loose item's jack in world coordinates", () => {
		expect(jackAnchorWorld(item(), "0", [], [customPedal])).toEqual({
			x: 15,
			y: 20,
		});
		expect(jackAnchorWorld(item(), "1", [], [customPedal])).toEqual({
			x: 20,
			y: 25,
		});
	});

	it("rotates the jack with the item about its origin", () => {
		// A 10×20 item at the world origin rotated 90°: top-centre (5, 0)
		// becomes (0, 5) under the clockwise-positive Konva convention.
		const anchor = jackAnchorWorld(
			item({ x: 0, y: 0, rotationDeg: 90 }),
			"0",
			[],
			[customPedal],
		);
		expect(anchor?.x).toBeCloseTo(0);
		expect(anchor?.y).toBeCloseTo(5);
	});

	it("applies the board transform for an attached item on a rotated board", () => {
		const board: PlacedBoard = {
			uid: "b1",
			boardRefId: "boss-bcb-1000",
			x: 100,
			y: 50,
			rotationDeg: 90,
		};
		const attached = item({ boardUid: "b1", x: 0, y: 0 });
		// Board-local top-centre (5,0) → rotate 90° → (0,5) → + board origin.
		const anchor = jackAnchorWorld(attached, "0", [board], [customPedal]);
		expect(anchor?.x).toBeCloseTo(100);
		expect(anchor?.y).toBeCloseTo(55);
	});

	it("composes the item's rotation with a rotated board", () => {
		const board: PlacedBoard = {
			uid: "b1",
			boardRefId: "boss-bcb-1000",
			x: 100,
			y: 50,
			rotationDeg: 90,
		};
		const attached = item({
			boardUid: "b1",
			x: 0,
			y: 0,
			rotationDeg: 90,
		});
		// Item-local top-centre (5,0) → item 90° → (0,5) → board 90° → (-5,0).
		const anchor = jackAnchorWorld(attached, "0", [board], [customPedal]);
		expect(anchor?.x).toBeCloseTo(95);
		expect(anchor?.y).toBeCloseTo(50);
	});

	it("resolves an endpoint and both cable-end shapes", () => {
		const scene = {
			boards: [],
			items: [item()],
			customPedals: [customPedal],
			endpoints: [{ uid: "amp-1", kind: "amp" as const, x: 60, y: 20 }],
		};
		expect(cableEndAnchorWorld({ endpointUid: "amp-1" }, scene)).toEqual({
			x: 60,
			y: 20,
		});
		expect(cableEndAnchorWorld({ itemUid: "i1", jack: "0" }, scene)).toEqual({
			x: 15,
			y: 20,
		});
	});

	it("returns null for unknown items, gone endpoints and invalid jack refs", () => {
		expect(jackAnchorWorld(item(), "4", [], [customPedal])).toBeNull();
		expect(jackAnchorWorld(item(), "-1", [], [customPedal])).toBeNull();
		expect(jackAnchorWorld(item(), "in", [], [customPedal])).toBeNull();
		expect(
			jackAnchorWorld(item({ refId: "not-listed" }), "0", [], [customPedal]),
		).toBeNull();
		expect(jackIndex("0")).toBe(0);
		expect(jackIndex("12")).toBe(12);
		expect(jackIndex("1.5")).toBeNull();
		expect(resolveItemJacks(item(), [customPedal])).toHaveLength(4);
		expect(
			cableEndAnchorWorld(
				{ endpointUid: "gone" },
				{
					boards: [],
					items: [],
					customPedals: [],
					endpoints: [],
				},
			),
		).toBeNull();
	});
});

describe("fallback anchors (catalog pedals without jack data)", () => {
	it("synthesises the documented IN/OUT pair for a catalog pedal", () => {
		const catalogItem = item({ refId: "boss-bd-2-blues-driver" });
		const { widthCm, heightCm } = itemFootprint(catalogItem, []);
		expect(resolveItemJacks(catalogItem, [])).toEqual([...FALLBACK_JACKS]);
		expect(usesFallbackJacks(catalogItem, [])).toBe(true);
		// IN is the left-edge midpoint, OUT the right-edge midpoint.
		expect(jackAnchorWorld(catalogItem, "0", [], [])).toEqual({
			x: 10,
			y: 20 + heightCm / 2,
		});
		expect(jackAnchorWorld(catalogItem, "1", [], [])).toEqual({
			x: 10 + widthCm,
			y: 20 + heightCm / 2,
		});
	});

	it("never overrides real custom jacks and gives supplies no fallback", () => {
		expect(resolveItemJacks(item(), [customPedal])).toHaveLength(4);
		expect(usesFallbackJacks(item(), [customPedal])).toBe(false);
		const supply = item({
			refId: "custom-supply",
			kind: "supply",
		});
		const supplyDef: CustomPedal = {
			refId: "custom-supply",
			brand: "Acme",
			name: "Power",
			widthCm: 5,
			heightCm: 4,
			category: "supply",
			effectTypes: [],
		};
		expect(resolveItemJacks(supply, [supplyDef])).toEqual([]);
		expect(usesFallbackJacks(supply, [supplyDef])).toBe(false);
	});

	it("never overlaps an edge-only jack with an exact position", () => {
		const jacks = resolveJackLayout([
			{ kind: "in", edge: "top", pos: 0.5 },
			{ kind: "out", edge: "top" },
		]);
		expect(jacks[1]?.pos).toBe(0.25);
		expect(jacks[1]?.approximate).toBe(true);
	});

	it("marks edge-only jacks approximate in the anchor index", () => {
		const edgeOnly: CustomPedal = {
			...customPedal,
			refId: "custom-edge-only",
			jacks: [
				{ kind: "in", edge: "top" },
				{ kind: "out", edge: "top" },
			],
		};
		const index = buildAnchorIndex({
			boards: [],
			items: [item({ refId: "custom-edge-only" })],
			customPedals: [edgeOnly],
			endpoints: [],
		});
		expect(index.all.map((anchor) => anchor.approximate)).toEqual([true, true]);
		const first = cableEndAnchorFromIndex({ itemUid: "i1", jack: "0" }, index);
		expect(first?.point.x).toBeCloseTo(10 + 10 / 3);
		expect(first?.point.y).toBeCloseTo(20);
	});

	it("recomputes a lifted pedal's jack anchor at its transient world position", () => {
		const jack = customPedal.jacks?.[0];
		if (!jack) throw new Error("jack fixture missing");
		const anchor = {
			point: { x: 15, y: 20 },
			normal: { x: 0, y: -1 },
			assumed: false,
			jack,
		};
		const lifted = liftedJackAnchor(
			anchor,
			item({ x: 100, y: 50 }),
			[customPedal],
			{ x: 100, y: 50 },
			90,
		);
		// Item-local top-centre (5,0) → 90° → (0,5) → lifted origin (100,50).
		expect(lifted?.point.x).toBeCloseTo(100);
		expect(lifted?.point.y).toBeCloseTo(55);
		// The top normal rotates to the right edge.
		expect(lifted?.normal?.x).toBeCloseTo(1);
		expect(lifted?.normal?.y).toBeCloseTo(0);
	});

	it("builds the same anchor as jackAnchorWorld on a rotated board", () => {
		const board: PlacedBoard = {
			uid: "b1",
			boardRefId: "boss-bcb-1000",
			x: 100,
			y: 50,
			rotationDeg: 90,
		};
		const attached = item({
			boardUid: "b1",
			x: 0,
			y: 0,
			rotationDeg: 90,
		});
		const index = buildAnchorIndex({
			boards: [board],
			items: [attached],
			customPedals: [customPedal],
			endpoints: [],
		});
		const anchor = cableEndAnchorFromIndex({ itemUid: "i1", jack: "0" }, index);
		// Hand-computed: item top-centre (5,0) → item 90° → (0,5) → board 90°
		// → (-5,0) → board origin (100,50).
		expect(anchor?.point.x).toBeCloseTo(95);
		expect(anchor?.point.y).toBeCloseTo(50);
		expect(anchor?.point).toEqual(
			jackAnchorWorld(attached, "0", [board], [customPedal]),
		);
	});

	it("builds a keyed anchor index and caches it per mutation", () => {
		const scene = {
			boards: [],
			items: [item()],
			customPedals: [customPedal],
			endpoints: [{ uid: "amp-1", kind: "amp" as const, x: 60, y: 20 }],
		};
		const index = buildAnchorIndex(scene);
		expect(index.all).toHaveLength(5); // 4 jacks + 1 endpoint
		expect(cableEndKey({ itemUid: "i1", jack: "0" })).toBe("item:i1:0");
		expect(cableEndKey({ endpointUid: "amp-1" })).toBe("endpoint:amp-1");
		const anchor = cableEndAnchorFromIndex({ itemUid: "i1", jack: "0" }, index);
		expect(anchor?.point).toEqual({ x: 15, y: 20 });
		expect(anchor?.normal).toEqual({ x: 0, y: -1 });
		const memo = anchorIndexFor(scene);
		expect(anchorIndexFor(scene)).toBe(memo);
		expect(anchorIndexFor({ ...scene, items: [...scene.items] })).not.toBe(
			index,
		);
	});
});
