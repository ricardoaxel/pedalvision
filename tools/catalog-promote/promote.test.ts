import { describe, expect, it } from "vitest";
import {
	filterSources,
	promoteLegacy,
	type RuntimePedalLike,
} from "./promote.ts";

const LEGACY: RuntimePedalLike[] = [
	{
		id: "electro-harmonix-big-muff",
		brand: "Electro-Harmonix",
		name: "Big Muff",
		widthCm: 9.5,
		heightCm: 12.1,
		category: "pedal",
		effectTypes: ["fuzz"],
		image: "https://example.com/big-muff.png",
		imageSource: "url",
		source: "placeholder",
		sources: [
			{ url: "https://www.ehx.com/products/big-muff/", kind: ["info"] },
			{
				url: "https://www.pedalplayground.com/gear/ehx/big-muff.png",
				kind: ["image"],
			},
		],
	},
	{
		id: "electro-harmonix-small-stone",
		brand: "Electro-Harmonix",
		name: "Small Stone",
		widthCm: 7.4,
		heightCm: 11.5,
		category: "pedal",
		effectTypes: ["phaser"],
		imageSource: "mock",
		source: "placeholder",
	},
];

const RUNTIME: RuntimePedalLike[] = [
	{
		...LEGACY[0],
		notes: "Classic four-transistor fuzz.",
		jacks: [
			{ kind: "in", edge: "right", stereo: false },
			{ kind: "out", edge: "left", stereo: false },
		],
		power: { voltage: 9, acDc: "DC", currentMa: 5 },
	},
	LEGACY[1],
];

describe("promoteLegacy", () => {
	it("copies existing facts deterministically", () => {
		const input = {
			brand: "Electro-Harmonix",
			ids: ["electro-harmonix-big-muff"],
			batch: "ehx-1",
			runtime: RUNTIME,
			legacy: LEGACY,
			provenance: { kind: "legacy" as const },
		};
		const first = promoteLegacy(input);
		const second = promoteLegacy(input);
		expect(first).toEqual(second);
		expect(first.records).toHaveLength(1);

		const record = first.records[0];
		expect(record.id).toBe("electro-harmonix-big-muff");
		expect(record.name).toBe("Big Muff");
		expect(record.widthCm).toBe(9.5);
		expect(record.heightCm).toBe(12.1);
		expect(record.effectTypes).toEqual(["fuzz"]);
		expect(record.notes).toBe("Classic four-transistor fuzz.");
		expect(record.jacks).toEqual([
			{ kind: "in", edge: "right", stereo: false },
			{ kind: "out", edge: "left", stereo: false },
		]);
		expect(record.power).toEqual({
			voltage: 9,
			acDc: "DC",
			currentMa: 5,
		});
		expect(record.imageProvenance).toMatchObject({
			kind: "legacy",
			status: "pending-replacement",
		});
		expect(record.extra).toEqual({
			promotedFrom: "legacy",
			promotedBatch: "ehx-1",
		});
	});

	it("never emits an asset slot or a planner URL", () => {
		const { records } = promoteLegacy({
			brand: "Electro-Harmonix",
			ids: ["electro-harmonix-big-muff"],
			batch: "ehx-1",
			runtime: RUNTIME,
			legacy: LEGACY,
			provenance: { kind: "legacy" },
		});
		const record = records[0] as Record<string, unknown>;
		expect(record.image).toBeUndefined();
		expect(record.imageSource).toBeUndefined();
		expect(record.source).toBeUndefined();
		expect(JSON.stringify(record)).not.toContain("pedalplayground");
		expect(record.sources).toEqual([
			{ url: "https://www.ehx.com/products/big-muff/", kind: ["info"] },
		]);
	});

	it("supports an official re-source provenance", () => {
		const { records } = promoteLegacy({
			brand: "Electro-Harmonix",
			ids: ["electro-harmonix-small-stone"],
			batch: "ehx-1",
			runtime: RUNTIME,
			legacy: LEGACY,
			provenance: {
				kind: "official",
				sourceUrls: {
					"electro-harmonix-small-stone":
						"https://www.ehx.com/products/small-stone/",
				},
			},
		});
		expect(records[0].imageProvenance).toMatchObject({
			kind: "official",
			sourceUrl: "https://www.ehx.com/products/small-stone/",
			status: "chosen",
		});
	});

	it("rejects a planner/unsafe official source URL", () => {
		expect(() =>
			promoteLegacy({
				brand: "Electro-Harmonix",
				ids: ["electro-harmonix-small-stone"],
				batch: "ehx-1",
				runtime: RUNTIME,
				legacy: LEGACY,
				provenance: {
					kind: "official",
					sourceUrls: {
						"electro-harmonix-small-stone":
							"https://www.pedalplayground.com/gear/ehx.png",
					},
				},
			}),
		).toThrow(/planner/i);
	});

	it("requires an official URL for every id", () => {
		expect(() =>
			promoteLegacy({
				brand: "Electro-Harmonix",
				ids: ["electro-harmonix-big-muff", "electro-harmonix-small-stone"],
				batch: "ehx-1",
				runtime: RUNTIME,
				legacy: LEGACY,
				provenance: {
					kind: "official",
					sourceUrls: {
						"electro-harmonix-big-muff": "https://www.ehx.com/big-muff/",
					},
				},
			}),
		).toThrow(/needs an official source URL/);
	});

	it("fails on unknown ids without writing a partial batch", () => {
		expect(() =>
			promoteLegacy({
				brand: "Electro-Harmonix",
				ids: ["electro-harmonix-big-muff", "missing"],
				batch: "ehx-1",
				runtime: RUNTIME,
				legacy: LEGACY,
				provenance: { kind: "legacy" },
			}),
		).toThrow(/unknown id/);
	});

	it("fails on a brand mismatch", () => {
		expect(() =>
			promoteLegacy({
				brand: "MXR",
				ids: ["electro-harmonix-big-muff"],
				batch: "mxr-1",
				runtime: RUNTIME,
				legacy: LEGACY,
				provenance: { kind: "legacy" },
			}),
		).toThrow(/belongs to/);
	});

	it("refuses ids already present in a raw batch", () => {
		expect(() =>
			promoteLegacy({
				brand: "Electro-Harmonix",
				ids: ["electro-harmonix-big-muff"],
				batch: "ehx-1",
				runtime: RUNTIME,
				legacy: LEGACY,
				provenance: { kind: "legacy" },
				existingRawIds: ["electro-harmonix-big-muff"],
			}),
		).toThrow(/already exists in a raw batch/);
	});

	it("refuses an already-verified public asset", () => {
		const verified: RuntimePedalLike[] = [
			{ ...LEGACY[0], source: "public-asset" },
		];
		expect(() =>
			promoteLegacy({
				brand: "Electro-Harmonix",
				ids: ["electro-harmonix-big-muff"],
				batch: "ehx-1",
				runtime: verified,
				legacy: [],
				provenance: { kind: "legacy" },
			}),
		).toThrow(/verified public asset/);
	});

	it("deduplicates ids with a warning", () => {
		const result = promoteLegacy({
			brand: "Electro-Harmonix",
			ids: ["electro-harmonix-big-muff", "electro-harmonix-big-muff"],
			batch: "ehx-1",
			runtime: RUNTIME,
			legacy: LEGACY,
			provenance: { kind: "legacy" },
		});
		expect(result.records).toHaveLength(1);
		expect(result.warnings[0]).toMatch(/duplicate id/);
	});
});

describe("filterSources", () => {
	it("keeps info sources, drops planner/image-only sources, dedupes", () => {
		expect(
			filterSources([
				{ url: "https://example.com/a", kind: ["info", "image"] },
				{ url: "https://example.com/a", kind: ["info"] },
				{ url: "https://example.com/b", kind: ["image"] },
				{
					url: "https://www.pedalplayground.com/x",
					kind: ["info", "image"],
				},
			]),
		).toEqual([{ url: "https://example.com/a", kind: ["info"] }]);
	});
});
