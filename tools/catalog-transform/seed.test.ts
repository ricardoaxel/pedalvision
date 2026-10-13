import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CatalogPedalSchema } from "../../src/catalog/schema.ts";
import { renderPng, renditionPixels } from "./image.ts";
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

describe("committed seed freshness", () => {
	// Guard against drift: if image.ts/font.ts/seed.ts change but the committed
	// artifacts are not regenerated, tests must fail. The full JSON is compared
	// plus one pedal + one board rendition (bytes).
	const repoRoot = new URL("../../", import.meta.url);
	const committedPedals = readFileSync(
		new URL("src/catalog/data/pedals.json", repoRoot),
		"utf8",
	);
	const committedBoards = readFileSync(
		new URL("src/catalog/data/boards.json", repoRoot),
		"utf8",
	);

	it("JSON matches the committed files byte-for-byte", () => {
		const seed = generateSeed();
		expect(`${JSON.stringify(seed.pedals, null, 2)}\n`).toBe(committedPedals);
		expect(`${JSON.stringify(seed.boards, null, 2)}\n`).toBe(committedBoards);
	});

	it("procedural PNGs match the committed files byte-for-byte", async () => {
		const seed = generateSeed();
		const pedal = seed.pedals[0];
		const board = seed.boards[0];

		const pedalPng = await renderPng({
			id: pedal.id,
			label: labelFor(pedal.name),
			widthCm: pedal.widthCm,
			heightCm: pedal.heightCm,
			size: 800,
		});
		expect(
			pedalPng.equals(
				readFileSync(
					new URL(`public/pedal-assets/pedals/800/${pedal.image}`, repoRoot),
				),
			),
		).toBe(true);

		const boardPng = await renderPng({
			id: board.id,
			label: labelFor(board.name),
			widthCm: board.widthCm,
			heightCm: board.heightCm,
			size: 350,
		});
		expect(
			boardPng.equals(
				readFileSync(
					new URL(`public/pedal-assets/boards/350/${board.image}`, repoRoot),
				),
			),
		).toBe(true);
	});
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
