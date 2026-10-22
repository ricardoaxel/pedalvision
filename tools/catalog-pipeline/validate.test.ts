import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { validateCatalog } from "./validate.ts";

const dirs: string[] = [];

async function catalogDir(
	pedals: unknown[],
	boards: unknown[] = [],
): Promise<string> {
	const dir = await mkdtemp(join(tmpdir(), "pedalvision-validate-"));
	dirs.push(dir);
	await writeFile(join(dir, "pedals.json"), JSON.stringify(pedals));
	await writeFile(join(dir, "boards.json"), JSON.stringify(boards));
	return dir;
}

function pedal(id = "acme-big-fuzz", overrides: Record<string, unknown> = {}) {
	return {
		id,
		brand: "Acme",
		name: "Big Fuzz",
		widthCm: 6,
		heightCm: 10,
		image: `${id}.png`,
		imageSource: "mock",
		effectTypes: ["fuzz"],
		category: "pedal",
		source: "placeholder",
		...overrides,
	};
}

function board(id = "acme-terra-24", overrides: Record<string, unknown> = {}) {
	return {
		id,
		brand: "Acme",
		name: "Terra 24",
		widthCm: 60,
		heightCm: 30,
		image: `${id}.png`,
		imageSource: "mock",
		source: "placeholder",
		...overrides,
	};
}

afterEach(async () => {
	await Promise.all(
		dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
	);
});

describe("catalog validation", () => {
	it("accepts a valid catalog", async () => {
		const dir = await catalogDir([pedal()], [board()]);
		const result = await validateCatalog({
			catalogDir: dir,
			assetsDir: dir,
			checkAssets: false,
			checkCaps: false,
		});
		expect(result.issues).toEqual([]);
	});

	it("rejects a duplicate id", async () => {
		const dir = await catalogDir([pedal(), pedal("acme-big-fuzz")]);
		const result = await validateCatalog({
			catalogDir: dir,
			assetsDir: dir,
			checkAssets: false,
			checkCaps: false,
		});
		expect(
			result.issues.some((issue) => /duplicate id/.test(issue.message)),
		).toBe(true);
	});

	it("rejects a missing mandatory field", async () => {
		const { effectTypes: _effectTypes, ...missing } = pedal();
		const dir = await catalogDir([missing]);
		const result = await validateCatalog({
			catalogDir: dir,
			assetsDir: dir,
			checkAssets: false,
			checkCaps: false,
		});
		expect(
			result.issues.some((issue) => /invalid pedal/.test(issue.message)),
		).toBe(true);
	});

	it("rejects a dangling variant and a variant cycle", async () => {
		const dangling = await catalogDir([
			pedal("acme-a", { variantOf: "missing" }),
		]);
		const danglingResult = await validateCatalog({
			catalogDir: dangling,
			assetsDir: dangling,
			checkAssets: false,
			checkCaps: false,
		});
		expect(
			danglingResult.issues.some((issue) =>
				/missing variantOf/.test(issue.message),
			),
		).toBe(true);

		const cycle = await catalogDir([
			pedal("acme-a", { variantOf: "acme-b" }),
			pedal("acme-b", { variantOf: "acme-a" }),
		]);
		const cycleResult = await validateCatalog({
			catalogDir: cycle,
			assetsDir: cycle,
			checkAssets: false,
			checkCaps: false,
		});
		expect(
			cycleResult.issues.some((issue) => /cycle/.test(issue.message)),
		).toBe(true);
	});

	it("rejects an implausible board footprint", async () => {
		const dir = await catalogDir([], [board("acme-tiny", { widthCm: 5 })]);
		const result = await validateCatalog({
			catalogDir: dir,
			assetsDir: dir,
			checkAssets: false,
			checkCaps: false,
		});
		expect(
			result.issues.some((issue) => /outside 10–250 cm/.test(issue.message)),
		).toBe(true);
	});
});
