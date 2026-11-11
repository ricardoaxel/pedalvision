import { describe, expect, it } from "vitest";
import type { CatalogPedal, EffectType } from "../catalog/schema";
import { similarPedals } from "./similarPedals";

function pedal(
	id: string,
	brand: string,
	name: string,
	effectTypes: EffectType[],
	widthCm = 7,
	heightCm = 12,
	category: "pedal" | "supply" = "pedal",
): CatalogPedal {
	return {
		id,
		brand,
		name,
		widthCm,
		heightCm,
		image: `${id}.avif`,
		imageSource: "static",
		effectTypes,
		category,
		source: "public-asset",
	};
}

const target = pedal("boss-bd-2", "BOSS", "BD-2 Blues Driver", ["overdrive"]);

describe("similarPedals", () => {
	it("excludes the target itself and pedals without a shared effect type", () => {
		const results = similarPedals(target, [
			target,
			pedal("boss-sd-1", "BOSS", "SD-1 Super Overdrive", ["overdrive"]),
			pedal("boss-tr-2", "BOSS", "TR-2 Tremolo", ["tremolo"]),
		]);
		expect(results.map((entry) => entry.id)).toEqual(["boss-sd-1"]);
	});

	it("ignores supplies even when they share an effect type", () => {
		const results = similarPedals(target, [
			pedal(
				"psu-1",
				"Voodoo Lab",
				"Pedal Power",
				["overdrive"],
				20,
				5,
				"supply",
			),
		]);
		expect(results).toEqual([]);
	});

	it("returns nothing when the target has no effect types", () => {
		const blank = pedal("mystery", "Acme", "Mystery Box", []);
		expect(
			similarPedals(blank, [pedal("drive-1", "Acme", "Drive", ["overdrive"])]),
		).toEqual([]);
	});

	it("treats a supply target as having no catalogue alternatives", () => {
		const supply = pedal(
			"psu-target",
			"Voodoo Lab",
			"Pedal Power",
			["utility"],
			20,
			5,
			"supply",
		);
		expect(
			similarPedals(supply, [pedal("buffer", "Acme", "Buffer", ["utility"])]),
		).toEqual([]);
	});

	it("drops utility-only catch-all placeholders from the candidates", () => {
		const utilityTarget = pedal("buffer", "Acme", "Buffer", ["utility"]);
		const results = similarPedals(utilityTarget, [
			// Bulk planner placeholder: utility is its only tag.
			pedal("placeholder", "Acme", "Placeholder", ["utility"], 7, 12),
			// A real device that also records a utility role among its types.
			pedal("real", "Acme", "Line Driver", ["utility", "boost"], 7, 12),
		]);
		expect(results.map((entry) => entry.id)).toEqual(["real"]);
	});

	it("ranks by shared effect-type count, then same brand, then footprint, then name", () => {
		const targetTwo = pedal("boss-bd-2", "BOSS", "BD-2 Blues Driver", [
			"overdrive",
			"boost",
		]);
		const results = similarPedals(targetTwo, [
			// 1 shared type, same brand, far footprint.
			pedal("boss-a", "BOSS", "A Drive", ["overdrive"], 20, 20),
			// 1 shared type, other brand, closest footprint.
			pedal("other-a", "Other", "A Drive", ["overdrive"], 7, 12),
			// 2 shared types, other brand.
			pedal("multi", "Other", "Multi Drive", ["overdrive", "boost"], 7, 12),
			// 1 shared type, same brand, closest footprint.
			pedal("boss-b", "BOSS", "B Drive", ["overdrive"], 7, 12),
		]);
		expect(results.map((entry) => entry.id)).toEqual([
			"multi",
			"boss-b",
			"boss-a",
			"other-a",
		]);
	});

	it("orders ties by name for a deterministic result", () => {
		const results = similarPedals(target, [
			pedal("z", "Other", "Zeta", ["overdrive"], 7, 12),
			pedal("a", "Other", "Alpha", ["overdrive"], 7, 12),
			pedal("m", "Other", "Mike", ["overdrive"], 7, 12),
		]);
		expect(results.map((entry) => entry.id)).toEqual(["a", "m", "z"]);
	});

	it("caps the list at four by default and honours a custom limit", () => {
		const many = Array.from({ length: 8 }, (_, index) =>
			pedal(`drive-${index}`, "Other", `Drive ${index}`, ["overdrive"]),
		);
		expect(similarPedals(target, many)).toHaveLength(4);
		expect(similarPedals(target, many, 2)).toHaveLength(2);
		expect(similarPedals(target, many, 0)).toEqual([]);
	});

	it("reports the shared effect types in the target's order", () => {
		const targetMulti = pedal("target", "Acme", "Target", [
			"overdrive",
			"boost",
			"eq",
		]);
		const [result] = similarPedals(targetMulti, [
			pedal("candidate", "Acme", "Candidate", ["eq", "boost", "overdrive"]),
		]);
		expect(result?.sharedEffectTypes).toEqual(["overdrive", "boost", "eq"]);
	});

	it("does not mutate the inputs", () => {
		const pedals = [pedal("boss-sd-1", "BOSS", "SD-1", ["overdrive"]), target];
		const snapshot = JSON.stringify({ target, pedals });
		similarPedals(target, pedals);
		expect(JSON.stringify({ target, pedals })).toBe(snapshot);
	});

	it("returns the same result for repeat calls", () => {
		const pedals = [
			pedal("z", "Other", "Zeta", ["overdrive"], 7, 12),
			pedal("a", "Other", "Alpha", ["overdrive"], 7, 12),
			pedal("m", "BOSS", "Mike", ["overdrive"], 7, 12),
		];
		expect(similarPedals(target, pedals)).toEqual(
			similarPedals(target, pedals),
		);
	});
});
