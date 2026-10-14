import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { type CatalogPedal, EFFECT_TYPES } from "../../src/catalog/schema.ts";
import {
	CURATED_EFFECTS,
	CURATED_SUPPLIES,
	deriveCategory,
	deriveEffectTypes,
} from "./curated.ts";
import { classifyEffects } from "./effects.ts";

const committedPedals = JSON.parse(
	readFileSync(
		new URL("../../src/catalog/data/pedals.json", import.meta.url),
		"utf8",
	),
) as CatalogPedal[];

describe("classifyEffects", () => {
	it("maps common effect keywords to our effect types", () => {
		expect(classifyEffects("BD-2 Blues Driver")).toEqual(["overdrive"]);
		expect(classifyEffects("MT-2 Metal Zone")).toEqual(["distortion"]);
		expect(classifyEffects("DD-3 Digital Delay")).toEqual(["delay"]);
		expect(classifyEffects("RV-6 Reverb")).toEqual(["reverb"]);
		expect(classifyEffects("CE-2 Chorus")).toEqual(["chorus"]);
		expect(classifyEffects("Big Muff Pi")).toEqual(["fuzz"]);
		expect(classifyEffects("TU-3 Tuner")).toEqual(["tuner"]);
	});

	it("can return multiple types (multi-effect names)", () => {
		expect(classifyEffects("Delay & Reverb")).toEqual(["delay", "reverb"]);
	});

	it("maps non-effect roles from the name", () => {
		expect(classifyEffects("A/B Box")).toEqual(["ab-box"]);
		expect(classifyEffects("Bass DI+")).toEqual(["di"]);
		expect(classifyEffects("CAE Buffer")).toEqual(["buffer"]);
		expect(classifyEffects("B9 Organ Machine")).toEqual(["organ-sim"]);
		expect(classifyEffects("8 Step Program")).toEqual(["sequencer"]);
	});

	it("classifies a variant by its base name (no colorway-suffix leak)", () => {
		expect(
			deriveEffectTypes({ brand: "Acme", name: "Big Fuzz (Metal)" }),
		).toEqual(["fuzz"]);
	});

	it("leaves creatively-named pedals unclassified (no guessing)", () => {
		expect(classifyEffects("Julia")).toEqual([]);
		expect(classifyEffects("Morning Glory")).toEqual([]);
	});

	it("does not misfire on power-box model numbers (PB-109)", () => {
		expect(classifyEffects("PB-109 Power Box Li2")).toEqual([]);
	});

	it("does not over-match short role tokens (word boundaries)", () => {
		// "di" must not fire inside "Digital"/"Dimension".
		expect(classifyEffects("Digital Dimension")).toEqual([]);
		expect(classifyEffects("Medium")).toEqual([]);
		expect(classifyEffects("Phat Cat")).toEqual([]);
	});
});

describe("curated overrides", () => {
	it("only uses our taxonomy", () => {
		const known = new Set<string>(EFFECT_TYPES);
		for (const [key, types] of Object.entries(CURATED_EFFECTS)) {
			for (const type of types)
				expect(known.has(type), `${key}:${type}`).toBe(true);
		}
	});

	it("has no dead entries (every key is a committed base model)", () => {
		const ids = new Set(committedPedals.map((p) => p.id));
		for (const key of Object.keys(CURATED_EFFECTS)) {
			expect(ids.has(key), key).toBe(true);
		}
		for (const key of CURATED_SUPPLIES) {
			expect(ids.has(key), key).toBe(true);
		}
	});

	it("every curated base model carries verified source links", () => {
		const byId = new Map(committedPedals.map((p) => [p.id, p]));
		for (const key of Object.keys(CURATED_EFFECTS)) {
			expect(byId.get(key)?.sources?.length ?? 0, key).toBeGreaterThan(0);
		}
	});

	it("marks a verified supply as a supply (Aetos)", () => {
		expect(deriveCategory({ brand: "Walrus Audio", name: "Aetos" })).toBe(
			"supply",
		);
	});

	it("does not treat an IEM amp as a power supply (Powerplay P1)", () => {
		expect(deriveCategory({ brand: "Behringer", name: "Powerplay P1" })).toBe(
			"pedal",
		);
		expect(
			deriveEffectTypes({ brand: "Behringer", name: "Powerplay P1" }),
		).toEqual(["utility"]);
	});
});

describe("committed seed effectTypes", () => {
	const pedals = committedPedals;

	it("matches a fresh derivation for every pedal (curated + classifier, no drift)", () => {
		for (const pedal of pedals) {
			const input = {
				brand: pedal.brand,
				name: pedal.name,
				variantOf: pedal.variantOf,
			};
			expect(pedal.effectTypes, `${pedal.id} effectTypes`).toEqual(
				deriveEffectTypes(input),
			);
			expect(pedal.category, `${pedal.id} category`).toBe(
				deriveCategory(input),
			);
		}
	});

	it("carries official image-source links for verified models", () => {
		const withImage = pedals.filter((p) =>
			(p.sources ?? []).some((s) => s.kind.includes("image")),
		);
		expect(withImage).toHaveLength(170);
		for (const pedal of pedals) {
			for (const source of pedal.sources ?? []) {
				expect(source.kind.length, `${pedal.id} ${source.url}`).toBeGreaterThan(
					0,
				);
				expect(source.url.startsWith("https://"), source.url).toBe(true);
				// an archive/bundle is never an image source
				if (/\.(zip|rar|7z|tar|gz)(\?|$)/i.test(source.url)) {
					expect(source.kind, source.url).not.toContain("image");
				}
			}
		}
	});

	it("classifies a meaningful share of the seed", () => {
		const classified = pedals.filter((p) => p.effectTypes.length > 0).length;
		expect(classified).toBeGreaterThan(pedals.length * 0.9);
	});
});
