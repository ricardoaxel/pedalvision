import { readFileSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CatalogPedalSchema } from "../../src/catalog/schema.ts";
import { renditionPixels } from "./image.ts";
import { generateSeed, labelFor, renderSeedImages, writeSeed } from "./seed.ts";

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
	// artifacts are not regenerated, tests must fail. Every JSON byte and every
	// one of the committed PNGs is compared against a fresh generation.
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

	it("every procedural PNG matches the committed file byte-for-byte", async () => {
		const seed = generateSeed();
		const images = await renderSeedImages(seed, "assets");
		expect(images).toHaveLength((seed.pedals.length + seed.boards.length) * 2);

		for (const image of images) {
			const committedPath = image.path.replace(
				/^assets[\\/]/,
				"public/pedal-assets/",
			);
			expect(
				image.buffer.equals(readFileSync(new URL(committedPath, repoRoot))),
				committedPath,
			).toBe(true);
		}
	}, 60_000);
});

describe("writeSeed", () => {
	it("writes the seed JSON and PNGs to disk", async () => {
		const dir = await mkdtemp(join(tmpdir(), "pedalvision-seed-"));
		try {
			const seed = generateSeed();
			const summary = await writeSeed(join(dir, "data"), join(dir, "assets"));

			expect(summary).toEqual({
				pedals: seed.pedals.length,
				boards: seed.boards.length,
				images: (seed.pedals.length + seed.boards.length) * 2,
			});

			const written = JSON.parse(
				await readFile(join(dir, "data", "pedals.json"), "utf8"),
			);
			expect(written).toEqual(seed.pedals);

			const png = await readFile(
				join(dir, "assets", "pedals", "800", seed.pedals[0].image),
			);
			expect(png.subarray(0, 8)).toEqual(PNG_SIGNATURE);
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
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
