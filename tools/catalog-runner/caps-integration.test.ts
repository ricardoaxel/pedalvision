import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startBatch } from "./runner.ts";

let root: string;

async function fill(kind: "pedals" | "boards", count: number): Promise<void> {
	for (const size of ["800", "350"]) {
		const dir = join(root, "assets", kind, size);
		await mkdir(dir, { recursive: true });
		for (let index = 0; index < count; index++) {
			await writeFile(join(dir, `item-${index}.png`), "");
		}
	}
}

beforeAll(async () => {
	root = await mkdtemp(join(tmpdir(), "pedalvision-caps-"));
	await fill("pedals", 2000);
	await fill("boards", 150);
}, 60_000);

afterAll(async () => {
	await rm(root, { recursive: true, force: true });
});

describe("runner cap enforcement", () => {
	it("refuses a pedal batch at the 2,000 hosted-pedal cap", async () => {
		await expect(
			startBatch({
				root,
				batchId: "acme/pedals-1",
				kind: "pedals",
				brand: "Acme",
				total: 1,
				worktree: root,
				assetsDir: join(root, "assets"),
			}),
		).rejects.toThrow(/pedal items cap/);
	});

	it("refuses a board batch at the 150-board cap", async () => {
		await expect(
			startBatch({
				root,
				batchId: "acme/boards-1",
				kind: "boards",
				brand: "Acme",
				total: 1,
				worktree: root,
				assetsDir: join(root, "assets"),
			}),
		).rejects.toThrow(/board items cap/);
	});

	it("does not count boards toward the pedal cap", async () => {
		const counts = await import("../catalog-pipeline/caps.ts").then((module) =>
			module.scanAssetCounts(join(root, "assets")),
		);
		expect(counts.pedals.items).toBe(2000);
		expect(counts.boards.items).toBe(150);
	});
});
