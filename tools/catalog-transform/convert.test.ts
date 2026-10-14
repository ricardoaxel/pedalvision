import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CatalogPedalSchema } from "../../src/catalog/schema.ts";
import {
	convertBoards,
	convertPedals,
	type ExternalRow,
	inchesToCm,
	toSlug,
} from "./convert.ts";

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
			category: "pedal",
			source: "placeholder",
			effectTypes: [],
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

	it("produces output that validates against the catalog schema", () => {
		for (const pedal of result.items) {
			expect(CatalogPedalSchema.safeParse(pedal).success).toBe(true);
		}
	});
});

describe("convertBoards", () => {
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
				source: "placeholder",
			},
		]);
	});
});
