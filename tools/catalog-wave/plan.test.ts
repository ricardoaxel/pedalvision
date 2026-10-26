import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	type ResolvedBatch,
	readWavePlan,
	validatePlan,
	WavePlanSchema,
} from "./plan.ts";

const tempDirs: string[] = [];

async function tempDir(): Promise<string> {
	const dir = await mkdtemp(join(tmpdir(), "catalog-wave-plan-"));
	tempDirs.push(dir);
	return dir;
}

afterEach(async () => {
	await Promise.all(
		tempDirs.splice(0).map((dir) => rm(dir, { recursive: true })),
	);
});

const branch = () => "p5-test";

function batch(overrides: Record<string, unknown> = {}) {
	return {
		batch: "acme/test-1",
		kind: "pedals" as const,
		brand: "Acme",
		total: 3,
		worktree: "/tmp",
		branch: "p5-test",
		prompt: "do it",
		...overrides,
	};
}

describe("wave plan schema", () => {
	it("accepts 1–3 unique batches with exactly one prompt source", () => {
		const plan = WavePlanSchema.parse({
			id: "wave-1",
			maxParallel: 3,
			batches: [batch(), batch({ batch: "acme/test-2", branch: "p5-test-2" })],
		});
		expect(plan.maxParallel).toBe(3);
	});

	it("rejects >3, duplicate ids/branches and both prompt fields", () => {
		expect(() =>
			WavePlanSchema.parse({
				id: "wave-1",
				batches: [
					batch(),
					batch({ batch: "b/2", branch: "b2" }),
					batch({ batch: "b/3", branch: "b3" }),
					batch({ batch: "b/4", branch: "b4" }),
				],
			}),
		).toThrow();
		expect(() =>
			WavePlanSchema.parse({
				id: "wave-1",
				batches: [batch(), batch({ branch: "other" })],
			}),
		).toThrow(/duplicate batch/);
		expect(() =>
			WavePlanSchema.parse({
				id: "wave-1",
				batches: [batch({ promptFile: "p.md" })],
			}),
		).toThrow(/exactly one/);
	});
});

describe("readWavePlan", () => {
	it("resolves promptFile relative to the plan", async () => {
		const dir = await tempDir();
		await writeFile(join(dir, "prompt.md"), "from file");
		const planPath = join(dir, "wave.json");
		await writeFile(
			planPath,
			JSON.stringify({
				id: "wave-1",
				batches: [
					batch({ worktree: dir, prompt: undefined, promptFile: "prompt.md" }),
				],
			}),
		);
		const resolved = readWavePlan(planPath);
		expect(resolved.batches[0]?.prompt).toBe("from file");
	});
});

describe("validatePlan", () => {
	it("reports missing worktrees and branch mismatches", async () => {
		const dir = await tempDir();
		const batches: ResolvedBatch[] = [
			{ ...batch({ worktree: dir }), prompt: "x" },
			{
				...batch({ batch: "acme/test-2", branch: "p5-other", worktree: dir }),
				prompt: "x",
			},
			{
				...batch({
					batch: "acme/test-3",
					branch: "p5-test-3",
					worktree: "/nope",
				}),
				prompt: "x",
			},
		];
		const check = await validatePlan(batches, dir, { branch });
		expect(check.ok).toBe(false);
		expect(check.errors.join("\n")).toMatch(/does not exist/);
		expect(check.errors.join("\n")).toMatch(/expected "p5-other"/);
	});
});
