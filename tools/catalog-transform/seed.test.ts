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
		expect(images).toHaveLength(
			(committedPedals.length + committedBoards.length) * 2,
		);
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

	it("are the only files in the asset dirs (no stale PNGs)", () => {
		const expected = new Set<string>();
		for (const pedal of committedPedals) {
			for (const size of [800, 350])
				expected.add(`pedals/${size}/${pedal.image}`);
		}
		for (const board of committedBoards) {
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
		const pedals = [committedPedals[0]];
		const boards = [committedBoards[0]];
		const first = await renderCatalogImages(pedals, boards, "x");
		const second = await renderCatalogImages(pedals, boards, "x");

		expect(first.map((image) => image.path)).toEqual(
			second.map((image) => image.path),
		);
		first.forEach((image, index) => {
			expect(image.buffer.subarray(0, 8)).toEqual(PNG_SIGNATURE);
			expect(image.buffer.equals(second[index].buffer)).toBe(true);
		});
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
				JSON.stringify([committedPedals[0]]),
			);
			await writeFile(
				join(dataDir, "boards.json"),
				JSON.stringify([committedBoards[0]]),
			);
			await mkdir(join(assetsDir, "pedals", "800"), { recursive: true });
			await writeFile(join(assetsDir, "pedals", "800", "stale.png"), "x");

			const summary = await writeSeedImages(dataDir, assetsDir);
			expect(summary).toEqual({ pedals: 1, boards: 1, images: 4 });

			await expect(
				readFile(join(assetsDir, "pedals", "800", "stale.png")),
			).rejects.toThrow();
			const png = await readFile(
				join(assetsDir, "pedals", "800", committedPedals[0].image),
			);
			expect(png.subarray(0, 8)).toEqual(PNG_SIGNATURE);
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	}, 60_000);

	it("refuses to render when any item is not mock (protects cleared assets)", async () => {
		const dir = await mkdtemp(join(tmpdir(), "pedalvision-seed-nonmock-"));
		try {
			const dataDir = join(dir, "data");
			await mkdir(dataDir, { recursive: true });
			await writeFile(
				join(dataDir, "pedals.json"),
				JSON.stringify([{ ...committedPedals[0], imageSource: "static" }]),
			);
			await writeFile(join(dataDir, "boards.json"), JSON.stringify([]));
			await expect(
				writeSeedImages(dataDir, join(dir, "assets")),
			).rejects.toThrow(/mock/);
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
