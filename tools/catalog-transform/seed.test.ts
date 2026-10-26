import { readdirSync, readFileSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { CatalogBoard, CatalogPedal } from "../../src/catalog/schema.ts";
import { renditionPixels } from "./image.ts";
import { labelFor, renderCatalogImages, writeSeedImages } from "./seed.ts";

const repoRoot = new URL("../../", import.meta.url);
const readJson = <T>(relative: string): T =>
	JSON.parse(readFileSync(new URL(relative, repoRoot), "utf8")) as T;

const committedPedals = readJson<CatalogPedal[]>(
	"src/catalog/data/pedals.json",
);
const committedBoards = readJson<CatalogBoard[]>(
	"src/catalog/data/boards.json",
);
// The frozen legacy baseline keeps its static PNGs even after a P5 batch
// replaces the same id with an AVIF; those files stay for rollback and for the
// pipeline dry-run, which validates the legacy baseline.
const legacyPedals = readJson<CatalogPedal[]>(
	"data/catalog/legacy/pedals.json",
);
const legacyBoards = readJson<CatalogBoard[]>(
	"data/catalog/legacy/boards.json",
);

// Only `mock` items are generator-drawn; `url` items render a remote brand
// image and have no committed PNG.
const mockPedals = committedPedals.filter((p) => p.imageSource === "mock");
const mockBoards = committedBoards.filter((b) => b.imageSource === "mock");
// `static` items are committed files too (kept, not generator-drawn).
const staticPedals = committedPedals.filter((p) => p.imageSource === "static");
const staticBoards = committedBoards.filter((b) => b.imageSource === "static");

// Synthetic mock fixtures (independent of the committed data, which may have no
// mock boards at all).
const mockPedal: CatalogPedal = {
	id: "test-pedal",
	brand: "Test",
	name: "Pedal",
	widthCm: 6,
	heightCm: 12,
	image: "test-pedal.png",
	imageSource: "mock",
	effectTypes: [],
	category: "pedal",
	source: "placeholder",
};
const mockBoard: CatalogBoard = {
	id: "test-board",
	brand: "Test",
	name: "Board",
	widthCm: 40,
	heightCm: 20,
	image: "test-board.png",
	imageSource: "mock",
	source: "placeholder",
};

const PNG_SIGNATURE = Buffer.from([
	0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

describe("committed mock images", () => {
	it("match a fresh generation byte-for-byte", async () => {
		const images = await renderCatalogImages(
			committedPedals,
			committedBoards,
			"assets",
		);
		expect(images).toHaveLength((mockPedals.length + mockBoards.length) * 2);
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

	it("are the only PNG files in the asset dirs (no stale PNGs; AVIF allowed)", () => {
		// AVIF hosted assets are committed by P5 batches and referenced by the
		// post-merge runtime, so they are intentionally outside this seed check.
		const expected = new Set<string>();
		for (const pedal of [...mockPedals, ...staticPedals]) {
			if (!pedal.image.endsWith(".png") || pedal.image.includes("/")) continue;
			for (const size of [800, 350])
				expected.add(`pedals/${size}/${pedal.image}`);
		}
		for (const board of [...mockBoards, ...staticBoards]) {
			if (!board.image.endsWith(".png") || board.image.includes("/")) continue;
			for (const size of [800, 350])
				expected.add(`boards/${size}/${board.image}`);
		}
		// A P5 batch may replace a legacy static PNG with an AVIF. The frozen
		// legacy PNG then stays on disk for rollback + the pipeline dry-run, so
		// count it as expected only when the committed item now points elsewhere.
		const committedPedalById = new Map(
			committedPedals.map((pedal) => [pedal.id, pedal]),
		);
		const committedBoardById = new Map(
			committedBoards.map((board) => [board.id, board]),
		);
		for (const pedal of legacyPedals) {
			if (!pedal.image.endsWith(".png") || pedal.image.includes("/")) continue;
			const current = committedPedalById.get(pedal.id);
			if (!current || current.image === pedal.image) continue;
			for (const size of [800, 350])
				expected.add(`pedals/${size}/${pedal.image}`);
		}
		for (const board of legacyBoards) {
			if (!board.image.endsWith(".png") || board.image.includes("/")) continue;
			const current = committedBoardById.get(board.id);
			if (!current || current.image === board.image) continue;
			for (const size of [800, 350])
				expected.add(`boards/${size}/${board.image}`);
		}

		const actual = new Set<string>();
		for (const dir of [
			"pedals/800",
			"pedals/350",
			"boards/800",
			"boards/350",
		]) {
			for (const entry of readdirSync(
				new URL(`public/pedal-assets/${dir}`, repoRoot),
			)) {
				if (entry.endsWith(".png")) actual.add(`${dir}/${entry}`);
			}
		}
		expect(actual).toEqual(expected);
	});
});

describe("renderCatalogImages", () => {
	it("is deterministic for the same input", async () => {
		const first = await renderCatalogImages([mockPedal], [mockBoard], "x");
		const second = await renderCatalogImages([mockPedal], [mockBoard], "x");

		expect(first.map((image) => image.path)).toEqual(
			second.map((image) => image.path),
		);
		first.forEach((image, index) => {
			expect(image.buffer.subarray(0, 8)).toEqual(PNG_SIGNATURE);
			expect(image.buffer.equals(second[index].buffer)).toBe(true);
		});
	});

	it("skips non-mock items (no PNG for a url image)", async () => {
		const remote = {
			...mockPedal,
			imageSource: "url" as const,
			image: "https://example.com/original.png",
		};
		const images = await renderCatalogImages([remote], [], "x");
		expect(images).toHaveLength(0);
	});
});

describe("writeSeedImages", () => {
	it("writes images from a catalog dir and prunes stale PNGs", async () => {
		const dir = await mkdtemp(join(tmpdir(), "pedalvision-seed-"));
		try {
			const dataDir = join(dir, "data");
			const assetsDir = join(dir, "assets");
			await mkdir(dataDir, { recursive: true });
			await writeFile(
				join(dataDir, "pedals.json"),
				JSON.stringify([mockPedal]),
			);
			await writeFile(
				join(dataDir, "boards.json"),
				JSON.stringify([mockBoard]),
			);
			await mkdir(join(assetsDir, "pedals", "800"), { recursive: true });
			await writeFile(join(assetsDir, "pedals", "800", "stale.png"), "x");

			const summary = await writeSeedImages(dataDir, assetsDir);
			expect(summary).toEqual({ pedals: 1, boards: 1, images: 4 });

			await expect(
				readFile(join(assetsDir, "pedals", "800", "stale.png")),
			).rejects.toThrow();
			const png = await readFile(
				join(assetsDir, "pedals", "800", mockPedal.image),
			);
			expect(png.subarray(0, 8)).toEqual(PNG_SIGNATURE);
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	}, 60_000);

	it("keeps committed static files (never pruned/overwritten)", async () => {
		const dir = await mkdtemp(join(tmpdir(), "pedalvision-seed-static-"));
		try {
			const dataDir = join(dir, "data");
			const assetsDir = join(dir, "assets");
			const staticImage = "custom-pedal.png";
			await mkdir(join(assetsDir, "pedals", "800"), { recursive: true });
			await writeFile(join(assetsDir, "pedals", "800", staticImage), "keep");
			await mkdir(dataDir, { recursive: true });
			await writeFile(
				join(dataDir, "pedals.json"),
				JSON.stringify([
					{ ...mockPedal, imageSource: "static", image: staticImage },
				]),
			);
			await writeFile(join(dataDir, "boards.json"), JSON.stringify([]));

			await writeSeedImages(dataDir, assetsDir);
			expect(
				await readFile(join(assetsDir, "pedals", "800", staticImage), "utf8"),
			).toBe("keep");
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it("prunes the stale mock PNG of an item that is now url", async () => {
		const dir = await mkdtemp(join(tmpdir(), "pedalvision-seed-staleurl-"));
		try {
			const dataDir = join(dir, "data");
			const assetsDir = join(dir, "assets");
			await mkdir(join(assetsDir, "pedals", "800"), { recursive: true });
			await writeFile(join(assetsDir, "pedals", "800", mockPedal.image), "old");
			await mkdir(dataDir, { recursive: true });
			await writeFile(
				join(dataDir, "pedals.json"),
				JSON.stringify([
					{
						...mockPedal,
						imageSource: "url",
						image: "https://cdn.example/x.jpg",
					},
				]),
			);
			await writeFile(join(dataDir, "boards.json"), JSON.stringify([]));

			const summary = await writeSeedImages(dataDir, assetsDir);
			expect(summary.images).toBe(0);
			await expect(
				readFile(join(assetsDir, "pedals", "800", mockPedal.image)),
			).rejects.toThrow();
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it("rejects a mock/static filename collision before writing", async () => {
		const dir = await mkdtemp(join(tmpdir(), "pedalvision-seed-collide-"));
		try {
			const dataDir = join(dir, "data");
			const assetsDir = join(dir, "assets");
			await mkdir(join(assetsDir, "pedals", "800"), { recursive: true });
			await writeFile(
				join(assetsDir, "pedals", "800", mockPedal.image),
				"static-keep",
			);
			await mkdir(dataDir, { recursive: true });
			const staticPedal: CatalogPedal = {
				...mockPedal,
				id: "test-static",
				imageSource: "static",
			};
			await writeFile(
				join(dataDir, "pedals.json"),
				JSON.stringify([mockPedal, staticPedal]),
			);
			await writeFile(join(dataDir, "boards.json"), JSON.stringify([]));

			await expect(writeSeedImages(dataDir, assetsDir)).rejects.toThrow(
				/static image/,
			);
			// The committed static file was not overwritten.
			expect(
				await readFile(
					join(assetsDir, "pedals", "800", mockPedal.image),
					"utf8",
				),
			).toBe("static-keep");
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it("rejects an invalid catalog file before writing", async () => {
		const dir = await mkdtemp(join(tmpdir(), "pedalvision-seed-bad-"));
		try {
			const dataDir = join(dir, "data");
			await mkdir(dataDir, { recursive: true });
			await writeFile(
				join(dataDir, "pedals.json"),
				JSON.stringify([{ id: "x" }]),
			);
			await writeFile(join(dataDir, "boards.json"), JSON.stringify([]));
			await expect(
				writeSeedImages(dataDir, join(dir, "assets")),
			).rejects.toThrow(/pedals\.json/);
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
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
		expect(labelFor("Tremolo (Black)")).toBe("TREMOLO");
		expect(labelFor("Terra 24")).toBe("TERRA24");
		expect(labelFor("(Blue)")).toBe("PEDAL");
	});
});
