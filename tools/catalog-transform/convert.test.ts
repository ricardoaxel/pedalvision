import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CatalogPedalSchema } from "../../src/catalog/schema.ts";
import {
	convertExternalCatalog,
	type ExternalCatalog,
	inchesToCm,
	toSlug,
} from "./convert.ts";

const fixture = JSON.parse(
	readFileSync(
		new URL("./fixtures/external-catalog.json", import.meta.url),
		"utf8",
	),
) as ExternalCatalog;

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
		expect(toSlug("Café Crème")).toBe("cafe-creme");
		expect(toSlug("  Spaces   &  symbols!! ")).toBe("spaces-symbols");
	});
});

describe("convertExternalCatalog", () => {
	const result = convertExternalCatalog(fixture, { source: "placeholder" });

	it("skips entries missing width/height and duplicates, with warnings", () => {
		expect(result.pedals).toHaveLength(4);
		expect(result.warnings.some((w) => w.includes("No Size"))).toBe(true);
		expect(result.warnings.some((w) => w.includes("duplicate"))).toBe(true);
	});

	it("skips entries with no brand", () => {
		expect(result.pedals.some((p) => p.name === "No Brand")).toBe(false);
		expect(result.warnings.some((w) => w.includes("No Brand"))).toBe(true);
	});

	it("drops variants whose base is missing", () => {
		expect(result.pedals.some((p) => p.id === "acme-orphan-blue")).toBe(false);
		expect(result.warnings.some((w) => w.includes("acme-orphan"))).toBe(true);
	});

	it("does not treat a dropped variant as a valid base for nested variants", () => {
		expect(result.pedals.some((p) => p.id === "gamma-nested-red")).toBe(false);
		expect(result.pedals.some((p) => p.id === "gamma-nested-red-blue")).toBe(
			false,
		);
	});

	it("converts inches to cm and slugifies ids", () => {
		const fuzz = result.pedals.find((p) => p.id === "acme-big-fuzz");
		expect(fuzz).toBeDefined();
		expect(fuzz?.widthCm).toBe(6.35);
		expect(fuzz?.heightCm).toBe(11.94);
		expect(fuzz?.image).toBe("acme-big-fuzz.png");
		expect(fuzz?.effectTypes).toEqual(["fuzz"]);
		expect(fuzz?.category).toBe("pedal");
		expect(fuzz?.source).toBe("placeholder");
		expect(fuzz?.jacks).toEqual([]);
	});

	it("links colorway variants via variantOf", () => {
		const variant = result.pedals.find((p) => p.id === "acme-big-fuzz-green");
		expect(variant).toBeDefined();
		expect(variant?.variantOf).toBe("acme-big-fuzz");
		expect(variant?.name).toBe("Big Fuzz (Green)");
	});

	it("sanitizes unsafe external filenames", () => {
		const phaser = result.pedals.find((p) => p.id === "beta-swirl-phaser");
		expect(phaser?.image).toBe("swirl-phaser.png");
	});

	it("produces output that validates against the catalog schema", () => {
		for (const pedal of result.pedals) {
			expect(CatalogPedalSchema.safeParse(pedal).success).toBe(true);
		}
	});
});
