import { describe, expect, it } from "vitest";
import { CatalogPedalSchema } from "../../src/catalog/schema.ts";
import { renditionPixels } from "./image.ts";
import { generateSeed, labelFor, renderSeedImages } from "./seed.ts";

const PNG_SIGNATURE = Buffer.from([
	0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

describe("generateSeed", () => {
	it("is deterministic (two runs → identical JSON)", () => {
		expect(JSON.stringify(generateSeed())).toBe(JSON.stringify(generateSeed()));
	});

	it("produces schema-valid items with synthetic provenance", () => {
		const seed = generateSeed();
		expect(seed.pedals.length).toBeGreaterThanOrEqual(50);
		expect(seed.boards).toHaveLength(10);
		for (const pedal of seed.pedals) {
			expect(CatalogPedalSchema.safeParse(pedal).success).toBe(true);
			expect(pedal.source).toBe("synthetic");
		}
		expect(seed.pedals.some((p) => p.category === "supply")).toBe(true);
	});
});

describe("renderSeedImages", () => {
	it("is deterministic (two runs → identical PNG bytes) and all are valid PNGs", async () => {
		const first = await renderSeedImages(generateSeed(), "assets");
		const second = await renderSeedImages(generateSeed(), "assets");

		expect(first).toHaveLength(second.length);
		expect(first.length).toBeGreaterThan(100);

		first.forEach((image, index) => {
			expect(image.path).toBe(second[index].path);
			expect(image.buffer.subarray(0, 8)).toEqual(PNG_SIGNATURE);
			expect(image.buffer.equals(second[index].buffer)).toBe(true);
		});
	}, 60_000);
});

describe("renditionPixels", () => {
	it("scales the long edge to the rendition size", () => {
		expect(renditionPixels(6, 12, 800)).toEqual({ width: 400, height: 800 });
		expect(renditionPixels(60, 30, 350)).toEqual({ width: 350, height: 175 });
		expect(renditionPixels(1, 2, 350)).toEqual({ width: 175, height: 350 });
	});
});

describe("labelFor", () => {
	it("returns a short uppercase code", () => {
		expect(labelFor("Wooly Fuzz (Black)")).toBe("WOOLYFUZ");
		expect(labelFor("Terra 24")).toBe("TERRA24");
	});
});
