import { describe, expect, it } from "vitest";
import type {
	Cable,
	CustomPedal,
	Endpoint,
	PlacedBoard,
	PlacedItem,
} from "../state/scene";
import { buildCableSchedule } from "./cableSummary";

const pedal = (
	refId: string,
	overrides: Partial<CustomPedal> = {},
): CustomPedal => ({
	refId,
	brand: "Acme",
	name: refId,
	widthCm: 10,
	heightCm: 10,
	category: "pedal",
	effectTypes: [],
	jacks: [
		{ kind: "in", edge: "left", pos: 0.5 },
		{ kind: "out", edge: "right", pos: 0.5 },
	],
	...overrides,
});

const item = (
	uid: string,
	refId: string,
	x: number,
	y: number,
	overrides: Partial<PlacedItem> = {},
): PlacedItem => ({
	uid,
	refId,
	kind: "pedal",
	boardUid: null,
	x,
	y,
	rotationDeg: 0,
	z: 0,
	...overrides,
});

const endpoint = (
	uid: string,
	kind: Endpoint["kind"],
	x: number,
	y: number,
): Endpoint => ({ uid, kind, x, y });

const cable = (uid: string, from: Cable["from"], to: Cable["to"]): Cable => ({
	uid,
	from,
	to,
});

describe("buildCableSchedule", () => {
	it("orders the signal path instrument → pedals → amp and totals sold lengths", () => {
		const scene = {
			boards: [],
			items: [item("a", "a", 10, 10), item("b", "b", 40, 10)],
			customPedals: [pedal("a"), pedal("b")],
			endpoints: [
				endpoint("inst", "instrument", 0, 0),
				endpoint("amp", "amp", 60, 15),
			],
			cables: [
				cable("c1", { endpointUid: "inst" }, { itemUid: "a", jack: "0" }),
				cable("c2", { itemUid: "a", jack: "1" }, { itemUid: "b", jack: "0" }),
				cable("c3", { itemUid: "b", jack: "1" }, { endpointUid: "amp" }),
			],
		};
		const schedule = buildCableSchedule(scene);
		expect(schedule.rows.map((row) => row.order)).toEqual([1, 2, 3]);
		expect(schedule.rows.map((row) => row.uid)).toEqual(["c1", "c2", "c3"]);
		expect(schedule.rows[0]?.fromLabel).toBe("Instrument");
		expect(schedule.rows[0]?.toLabel).toBe("a · IN");
		expect(schedule.rows[1]?.fromLabel).toBe("a · OUT");
		expect(schedule.rows[1]?.toLabel).toBe("b · IN");
		expect(schedule.rows[2]?.toLabel).toBe("Amp input");
		expect(schedule.rows.map((row) => row.lengthCm)).toEqual([30, 30, 15]);
		expect(schedule.totals).toEqual([
			{ type: "mono", lengthCm: 15, customLengthCm: null, count: 1 },
			{ type: "mono", lengthCm: 30, customLengthCm: null, count: 2 },
		]);
		expect(schedule.totalLengthCm).toBe(75);
		expect(schedule.cableCount).toBe(3);
		expect(schedule.assumedCount).toBe(0);
		expect(schedule.unresolvedCount).toBe(0);
		expect(schedule.unconnectedItems).toEqual([]);
		expect(schedule.unconnectedEndpoints).toEqual([]);
	});

	it("derives the distance from rotated-board anchors, not the drawn curve", () => {
		const board: PlacedBoard = {
			uid: "b1",
			boardRefId: "boss-bcb-1000",
			x: 100,
			y: 50,
			rotationDeg: 90,
		};
		const scene = {
			boards: [board],
			items: [item("a", "a", 0, 0, { boardUid: "b1" }), item("b", "b", 95, 80)],
			customPedals: [pedal("a"), pedal("b")],
			endpoints: [],
			cables: [
				cable("c1", { itemUid: "a", jack: "1" }, { itemUid: "b", jack: "0" }),
			],
		};
		const row = buildCableSchedule(scene).rows[0];
		// A's OUT at board-local (10,5) → board 90° → world (95,60); B's IN (95,85).
		expect(row?.distanceCm).toBeCloseTo(25);
		expect(row?.lengthCm).toBe(60);
	});

	it("classifies TRS when either jack is stereo", () => {
		const scene = {
			boards: [],
			items: [item("a", "a", 10, 10), item("b", "b", 40, 10)],
			customPedals: [
				pedal("a", {
					jacks: [{ kind: "out", edge: "right", pos: 0.5, stereo: true }],
				}),
				pedal("b"),
			],
			endpoints: [],
			cables: [
				cable("c1", { itemUid: "a", jack: "0" }, { itemUid: "b", jack: "0" }),
			],
		};
		const schedule = buildCableSchedule(scene);
		expect(schedule.rows[0]?.type).toBe("trs");
		expect(schedule.totals[0]?.type).toBe("trs");
	});

	it("reports a custom length above 60 cm instead of clamping", () => {
		const scene = {
			boards: [],
			items: [item("a", "a", 10, 10), item("b", "b", 200, 10)],
			customPedals: [pedal("a"), pedal("b")],
			endpoints: [],
			cables: [
				cable("c1", { itemUid: "a", jack: "1" }, { itemUid: "b", jack: "0" }),
			],
		};
		const schedule = buildCableSchedule(scene);
		expect(schedule.rows[0]?.lengthCm).toBeNull();
		expect(schedule.rows[0]?.customLengthCm).toBe(202);
		expect(schedule.customCount).toBe(1);
		expect(schedule.totals[0]).toEqual({
			type: "mono",
			lengthCm: null,
			customLengthCm: 202,
			count: 1,
		});
	});

	it("flags assumed fallback jacks and unconnected pedals/endpoints", () => {
		const scene = {
			boards: [],
			items: [
				item("a", "boss-bd-2-blues-driver", 10, 10),
				item("b", "boss-da-2-adaptive-distortion", 40, 10),
				item("c", "boss-ce-2-chorus", 80, 10),
			],
			customPedals: [],
			endpoints: [
				endpoint("amp", "amp", 60, 15),
				endpoint("spare", "amp", 90, 15),
			],
			cables: [
				cable("c1", { itemUid: "a", jack: "1" }, { itemUid: "b", jack: "0" }),
			],
		};
		const schedule = buildCableSchedule(scene);
		expect(schedule.rows[0]?.assumed).toBe(true);
		expect(schedule.assumedCount).toBe(1);
		expect(schedule.rows[0]?.assumedFrom).toBe(true);
		expect(schedule.rows[0]?.assumedTo).toBe(true);
		expect(schedule.unresolvedCount).toBe(0);
		expect(schedule.rows[0]?.toLabel).toBe("DA-2 Adaptive Distortion · IN");
		expect(schedule.unconnectedItems).toEqual(["CE-2 Chorus"]);
		expect(schedule.unconnectedEndpoints).toEqual(["Amp input", "Amp input"]);
	});

	it("flags cables whose real jack positions are edge-only (approximate)", () => {
		const edgeOnly = (refId: string) =>
			pedal(refId, {
				jacks: [
					{ kind: "in", edge: "left" },
					{ kind: "out", edge: "right" },
				],
			});
		const schedule = buildCableSchedule({
			boards: [],
			items: [item("a", "a", 10, 10), item("b", "b", 40, 10)],
			customPedals: [edgeOnly("a"), edgeOnly("b")],
			endpoints: [],
			cables: [
				cable("c1", { itemUid: "a", jack: "1" }, { itemUid: "b", jack: "0" }),
			],
		});
		expect(schedule.rows[0]?.approximate).toBe(true);
		expect(schedule.rows[0]?.approximateFrom).toBe(true);
		expect(schedule.rows[0]?.approximateTo).toBe(true);
		expect(schedule.assumedCount).toBe(0);
	});

	it("defensively flags a cable whose end no longer resolves", () => {
		const scene = {
			boards: [],
			items: [item("a", "a", 10, 10)],
			customPedals: [pedal("a")],
			endpoints: [],
			cables: [
				cable(
					"c1",
					{ itemUid: "a", jack: "1" },
					{ itemUid: "ghost", jack: "0" },
				),
			],
		};
		const schedule = buildCableSchedule(scene);
		expect(schedule.unresolvedCount).toBe(1);
		expect(schedule.rows[0]?.unresolved).toBe(true);
		expect(schedule.rows[0]?.lengthCm).toBeNull();
	});

	it("includes every cable exactly once even in a feedback loop", () => {
		const scene = {
			boards: [],
			items: [item("a", "a", 10, 10), item("b", "b", 40, 10)],
			customPedals: [pedal("a"), pedal("b")],
			endpoints: [],
			cables: [
				cable("c1", { itemUid: "a", jack: "1" }, { itemUid: "b", jack: "0" }),
				cable("c2", { itemUid: "b", jack: "1" }, { itemUid: "a", jack: "0" }),
			],
		};
		const schedule = buildCableSchedule(scene);
		expect(schedule.rows.map((row) => row.uid).sort()).toEqual(["c1", "c2"]);
		expect(new Set(schedule.rows.map((row) => row.order)).size).toBe(2);
	});
});
