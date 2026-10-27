import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { existingRawIds } from "./raw.ts";

const dirs: string[] = [];

afterEach(async () => {
	await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true })));
});

async function fixture(): Promise<{ root: string; batch: string }> {
	const root = await mkdtemp(join(tmpdir(), "promote-raw-"));
	dirs.push(root);
	const batch = join(root, "data/catalog/research/pedals/acme/acme-1.json");
	await mkdir(join(root, "data/catalog/research/pedals/acme"), {
		recursive: true,
	});
	await writeFile(
		batch,
		JSON.stringify([
			{
				id: "acme-alpha",
				brand: "Acme",
				name: "Alpha",
				category: "pedal",
				widthCm: 7,
				heightCm: 12,
				effectTypes: [],
			},
		]),
	);
	return { root, batch };
}

describe("existingRawIds", () => {
	it("collects ids from raw batches", async () => {
		const { root } = await fixture();
		expect(await existingRawIds(root)).toEqual(["acme-alpha"]);
	});

	it("skips the batch being rewritten", async () => {
		const { root, batch } = await fixture();
		expect(await existingRawIds(root, batch)).toEqual([]);
	});

	it("throws on a schema-invalid raw batch instead of skipping ids", async () => {
		const { root } = await fixture();
		await writeFile(
			join(root, "data/catalog/research/pedals/acme/bad.json"),
			JSON.stringify([{ id: "bad" }]),
		);
		await expect(existingRawIds(root)).rejects.toThrow(/invalid raw batch/);
	});

	it("returns [] when there is no research directory", async () => {
		const root = await mkdtemp(join(tmpdir(), "promote-raw-empty-"));
		dirs.push(root);
		expect(await existingRawIds(root)).toEqual([]);
	});
});
