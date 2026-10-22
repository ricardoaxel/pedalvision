import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildCatalog, checkDrift } from "./build.ts";

const dirs: string[] = [];

function legacyPedal() {
	return {
		id: "legacy-pedal",
		brand: "Legacy",
		name: "Pedal",
		widthCm: 6,
		heightCm: 10,
		image: "legacy-pedal.png",
		imageSource: "mock",
		effectTypes: ["boost"],
		category: "pedal",
		source: "placeholder",
	};
}

function rawPedal(id: string, brand = "Acme") {
	return {
		id,
		brand,
		name: `Model ${id}`,
		category: "pedal",
		effectTypes: ["fuzz"],
		widthCm: 6,
		heightCm: 10,
		sources: [{ url: "https://example.com/image", kind: ["info", "image"] }],
	};
}

async function writeJson(path: string, value: unknown): Promise<void> {
	await mkdir(join(path, ".."), { recursive: true });
	await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function makeRoot(): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), "pedalvision-build-"));
	dirs.push(root);
	await writeJson(join(root, "data/catalog/legacy/pedals.json"), [
		legacyPedal(),
	]);
	await writeJson(join(root, "data/catalog/legacy/boards.json"), []);
	return root;
}

async function writeAsset(root: string, id: string): Promise<void> {
	for (const size of ["800", "350"]) {
		await writeJson(
			join(root, "public/pedal-assets/pedals", size, `${id}.png`),
			null,
		);
	}
}

afterEach(async () => {
	await Promise.all(
		dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
	);
});

describe("catalog build", () => {
	it("projects raw batches over the frozen legacy baseline", async () => {
		const root = await makeRoot();
		await writeJson(
			join(root, "data/catalog/research/pedals/acme/batch-1.json"),
			[rawPedal("acme-alpha")],
		);
		await writeAsset(root, "acme-alpha");

		const result = await buildCatalog({ root });
		expect(result.pedals.map((pedal) => pedal.id)).toEqual([
			"legacy-pedal",
			"acme-alpha",
		]);
		expect(result.registry.pedals.acme?.batches[0]?.items).toBe(1);
		const runtime = JSON.parse(
			await readFile(join(root, "src/catalog/data/pedals.json"), "utf8"),
		);
		expect(runtime).toHaveLength(2);
	});

	it("is deterministic and the drift check is clean", async () => {
		const root = await makeRoot();
		await writeJson(
			join(root, "data/catalog/research/pedals/acme/batch-1.json"),
			[rawPedal("acme-alpha")],
		);
		await writeAsset(root, "acme-alpha");

		await buildCatalog({ root });
		const first = await readFile(join(root, "src/catalog/data/pedals.json"));
		await buildCatalog({ root });
		const second = await readFile(join(root, "src/catalog/data/pedals.json"));
		expect(first.equals(second)).toBe(true);

		const drift = await checkDrift({ root });
		expect(drift).toEqual({ ok: true, drift: [] });
	});

	it("detects stale generated files", async () => {
		const root = await makeRoot();
		await writeJson(
			join(root, "data/catalog/research/pedals/acme/batch-1.json"),
			[rawPedal("acme-alpha")],
		);
		await writeAsset(root, "acme-alpha");
		await buildCatalog({ root });
		const runtimePath = join(root, "src/catalog/data/pedals.json");
		const runtime = JSON.parse(
			await readFile(runtimePath, "utf8"),
		) as unknown[];
		await writeFile(runtimePath, JSON.stringify(runtime.slice(0, 1)));
		const drift = await checkDrift({ root });
		expect(drift.ok).toBe(false);
		expect(drift.drift.join(" ")).toMatch(/stale|missing|unexpected/);
	});

	it("rejects duplicate ids across two batches", async () => {
		const root = await makeRoot();
		for (const batch of ["batch-1", "batch-2"]) {
			await writeJson(
				join(root, `data/catalog/research/pedals/acme/${batch}.json`),
				[rawPedal("acme-alpha")],
			);
		}
		await writeAsset(root, "acme-alpha");
		await expect(buildCatalog({ root })).rejects.toThrow(
			/also provided by another batch/,
		);
	});

	it("rejects a missing static rendition", async () => {
		const root = await makeRoot();
		await writeJson(
			join(root, "data/catalog/research/pedals/acme/batch-1.json"),
			[rawPedal("acme-alpha")],
		);
		await expect(buildCatalog({ root })).rejects.toThrow(/missing pedals\/800/);
	});
});
