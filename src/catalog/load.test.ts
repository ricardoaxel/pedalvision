import { describe, expect, it } from "vitest";
import { catalog, parseBoards, parseCatalog, parsePedals } from "./load";
import type { CatalogPedal } from "./schema";

const validPedal: CatalogPedal = {
	id: "acme-big-fuzz",
	brand: "Acme",
	name: "Big Fuzz",
	widthCm: 6.35,
	heightCm: 11.94,
	image: "acme-big-fuzz.png",
	effectTypes: [],
	category: "pedal",
	source: "placeholder",
};

describe("committed catalog seed", () => {
	it("validates and meets the seed size", () => {
		expect(catalog.pedals.length).toBeGreaterThanOrEqual(200);
		expect(catalog.boards).toHaveLength(10);
	});

	it("covers at least 10 brands and includes the largest one", () => {
		const brands = new Set(catalog.pedals.map((p) => p.brand));
		expect(brands.size).toBeGreaterThanOrEqual(10);
		expect(catalog.pedals.some((p) => p.brand === "BOSS")).toBe(true);
	});

	it("is placeholder-sourced (mock images) and license-state explicit", () => {
		expect(catalog.pedals.every((p) => p.source === "placeholder")).toBe(true);
		expect(catalog.boards.every((b) => b.source === "placeholder")).toBe(true);
	});

	it("has unique ids", () => {
		expect(new Set(catalog.pedals.map((p) => p.id)).size).toBe(
			catalog.pedals.length,
		);
		expect(new Set(catalog.boards.map((b) => b.id)).size).toBe(
			catalog.boards.length,
		);
	});
});

describe("parsePedals", () => {
	it("accepts valid data", () => {
		expect(parsePedals([validPedal])).toHaveLength(1);
	});

	it("throws on a broken entry", () => {
		expect(() => parsePedals([{ ...validPedal, widthCm: -1 }])).toThrow(
			/pedals\.json/,
		);
	});

	it("throws on duplicate ids", () => {
		expect(() => parsePedals([validPedal, validPedal])).toThrow(/duplicate/);
	});

	it("throws when variantOf references a missing pedal", () => {
		expect(() =>
			parsePedals([{ ...validPedal, variantOf: "missing-model" }]),
		).toThrow(/variantOf/);
	});

	it("throws when a pedal is its own variantOf", () => {
		expect(() =>
			parsePedals([{ ...validPedal, variantOf: validPedal.id }]),
		).toThrow(/its own variantOf/);
	});

	it("accepts a variant whose base is present", () => {
		const variant = {
			...validPedal,
			id: "acme-big-fuzz-green",
			variantOf: "acme-big-fuzz",
		};
		expect(parsePedals([validPedal, variant])).toHaveLength(2);
	});
});

describe("parseCatalog", () => {
	it("throws when boards are invalid", () => {
		expect(() => parseCatalog([validPedal], [{ id: "x" }])).toThrow(
			/boards\.json/,
		);
	});

	it("accepts an empty catalog", () => {
		expect(parseCatalog([], [])).toEqual({ pedals: [], boards: [] });
	});
});

describe("parseBoards", () => {
	it("throws on a broken board", () => {
		expect(() => parseBoards([{ id: "x" }])).toThrow(/boards\.json/);
	});
});
