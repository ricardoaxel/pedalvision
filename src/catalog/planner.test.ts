import { afterAll, describe, expect, it, vi } from "vitest";
import { catalog } from "./load";
import { isPlannerPedal, loadPlannerCatalog } from "./planner";

const valid = {
	id: "test-planner-pedal",
	brand: "Test",
	name: "Planner Pedal",
	widthCm: 7,
	heightCm: 12,
	image: "test-planner-pedal.avif",
	imageSource: "static",
	effectTypes: ["utility"],
	category: "pedal",
	source: "public-asset",
	confidence: "unsure",
	notes: "Planner placeholder",
};

afterAll(() => {
	vi.unstubAllGlobals();
});

describe("planner overlay", () => {
	it("merges valid records once and rejects malformed/duplicate records", async () => {
		const curatedId = catalog.pedals[0]?.id;
		if (!curatedId) throw new Error("curated catalog is empty");
		const before = catalog.pedals.length;
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => ({
				ok: true,
				json: async () => [
					valid,
					{ ...valid, id: "bad-image", image: "../evil.avif" },
					{ ...valid, id: "bad-size", widthCm: 0 },
					{ ...valid, id: curatedId },
				],
			})),
		);

		await loadPlannerCatalog();
		expect(catalog.pedals.length).toBe(before + 1);
		expect(isPlannerPedal(valid.id)).toBe(true);
		expect(
			catalog.pedals.filter((pedal) => pedal.id === valid.id),
		).toHaveLength(1);
		expect(isPlannerPedal("bad-image")).toBe(false);
		expect(isPlannerPedal("bad-size")).toBe(false);

		await loadPlannerCatalog();
		expect(catalog.pedals.length).toBe(before + 1);
	});
});
