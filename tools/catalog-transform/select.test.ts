import { describe, expect, it } from "vitest";
import type { CatalogBoard, CatalogPedal } from "../../src/catalog/schema.ts";
import { selectBoards, selectPedals } from "./select.ts";

function pedal(brand: string, name: string): CatalogPedal {
	const id = `${brand}-${name}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
	return {
		id,
		brand,
		name,
		widthCm: 1,
		heightCm: 1,
		image: `${id}.png`,
		effectTypes: [],
		category: "pedal",
		source: "placeholder",
	};
}

function board(brand: string, name: string): CatalogBoard {
	const id = `${brand}-${name}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
	return {
		id,
		brand,
		name,
		widthCm: 1,
		heightCm: 1,
		image: `${id}.png`,
		source: "placeholder",
	};
}

describe("selectPedals", () => {
	const pedals = [
		...["a1", "a2", "a3", "a4", "a5"].map((n) => pedal("AAA", n)),
		...["b1", "b2", "b3"].map((n) => pedal("BBB", n)),
		pedal("CCC", "c1"),
	];

	it("keeps the largest brand as the biggest group", () => {
		const out = selectPedals(pedals, {
			brandLimit: 2,
			topBrandCap: 3,
			perBrandCap: 1,
		});
		expect(out).toHaveLength(4);
		expect(out.filter((p) => p.brand === "AAA")).toHaveLength(3);
		expect(out.filter((p) => p.brand === "BBB")).toHaveLength(1);
		expect(out.some((p) => p.brand === "CCC")).toBe(false);
	});

	it("is deterministic", () => {
		const opts = { brandLimit: 3, topBrandCap: 5, perBrandCap: 2 };
		expect(selectPedals(pedals, opts)).toEqual(selectPedals(pedals, opts));
	});

	it("does not top up a supply whose variant base is absent", () => {
		const withOrphanSupply: CatalogPedal[] = [
			...["a1", "a2", "a3", "a4", "a5"].map((n) => pedal("AAA", n)),
			{
				...pedal("Supco", "Power Box (Black)"),
				category: "supply",
				variantOf: "supco-power-box",
			},
		];
		const out = selectPedals(withOrphanSupply, {
			brandLimit: 1,
			topBrandCap: 3,
			perBrandCap: 1,
			supplyLimit: 5,
		});
		expect(out.some((p) => p.category === "supply")).toBe(false);
		expect(out.some((p) => p.variantOf)).toBe(false);
	});
});

describe("selectBoards", () => {
	const boards = [
		board("AAA", "1"),
		board("AAA", "2"),
		board("BBB", "1"),
		board("BBB", "2"),
		board("CCC", "1"),
	];

	it("spreads across brands round-robin", () => {
		expect(selectBoards(boards, 3).map((b) => b.id)).toEqual([
			"aaa-1",
			"bbb-1",
			"ccc-1",
		]);
	});

	it("stops when the limit exceeds available boards", () => {
		expect(selectBoards(boards, 99)).toHaveLength(5);
	});
});
