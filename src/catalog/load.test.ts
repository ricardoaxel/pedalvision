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
	effectTypes: ["fuzz"],
	category: "pedal",
	source: "synthetic",
};

describe("committed synthetic seed", () => {
	it("validates and meets the seed size", () => {
		expect(catalog.pedals.length).toBeGreaterThanOrEqual(50);
		expect(catalog.boards).toHaveLength(10);
	});

	it("is license-clean (synthetic provenance) and includes supplies", () => {
		expect(catalog.pedals.every((p) => p.source === "synthetic")).toBe(true);
		expect(catalog.boards.every((b) => b.source === "synthetic")).toBe(true);
		expect(catalog.pedals.some((p) => p.category === "supply")).toBe(true);
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
