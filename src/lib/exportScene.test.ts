import { describe, expect, it } from "vitest";
import type { CustomPedal, PlacedBoard, PlacedItem } from "../state/scene";
import {
	boardAabbCm,
	ENDPOINT_MARGIN_CM,
	EXPORT_MAX_EDGE_PX,
	EXPORT_MAX_PIXEL_RATIO,
	EXPORT_MAX_PIXELS,
	EXPORT_PADDING_CM,
	type ExportCable,
	type ExportEndpoint,
	type ExportSceneInput,
	exportFileName,
	resolveExportPlan,
} from "./exportScene";

function board(overrides: Partial<PlacedBoard> = {}): PlacedBoard {
	return {
		uid: "board-1",
		boardRefId: null,
		customSize: { widthCm: 60, heightCm: 30 },
		texture: "matte",
		x: 0,
		y: 0,
		rotationDeg: 0,
		...overrides,
	};
}

function item(overrides: Partial<PlacedItem> = {}): PlacedItem {
	return {
		uid: "item-1",
		refId: "custom-1",
		kind: "pedal",
		boardUid: "board-1",
		x: 5,
		y: 5,
		rotationDeg: 0,
		z: 0,
		...overrides,
	};
}

const CUSTOM_PEDAL: CustomPedal = {
	refId: "custom-1",
	brand: "Test",
	name: "Part",
	widthCm: 10,
	heightCm: 6,
	category: "pedal",
	effectTypes: [],
};

const CUSTOM_PEDAL_2: CustomPedal = { ...CUSTOM_PEDAL, refId: "custom-2" };

function scene(overrides: Partial<ExportSceneInput> = {}): ExportSceneInput {
	return {
		boards: [board()],
		items: [item()],
		customPedals: [CUSTOM_PEDAL, CUSTOM_PEDAL_2],
		endpoints: [],
		cables: [],
		...overrides,
	};
}

function endpoint(
	uid: string,
	x: number,
	y = 15,
	kind: ExportEndpoint["kind"] = "amp",
): ExportEndpoint {
	return { uid, kind, x, y };
}

describe("boardAabbCm", () => {
	it("is rotation-aware about the board origin", () => {
		const rotated = board({
			x: 10,
			y: 10,
			rotationDeg: 90,
			customSize: { widthCm: 40, heightCm: 20 },
		});
		const aabb = boardAabbCm(rotated);
		expect(aabb.x).toBeCloseTo(-10);
		expect(aabb.y).toBeCloseTo(10);
		expect(aabb.widthCm).toBeCloseTo(20);
		expect(aabb.heightCm).toBeCloseTo(40);
	});
});

describe("resolveExportPlan — selected board", () => {
	it("requires a board uid", () => {
		expect(() => resolveExportPlan(scene(), { scope: "board" })).toThrow(
			/select a board/i,
		);
	});

	it("includes only the selected board's attached items", () => {
		const otherBoard = board({ uid: "board-2", x: 200 });
		const otherItem = item({
			uid: "item-2",
			refId: "custom-2",
			boardUid: "board-2",
		});
		const plan = resolveExportPlan(
			scene({
				boards: [board(), otherBoard],
				items: [item(), otherItem],
			}),
			{ scope: "board", boardUid: "board-1" },
		);

		expect(plan.boards.map((candidate) => candidate.uid)).toEqual(["board-1"]);
		expect(plan.items.map((candidate) => candidate.uid)).toEqual(["item-1"]);
		expect(plan.cables).toEqual([]);
		expect(plan.endpoints).toEqual([]);
	});

	it("keeps a cable only when BOTH ends are in scope", () => {
		const e1 = endpoint("amp-1", 80);
		const e2 = endpoint("amp-2", 200);
		const otherBoard = board({ uid: "board-2", x: 200 });
		const otherItem = item({
			uid: "item-2",
			refId: "custom-2",
			boardUid: "board-2",
		});
		const cable = (uid: string, to: ExportCable["to"]): ExportCable => ({
			uid,
			from: { itemUid: "item-1", jack: "out" },
			to,
		});
		const cables: ExportCable[] = [
			cable("same-board", { itemUid: "item-1", jack: "in" }),
			cable("other-board", { itemUid: "item-2", jack: "in" }),
			cable("near-endpoint", { endpointUid: "amp-1" }),
			cable("far-endpoint", { endpointUid: "amp-2" }),
		];
		const plan = resolveExportPlan(
			scene({
				boards: [board(), otherBoard],
				items: [item(), otherItem],
				endpoints: [e1, e2],
				cables,
			}),
			{ scope: "board", boardUid: "board-1" },
		);

		expect(plan.cables.map((candidate) => candidate.uid)).toEqual([
			"same-board",
			"near-endpoint",
		]);
		expect(plan.endpoints.map((candidate) => candidate.uid)).toEqual(["amp-1"]);
	});

	it("includes an attached item's rotated corners in the bounds", () => {
		const rotatedBoard = board({
			x: 10,
			y: 10,
			rotationDeg: 90,
			customSize: { widthCm: 40, heightCm: 20 },
		});
		const attached = item({ uid: "edge", refId: "custom-2", x: 35, y: 5 });
		const plan = resolveExportPlan(
			scene({ boards: [rotatedBoard], items: [attached] }),
			{ scope: "board", boardUid: "board-1" },
		);

		// The item's rotated AABB reaches world y=55, 5 cm past the board's own
		// rotated bounds — the export frame must include it.
		expect(plan.items.map((candidate) => candidate.uid)).toEqual(["edge"]);
		expect(plan.boundsCm.y + plan.boundsCm.heightCm).toBeCloseTo(
			55 + EXPORT_PADDING_CM,
		);
		expect(plan.boundsCm.x).toBeCloseTo(-10 - EXPORT_PADDING_CM);
	});

	it("applies the endpoint margin to the board bounds", () => {
		const e1 = endpoint("amp-1", 60 + ENDPOINT_MARGIN_CM - 1);
		const plan = resolveExportPlan(
			scene({
				endpoints: [e1],
				cables: [
					{
						uid: "cable",
						from: { itemUid: "item-1", jack: "out" },
						to: { endpointUid: "amp-1" },
					},
				],
			}),
			{ scope: "board", boardUid: "board-1" },
		);

		expect(plan.endpoints).toHaveLength(1);
		expect(plan.boundsCm.x).toBeCloseTo(-EXPORT_PADDING_CM);
		expect(plan.boundsCm.x + plan.boundsCm.widthCm).toBeCloseTo(
			e1.x + EXPORT_PADDING_CM,
		);
	});

	it("drops a cable to an endpoint outside the margin", () => {
		const far = endpoint("amp-1", 60 + ENDPOINT_MARGIN_CM + 1);
		const plan = resolveExportPlan(
			scene({
				endpoints: [far],
				cables: [
					{
						uid: "cable",
						from: { itemUid: "item-1", jack: "out" },
						to: { endpointUid: "amp-1" },
					},
				],
			}),
			{ scope: "board", boardUid: "board-1" },
		);

		expect(plan.cables).toEqual([]);
		expect(plan.endpoints).toEqual([]);
	});
});

describe("resolveExportPlan — all content", () => {
	it("throws when the scene is empty", () => {
		expect(() =>
			resolveExportPlan(
				{ boards: [], items: [], customPedals: [] },
				{ scope: "all" },
			),
		).toThrow(/nothing to export/i);
	});

	it("includes boards + loose items + endpoints + cables", () => {
		const loose = item({
			uid: "loose",
			refId: "custom-2",
			boardUid: null,
			x: 5,
			y: 40,
		});
		const plan = resolveExportPlan(
			scene({
				items: [item(), loose],
				endpoints: [endpoint("amp-1", 60)],
				cables: [
					{
						uid: "cable",
						from: { itemUid: "item-1", jack: "out" },
						to: { endpointUid: "amp-1" },
					},
				],
			}),
			{ scope: "all" },
		);

		expect(plan.boards).toHaveLength(1);
		expect(plan.items.map((candidate) => candidate.uid)).toContain("loose");
		expect(plan.endpoints).toHaveLength(1);
		expect(plan.cables).toHaveLength(1);
	});

	it("includes a far-away loose item (all content means all content)", () => {
		const near = item({
			uid: "near",
			refId: "custom-2",
			boardUid: null,
			x: 70,
			y: 5,
		});
		const far = item({
			uid: "far",
			refId: "custom-2",
			boardUid: null,
			x: 300,
			y: 300,
		});
		const plan = resolveExportPlan(scene({ items: [item(), near, far] }), {
			scope: "all",
		});

		expect(plan.items.map((candidate) => candidate.uid)).toContain("far");
		expect(plan.items.map((candidate) => candidate.uid)).toContain("near");
		expect(
			plan.contentBoundsCm.x + plan.contentBoundsCm.widthCm,
		).toBeGreaterThan(300);
		expect(
			plan.contentBoundsCm.y + plan.contentBoundsCm.heightCm,
		).toBeGreaterThan(300);
	});

	it("includes far endpoints and cables in all-content scope", () => {
		const near = endpoint("near", 60);
		const far = endpoint("far", 400);
		const plan = resolveExportPlan(
			scene({
				endpoints: [near, far],
				cables: [
					{
						uid: "near-cable",
						from: { itemUid: "item-1", jack: "out" },
						to: { endpointUid: "near" },
					},
					{
						uid: "far-cable",
						from: { itemUid: "item-1", jack: "out" },
						to: { endpointUid: "far" },
					},
				],
			}),
			{ scope: "all" },
		);

		expect(plan.endpoints.map((candidate) => candidate.uid)).toEqual([
			"near",
			"far",
		]);
		expect(plan.cables.map((candidate) => candidate.uid)).toEqual([
			"near-cable",
			"far-cable",
		]);
	});
});

describe("pixel clamp + output size", () => {
	it("caps a huge plan at the edge/area budget", () => {
		const huge = board({
			customSize: { widthCm: 400, heightCm: 400 },
		});
		const plan = resolveExportPlan(scene({ boards: [huge], items: [] }), {
			scope: "all",
		});

		expect(plan.outputWidthPx).toBeLessThanOrEqual(EXPORT_MAX_EDGE_PX);
		expect(plan.outputHeightPx).toBeLessThanOrEqual(EXPORT_MAX_EDGE_PX);
		expect(plan.outputWidthPx * plan.outputHeightPx).toBeLessThanOrEqual(
			EXPORT_MAX_PIXELS,
		);
		expect(plan.pixelRatio).toBeLessThanOrEqual(EXPORT_MAX_PIXEL_RATIO);
		expect(plan.clampLimited).toBe(true);
	});

	it("uses Standard by default: 32 px/cm at 1× (~81 PPI)", () => {
		const plan = resolveExportPlan(scene(), { scope: "all" });
		const widthCm = plan.boundsCm.widthCm;
		expect(plan.quality).toBe("standard");
		expect(plan.pxPerCm).toBe(32);
		expect(plan.outputWidthPx).toBe(Math.floor(widthCm * 32));
		expect(plan.pixelRatio).toBe(1);
		expect(plan.outputPpi).toBeGreaterThan(75);
		expect(plan.outputPpi).toBeLessThan(90);
		expect(plan.clampLimited).toBe(false);
	});

	it("HD doubles the density and uses the area budget (~200 PPI)", () => {
		const standard = resolveExportPlan(scene(), { scope: "all" });
		const hd = resolveExportPlan(scene(), { scope: "all", quality: "hd" });
		expect(hd.quality).toBe("hd");
		expect(hd.pxPerCm).toBe(64);
		expect(hd.outputWidthPx).toBeGreaterThan(standard.outputWidthPx * 2);
		expect(hd.pixelRatio).toBeGreaterThan(1);
		expect(hd.pixelRatio).toBeLessThanOrEqual(EXPORT_MAX_PIXEL_RATIO);
		expect(hd.outputPpi).toBeGreaterThan(180);
		expect(hd.outputWidthPx * hd.outputHeightPx).toBeLessThanOrEqual(
			EXPORT_MAX_PIXELS,
		);
	});

	it("allows a wide plan past 4096 in Standard within the area budget", () => {
		const wide = board({ customSize: { widthCm: 180, heightCm: 70 } });
		const plan = resolveExportPlan(scene({ boards: [wide], items: [] }), {
			scope: "all",
		});

		expect(plan.outputWidthPx).toBeGreaterThan(4096);
		expect(plan.outputWidthPx).toBeLessThanOrEqual(EXPORT_MAX_EDGE_PX);
		expect(plan.outputWidthPx * plan.outputHeightPx).toBeLessThanOrEqual(
			EXPORT_MAX_PIXELS,
		);
		expect(plan.pixelRatio).toBe(1);
		expect(plan.clampLimited).toBe(false);
		expect(plan.outputPpi).toBeGreaterThan(75);
	});

	it("never returns a zero-size output", () => {
		const tiny = board({ customSize: { widthCm: 0.1, heightCm: 0.1 } });
		const plan = resolveExportPlan(scene({ boards: [tiny], items: [] }), {
			scope: "all",
		});
		expect(plan.stageWidthPx).toBeGreaterThan(0);
		expect(plan.stageHeightPx).toBeGreaterThan(0);
		expect(plan.outputWidthPx).toBeGreaterThan(0);
		expect(plan.outputHeightPx).toBeGreaterThan(0);
	});
});

describe("exportFileName", () => {
	it("uses the board label + local date", () => {
		const plan = resolveExportPlan(scene(), {
			scope: "board",
			boardUid: "board-1",
		});
		expect(exportFileName(plan, "Boss BCB-60", new Date(2026, 9, 19))).toBe(
			"pedalvision-boss-bcb-60-2026-10-19.png",
		);
	});

	it("falls back to plan for all-content exports", () => {
		const plan = resolveExportPlan(scene(), { scope: "all" });
		expect(exportFileName(plan, null, new Date(2026, 0, 2))).toBe(
			"pedalvision-plan-2026-01-02.png",
		);
	});

	it("uses the requested extension", () => {
		const plan = resolveExportPlan(scene(), { scope: "all" });
		expect(exportFileName(plan, null, new Date(2026, 0, 2), "pdf")).toBe(
			"pedalvision-plan-2026-01-02.pdf",
		);
	});
});
