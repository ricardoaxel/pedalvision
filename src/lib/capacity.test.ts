import { describe, expect, it } from "vitest";
import { catalog } from "../catalog/load";
import {
	addItemRefusal,
	boardAddRefusal,
	CAPACITY,
	type CapacityScene,
	capacityStatus,
	distinctImageCount,
	duplicateRefusal,
	exportCapacity,
	formatEstimatedBytes,
	graphAddRefusal,
	sceneObjectCounts,
} from "./capacity";

const PEDAL_A = catalog.pedals[0].id;
const PEDAL_B = catalog.pedals[1].id;
const BOARD_A = catalog.boards[0].id;

function scene(overrides: Partial<CapacityScene> = {}): CapacityScene {
	return {
		boards: [],
		items: [],
		customPedals: [],
		cables: [],
		endpoints: [],
		...overrides,
	};
}

function items(count: number, refId = PEDAL_A) {
	return Array.from({ length: count }, () => ({
		refId,
		kind: "pedal" as const,
	}));
}

function cables(count: number) {
	return Array.from({ length: count }, () => ({}));
}

describe("capacity constants", () => {
	it("matches the documented v1 budgets", () => {
		expect(CAPACITY.items).toEqual({ soft: 200, hard: 400 });
		expect(CAPACITY.distinctImages).toEqual({ soft: 150, hard: 250 });
		expect(CAPACITY.boards).toEqual({ soft: 8, hard: 10 });
		expect(CAPACITY.graph).toEqual({ soft: 150, hard: 300 });
		expect(CAPACITY.scenes.hard).toBe(10);
	});
});

describe("sceneObjectCounts", () => {
	it("counts every scene array, including supplies, custom parts and the shared graph budget", () => {
		const counts = sceneObjectCounts(
			scene({
				boards: [{ boardRefId: BOARD_A }, { boardRefId: null }],
				items: [
					{ refId: PEDAL_A, kind: "pedal" },
					{ refId: PEDAL_A, kind: "pedal" },
					{ refId: "supply-1", kind: "supply" },
					{ refId: "custom-1", kind: "pedal" },
				],
				customPedals: [{ refId: "custom-1" }],
				cables: cables(2),
				endpoints: cables(1),
			}),
		);

		expect(counts).toMatchObject({
			boards: 2,
			items: 4,
			pedals: 3,
			supplies: 1,
			customItems: 1,
			customDefinitions: 1,
			cables: 2,
			endpoints: 1,
			graph: 3,
		});
	});

	it("treats cables and endpoints as one shared graph budget", () => {
		const status = capacityStatus(
			scene({ cables: cables(100), endpoints: cables(50) }),
		);
		expect(status.graph.value).toBe(150);
		expect(status.graph.level).toBe("soft");

		const hard = capacityStatus(
			scene({ cables: cables(200), endpoints: cables(100) }),
		);
		expect(hard.graph.level).toBe("hard");
		expect(hard.warning).toContain("connection limit");
	});
});

describe("distinctImageCount", () => {
	it("dedupes repeated catalog images", () => {
		expect(distinctImageCount(scene({ items: items(5, PEDAL_A) }))).toBe(1);
		expect(
			distinctImageCount(
				scene({
					items: [...items(3, PEDAL_A), ...items(2, PEDAL_B)],
				}),
			),
		).toBe(2);
	});

	it("exempts custom (text-only) parts and unknown refs", () => {
		const value = scene({
			items: [
				{ refId: PEDAL_A, kind: "pedal" },
				{ refId: "custom-1", kind: "pedal" },
				{ refId: "missing-ref", kind: "pedal" },
			],
			customPedals: [{ refId: "custom-1" }],
		});
		expect(distinctImageCount(value)).toBe(1);
	});
});

describe("capacityStatus", () => {
	it("is quiet below the soft threshold", () => {
		const status = capacityStatus(
			scene({
				boards: [{ boardRefId: BOARD_A }],
				items: items(10),
			}),
		);
		expect(status.level).toBe("ok");
		expect(status.warning).toBeNull();
	});

	it("warns softly at 200 parts and refuses adds at 400", () => {
		const soft = capacityStatus(scene({ items: items(200) }));
		expect(soft.items.level).toBe("soft");
		expect(soft.warning).toBe("200 of 200 parts — approaching the item limit.");

		const hard = capacityStatus(scene({ items: items(400) }));
		expect(hard.items.level).toBe("hard");
		expect(addItemRefusal(scene({ items: items(400) }), PEDAL_A)).toContain(
			"at the item limit",
		);
		expect(addItemRefusal(scene({ items: items(399) }), PEDAL_A)).toBeNull();
	});

	it("warns softly at 8 boards and refuses a board at 10", () => {
		const soft = capacityStatus(
			scene({
				boards: Array.from({ length: 8 }, () => ({ boardRefId: BOARD_A })),
			}),
		);
		expect(soft.boards.level).toBe("soft");
		expect(
			boardAddRefusal(
				scene({
					boards: Array.from({ length: 10 }, () => ({ boardRefId: BOARD_A })),
				}),
			),
		).toContain("at the board limit");
		expect(
			boardAddRefusal(
				scene({
					boards: Array.from({ length: 9 }, () => ({ boardRefId: BOARD_A })),
				}),
			),
		).toBeNull();
	});

	it("refuses a duplicate at the item cap but not below it", () => {
		expect(duplicateRefusal(scene({ items: items(400) }))).toBe(
			"Item limit reached. Remove a part to duplicate.",
		);
		expect(duplicateRefusal(scene({ items: items(399) }))).toBeNull();
	});

	it("refuses a cable/endpoint at the shared graph cap", () => {
		const full = scene({ cables: cables(300) });
		expect(graphAddRefusal(full)).toContain("at the connection limit");
		expect(graphAddRefusal(scene({ cables: cables(299) }))).toBeNull();
	});

	it("keeps an over-cap recovered scene measurable (never rejects it)", () => {
		const status = capacityStatus(
			scene({
				boards: Array.from({ length: 11 }, () => ({ boardRefId: null })),
				items: items(420),
				cables: cables(310),
			}),
		);
		expect(status.level).toBe("hard");
		expect(status.boards.over).toBe(true);
		expect(status.items.over).toBe(true);
		expect(status.graph.over).toBe(true);
		expect(status.warning).toContain("still opens");
	});
});

describe("export estimate", () => {
	it("stays quiet at the 12 MP soft threshold", () => {
		const value = exportCapacity(4000, 3000, "png");
		expect(value.megapixels).toBe(12);
		expect(value.warning).toBeNull();
	});

	it("warns just above 12 MP and includes the estimated size", () => {
		const value = exportCapacity(4100, 3000, "png");
		expect(value.warning).toContain("Large export — 12.3 MP");
		expect(value.warning).toContain("Saving may be slow on phones.");
	});

	it("estimates PNG larger than PDF and formats sizes", () => {
		const png = exportCapacity(4000, 4000, "png");
		const pdf = exportCapacity(4000, 4000, "pdf");
		expect(png.estimatedBytes).toBeGreaterThan(pdf.estimatedBytes);
		expect(formatEstimatedBytes(18_000_000)).toBe("about 18 MB");
		expect(formatEstimatedBytes(1_400_000)).toBe("about 1.4 MB");
		expect(formatEstimatedBytes(640_000)).toBe("about 640 KB");
	});
});
