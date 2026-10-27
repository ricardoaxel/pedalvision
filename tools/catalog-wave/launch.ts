import { spawn } from "node:child_process";
import { closeSync, mkdirSync, openSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { resumeBatch, startBatch } from "../catalog-runner/runner.ts";
import type { WaveBatch } from "./plan.ts";

/**
 * Start or explicitly resume one batch (runner state) and launch its independent
 * `opencode run` session through the existing `catalog-runner supervise` wrapper,
 * so pause/stop and the SIGTERM/SIGKILL fallback stay in one tested place.
 */
export type LaunchBatchOptions = {
	root: string;
	waveId: string;
	batch: WaveBatch;
	prompt: string;
	logPath: string;
	/** Explicitly resume the batch's existing stopped/paused state. */
	resume?: boolean;
};

export async function launchBatch(options: LaunchBatchOptions): Promise<{
	pid: number;
	logPath: string;
}> {
	if (options.resume) {
		// Clears the stale `.stop`/`.pause` markers and keeps done/tokens; a fresh
		// `startBatch` would recreate the state and collide with the old session.
		await resumeBatch(options.root, options.batch.batch);
	} else {
		await startBatch({
			root: options.root,
			batchId: options.batch.batch,
			kind: options.batch.kind,
			brand: options.batch.brand,
			total: options.batch.total,
			worktree: options.batch.worktree,
		});
	}

	mkdirSync(dirname(options.logPath), { recursive: true });
	const logFd = openSync(options.logPath, "a");
	const contract = [
		`The coordinator already ${options.resume ? "resumed" : "started"} ${options.batch.batch} (total ${options.batch.total}).`,
		"Do NOT run catalog:start/resume again. Checkpoint INLINE after every item and finish with catalog:finish.",
		"",
		options.prompt,
	].join("\n");

	const child = spawn(
		process.execPath,
		[
			"--experimental-strip-types",
			resolve(options.root, "tools/catalog-runner/index.ts"),
			"supervise",
			"--batch",
			options.batch.batch,
			"--",
			"opencode",
			"run",
			"--auto",
			"--format",
			"json",
			"--dir",
			resolve(options.batch.worktree),
			"--title",
			`${options.waveId}:${options.batch.batch}`,
			contract,
		],
		{
			cwd: options.root,
			stdio: ["ignore", logFd, logFd],
			env: { ...process.env },
		},
	);
	closeSync(logFd);
	if (!child.pid) throw new Error(`${options.batch.batch}: failed to spawn`);
	return { pid: child.pid, logPath: options.logPath };
}

export function batchLogPath(waveDir: string, batchId: string): string {
	return join(waveDir, `${batchId.replace("/", "__")}.jsonl`);
}

/** Detached-child argv; the explicit 3-wide/resume flags must survive re-exec. */
export function detachArgs(
	self: string,
	planPath: string,
	allowThird: boolean,
	resume: boolean,
): string[] {
	return [
		"--experimental-strip-types",
		self,
		"run",
		"--plan",
		planPath,
		"--foreground",
		...(allowThird ? ["--allow-third"] : []),
		...(resume ? ["--resume"] : []),
	];
}
