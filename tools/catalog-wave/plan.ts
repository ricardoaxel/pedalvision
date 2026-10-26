import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { z } from "zod";
import { isActive, tryReadState } from "../catalog-runner/state.ts";

/**
 * Wave plan (P5 parallel mechanism). A plan names 1–3 independent batches that
 * each run in their own worktree/branch/session. The wrapper starts at most 2
 * and only starts a third when the owner gate passes (`canStartNext`).
 *
 * Every batch prompt is supplied by the plan author (normally the coordinator);
 * the wrapper prepends the "already started" contract so the session does not
 * call `catalog:start` twice.
 */
export const WaveBatchSchema = z
	.object({
		batch: z.string().regex(/^[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9-]*$/),
		kind: z.enum(["pedals", "boards"]),
		brand: z.string().min(1),
		total: z.number().int().positive(),
		worktree: z.string().min(1),
		branch: z.string().min(1),
		/** Full session prompt. Exactly one of prompt / promptFile is required. */
		prompt: z.string().min(1).optional(),
		promptFile: z.string().min(1).optional(),
	})
	.refine((batch) => Boolean(batch.prompt) !== Boolean(batch.promptFile), {
		message: "exactly one of prompt or promptFile is required",
	});

export const WavePlanSchema = z
	.object({
		id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
		maxParallel: z.union([z.literal(2), z.literal(3)]).default(2),
		batches: z.array(WaveBatchSchema).min(1).max(3),
	})
	.superRefine((plan, ctx) => {
		const ids = new Set<string>();
		const branches = new Set<string>();
		for (const batch of plan.batches) {
			if (ids.has(batch.batch)) {
				ctx.addIssue({
					code: "custom",
					path: ["batches"],
					message: `duplicate batch "${batch.batch}"`,
				});
			}
			ids.add(batch.batch);
			if (branches.has(batch.branch)) {
				ctx.addIssue({
					code: "custom",
					path: ["batches"],
					message: `duplicate branch "${batch.branch}"`,
				});
			}
			branches.add(batch.branch);
		}
	});

export type WaveBatch = z.infer<typeof WaveBatchSchema>;
export type WavePlan = z.infer<typeof WavePlanSchema>;

export type ResolvedBatch = WaveBatch & { prompt: string };

export type PlanCheck = {
	ok: boolean;
	errors: string[];
};

export function waveDir(workRoot: string, id: string): string {
	return resolve(workRoot, "waves", id);
}

export function readWavePlan(planPath: string): {
	plan: WavePlan;
	batches: ResolvedBatch[];
	planPath: string;
} {
	const absolute = resolve(planPath);
	const raw = JSON.parse(readFileSync(absolute, "utf8")) as unknown;
	const plan = WavePlanSchema.parse(raw);
	const base = dirname(absolute);
	const batches = plan.batches.map((batch) => {
		const prompt = batch.promptFile
			? readFileSync(
					isAbsolute(batch.promptFile)
						? batch.promptFile
						: resolve(base, batch.promptFile),
					"utf8",
				)
			: (batch.prompt as string);
		return { ...batch, prompt };
	});
	return { plan, batches, planPath: absolute };
}

export async function validatePlan(
	batches: ResolvedBatch[],
	root: string,
	options: { branch?: (worktree: string) => string } = {},
): Promise<PlanCheck> {
	const errors: string[] = [];
	for (const batch of batches) {
		const worktree = resolve(batch.worktree);
		if (!existsSync(worktree)) {
			errors.push(`${batch.batch}: worktree does not exist (${worktree})`);
			continue;
		}
		let branch: string;
		try {
			branch = options.branch ? options.branch(worktree) : gitBranch(worktree);
		} catch {
			errors.push(`${batch.batch}: cannot read worktree branch`);
			continue;
		}
		if (branch !== batch.branch) {
			errors.push(
				`${batch.batch}: worktree is on "${branch}", expected "${batch.branch}"`,
			);
		}
		const state = await tryReadState(root, batch.batch);
		if (state && isActive(state)) {
			errors.push(`${batch.batch}: already ${state.status}`);
		}
	}
	return { ok: errors.length === 0, errors };
}

function gitBranch(worktree: string): string {
	return execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
		cwd: worktree,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "ignore"],
	}).trim();
}
