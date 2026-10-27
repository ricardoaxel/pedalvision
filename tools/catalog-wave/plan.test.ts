import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { statePath } from "../catalog-runner/paths.ts";
import type { BatchState } from "../catalog-runner/state.ts";
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

	it("refuses a fresh start over existing state instead of recreating it", async () => {
		const dir = await tempDir();
		await writeBatchState(dir, "acme/test-1", { status: "stopped" });
		const batches: ResolvedBatch[] = [
			{ ...batch({ worktree: dir }), prompt: "x" },
		];
		const check = await validatePlan(batches, dir, { branch });
		expect(check.ok).toBe(false);
		expect(check.errors.join("\n")).toMatch(
			/already exists \(stopped\); use --resume or a new batch id/,
		);
	});

	it("validates an explicit resume without requiring a fresh state", async () => {
		const dir = await tempDir();
		await writeBatchState(dir, "acme/test-1", { status: "stopped" });
		const batches: ResolvedBatch[] = [
			{ ...batch({ worktree: dir }), prompt: "x" },
		];
		expect(await validatePlan(batches, dir, { branch, resume: true })).toEqual({
			ok: true,
			errors: [],
		});
	});

	it("resumes existing state and starts missing/completed batches but refuses live ones", async () => {
		const dir = await tempDir();
		const batches: ResolvedBatch[] = [
			{ ...batch({ worktree: dir }), prompt: "x" },
		];
		// Hybrid resume: a batch with no state is started, not rejected.
		expect(await validatePlan(batches, dir, { branch, resume: true })).toEqual({
			ok: true,
			errors: [],
		});

		await writeBatchState(dir, "acme/test-1", { status: "complete" });
		expect(await validatePlan(batches, dir, { branch, resume: true })).toEqual({
			ok: true,
			errors: [],
		});

		await writeBatchState(dir, "acme/test-1", {
			status: "stopped",
			pid: 4242,
		});
		const supervised = await validatePlan(batches, dir, {
			branch,
			resume: true,
			alive: (pid) => pid === 4242,
		});
		expect(supervised.errors.join("\n")).toMatch(/still supervised/);

		await writeBatchState(dir, "acme/test-1", {
			status: "stopped",
			supervisorPid: 4242,
		});
		const finalizing = await validatePlan(batches, dir, {
			branch,
			resume: true,
			alive: (pid) => pid === 4242,
		});
		expect(finalizing.errors.join("\n")).toMatch(/still finalizing/);
	});
});

function batchState(
	batchId: string,
	overrides: Partial<BatchState> = {},
): BatchState {
	const now = new Date().toISOString();
	return {
		version: 1,
		batchId,
		kind: "pedals",
		brand: "Acme",
		worktree: "/tmp",
		status: "running",
		total: 3,
		done: 1,
		imagesAccepted: 0,
		imagesRejected: 0,
		tokens: 0,
		startedAt: now,
		updatedAt: now,
		heartbeatAt: now,
		blockers: [],
		...overrides,
	};
}

async function writeBatchState(
	root: string,
	batchId: string,
	overrides: Partial<BatchState> = {},
): Promise<void> {
	const path = statePath(root, batchId);
	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, JSON.stringify(batchState(batchId, overrides)));
}
