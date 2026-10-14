import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { CatalogPedal } from "../../src/catalog/schema.ts";
import { classifyEffects } from "./effects.ts";

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

	it("leaves creatively-named pedals unclassified (no guessing)", () => {
		expect(classifyEffects("Julia")).toEqual([]);
		expect(classifyEffects("Morning Glory")).toEqual([]);
	});

	it("does not misfire on power-box model numbers (PB-109)", () => {
		expect(classifyEffects("PB-109 Power Box Li2")).toEqual([]);
	});
});

describe("committed seed effectTypes", () => {
	const pedals = JSON.parse(
		readFileSync(
			new URL("../../src/catalog/data/pedals.json", import.meta.url),
			"utf8",
		),
	) as CatalogPedal[];

	it("matches a fresh classification of every name (no drift)", () => {
		for (const pedal of pedals) {
			expect(pedal.effectTypes, pedal.id).toEqual(classifyEffects(pedal.name));
		}
	});

	it("classifies a meaningful share of the seed", () => {
		const classified = pedals.filter((p) => p.effectTypes.length > 0).length;
		expect(classified).toBeGreaterThan(pedals.length * 0.4);
	});
});
