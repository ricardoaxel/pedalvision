import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
	type CatalogPedal,
	CatalogPedalSchema,
} from "../../src/catalog/schema.ts";
import {
	convertBoards,
	convertPedals,
	type ExternalRow,
	inchesToCm,
	normalizeVariantFootprints,
	preserveCuration,
} from "./convert.ts";
import { toSlug } from "./slug.ts";

const fixture = JSON.parse(
	readFileSync(
		new URL("./fixtures/external-catalog.json", import.meta.url),
		"utf8",
	),
) as ExternalRow[];

describe("inchesToCm", () => {
	it("uses the 2.54 factor and rounds to 2 decimals", () => {
		expect(inchesToCm(1)).toBe(2.54);
		expect(inchesToCm(10)).toBe(25.4);
		expect(inchesToCm(2.5)).toBe(6.35);
		expect(inchesToCm(4.7)).toBe(11.94);
	});
});

describe("toSlug", () => {
	it("lowercases, strips diacritics, and hyphenates", () => {
		expect(toSlug("Boss TR-2")).toBe("boss-tr-2");
		expect(toSlug("Nuñez Amps")).toBe("nunez-amps");
		expect(toSlug("  Spaces   &  symbols!! ")).toBe("spaces-symbols");
	});
});

describe("convertPedals", () => {
	const result = convertPedals(fixture, { source: "placeholder" });

	it("skips malformed/duplicate rows and drops dangling variants", () => {
		expect(result.items).toHaveLength(5);
		for (const needle of ["No Size", "No Brand", "duplicate"]) {
			expect(result.warnings.some((w) => w.includes(needle))).toBe(true);
		}
		expect(result.items.some((p) => p.id === "gamma-nested-red-blue")).toBe(
			false,
		);
	});

	it("maps external fields to our schema (inches→cm, slug, our image name)", () => {
		const fuzz = result.items.find((p) => p.id === "acme-big-fuzz");
		expect(fuzz).toMatchObject({
			brand: "Acme",
			name: "Big Fuzz",
			widthCm: 6.35,
			heightCm: 11.94,
			image: "acme-big-fuzz.png",
			imageSource: "mock",
			category: "pedal",
			source: "placeholder",
			effectTypes: ["fuzz"],
		});
		expect(fuzz?.jacks).toBeUndefined();
	});

	it("ignores any external image name and uses the slug", () => {
		const phaser = result.items.find((p) => p.id === "beta-swirl-phaser");
		expect(phaser?.image).toBe("beta-swirl-phaser.png");
	});

	it("links colorway variants via variantOf", () => {
		const variant = result.items.find((p) => p.id === "acme-big-fuzz-green");
		expect(variant?.variantOf).toBe("acme-big-fuzz");
		expect(variant?.name).toBe("Big Fuzz (Green)");
	});

	it("tags likely power supplies", () => {
		const supply = result.items.find((p) => p.id === "acme-powerbox-iso");
		expect(supply?.category).toBe("supply");
	});

	it("tags a 'Power System' as a supply", () => {
		const { items } = convertPedals(
			[{ Brand: "Acme", Name: "CAE Power System", Width: 5, Height: 3 }],
			{ source: "placeholder" },
		);
		expect(items[0]?.category).toBe("supply");
	});

	it("skips null/non-object rows and keeps the valid ones", () => {
		const { items, warnings } = convertPedals(
			[
				null,
				{ Brand: "Acme", Name: "Big Fuzz", Width: 2.5, Height: 4.7 },
			] as unknown as ExternalRow[],
			{ source: "placeholder" },
		);
		expect(items.map((i) => i.id)).toContain("acme-big-fuzz");
		expect(warnings.some((w) => w.includes("null"))).toBe(true);
	});

	it("normalizes a colorway's dimensions to its base footprint", () => {
		const { items } = convertPedals(
			[
				{ Brand: "Acme", Name: "Big Fuzz", Width: 2.5, Height: 4.7 },
				{ Brand: "Acme", Name: "Big Fuzz (Green)", Width: 9, Height: 9 },
			],
			{ source: "placeholder" },
		);
		expect(items.find((i) => i.id === "acme-big-fuzz-green")).toMatchObject({
			widthCm: 6.35,
			heightCm: 11.94,
		});
	});

	it("produces output that validates against the catalog schema", () => {
		for (const pedal of result.items) {
			expect(CatalogPedalSchema.safeParse(pedal).success).toBe(true);
		}
	});
});

describe("normalizeVariantFootprints", () => {
	it("sets a variant to its base dims (idempotent)", () => {
		const items = [
			{ id: "b", widthCm: 6.35, heightCm: 11.94 },
			{ id: "v", variantOf: "b", widthCm: 9, heightCm: 9 },
		] as unknown as CatalogPedal[];
		normalizeVariantFootprints(items);
		expect(items[1]).toMatchObject({ widthCm: 6.35, heightCm: 11.94 });
	});
});

describe("preserveCuration", () => {
	type TestItem = {
		id: string;
		image: string;
		imageSource: "mock" | "static";
		widthCm?: number;
		heightCm?: number;
		source?: "placeholder" | "brand-assets";
		sources?: { url: string; kind: ("info" | "image")[] }[];
		power?: { voltage: number; acDc: "DC" | "AC"; currentMa: number };
		links?: { label: string; url: string }[];
	};

	it("carries curation fields (incl. corrected dimensions) from existing items, matched by id", () => {
		const next: TestItem[] = [
			{
				id: "a",
				image: "a.png",
				imageSource: "mock",
				widthCm: 9,
				heightCm: 9,
				source: "placeholder",
			},
			{ id: "b", image: "b.png", imageSource: "mock", source: "placeholder" },
		];
		const existing: TestItem[] = [
			{
				id: "a",
				image: "a.png",
				imageSource: "static",
				widthCm: 6.35,
				heightCm: 11.94,
				source: "brand-assets",
				sources: [{ url: "https://x.example/a", kind: ["info"] }],
				power: { voltage: 9, acDc: "DC", currentMa: 12 },
				links: [{ label: "Buy", url: "https://shop.example/a" }],
			},
		];
		const merged = preserveCuration(next, existing);
		expect(merged[0]).toMatchObject({
			widthCm: 6.35,
			heightCm: 11.94,
			imageSource: "static",
			source: "brand-assets",
			sources: [{ url: "https://x.example/a", kind: ["info"] }],
			power: { voltage: 9, acDc: "DC", currentMa: 12 },
			links: [{ label: "Buy", url: "https://shop.example/a" }],
		});
		// a brand-new id keeps the converter defaults
		expect(merged[1]).toMatchObject({
			imageSource: "mock",
			source: "placeholder",
		});
		expect(merged[1]).not.toHaveProperty("sources");
	});
});

describe("convertBoards", () => {
	it("skips null rows and keeps valid boards", () => {
		const { items } = convertBoards(
			[
				null,
				{ Brand: "Acme", Name: "Terra 24", Width: 24, Height: 12 },
			] as unknown as ExternalRow[],
			{ source: "placeholder" },
		);
		expect(items.map((b) => b.id)).toEqual(["acme-terra-24"]);
	});

	it("maps external rows to our board schema", () => {
		const { items } = convertBoards(
			[{ Brand: "Acme", Name: "Terra 24", Width: 24, Height: 12 }],
			{ source: "placeholder" },
		);
		expect(items).toEqual([
			{
				id: "acme-terra-24",
				brand: "Acme",
				name: "Terra 24",
				widthCm: 60.96,
				heightCm: 30.48,
				image: "acme-terra-24.png",
				imageSource: "mock",
				source: "placeholder",
			},
		]);
	});
});
