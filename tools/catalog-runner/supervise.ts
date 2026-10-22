import { spawn } from "node:child_process";
import { isBatchStop, isGlobalStop, requestBatchStop } from "./control.ts";
import { ensureControlDirs, workRoot } from "./paths.ts";
import {
	addBlocker,
	appendLog,
	isActive,
	readState,
	statusLine,
	writeState,
} from "./state.ts";

/**
 * Batch supervisor (P5-02): runs one agent command, writes its PID into state,
 * and enforces pause/stop/global STOP. Stop is graceful first (checkpoint +
 * SIGTERM) with a SIGKILL fallback so a stuck agent can never hold a slot.
 */

export type SuperviseOptions = {
	root: string;
	batchId: string;
	command: string;
	args: string[];
	pollMs?: number;
	statusEveryMs?: number;
};

function stopGraceMs(): number {
	return Number(process.env.CATALOG_STOP_GRACE_MS ?? 5_000);
}

function killGraceMs(): number {
	return Number(process.env.CATALOG_KILL_GRACE_MS ?? 5_000);
}

function alive(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

export async function supervise(options: SuperviseOptions): Promise<number> {
	await ensureControlDirs(options.root);
	const state = await readState(options.root, options.batchId);
	if (!isActive(state)) {
		throw new Error(`batch "${options.batchId}" is ${state.status}`);
	}

	const child = spawn(options.command, options.args, {
		cwd: state.worktree,
		stdio: "inherit",
		env: {
			...process.env,
			CATALOG_BATCH_ID: options.batchId,
			CATALOG_WORK_DIR: workRoot(options.root),
		},
	});
	state.pid = child.pid;
	state.updatedAt = new Date().toISOString();
	await writeState(options.root, state);

	const statusTimer = setInterval(
		() => {
			void (async () => {
				const current = await readState(options.root, options.batchId).catch(
					() => undefined,
				);
				if (current) {
					await appendLog(options.root, options.batchId, statusLine(current));
				}
			})();
		},
		options.statusEveryMs ?? 15 * 60_000,
	);

	let stopRequested = false;
	let stopRequestedAt = 0;
	let termSentAt = 0;
	let killed = false;
	const exit = new Promise<number>((resolve) => {
		child.on("error", (error) => {
			console.error(`supervisor: ${error.message}`);
			resolve(1);
		});
		child.on("exit", (code, signal) => {
			resolve(code ?? (signal ? 1 : 0));
		});
	});

	const poll = setInterval(() => {
		void (async () => {
			const globalStop = await isGlobalStop(options.root);
			const batchStop = await isBatchStop(options.root, options.batchId);
			if (!globalStop && !batchStop) return;
			const now = Date.now();
			if (!stopRequested) {
				stopRequested = true;
				stopRequestedAt = now;
				await requestBatchStop(
					options.root,
					options.batchId,
					"supervisor stop",
				);
				return;
			}
			if (!child.pid || !alive(child.pid) || killed) return;
			if (termSentAt === 0 && now - stopRequestedAt > stopGraceMs()) {
				termSentAt = now;
				try {
					process.kill(child.pid, "SIGTERM");
				} catch {
					// Already gone.
				}
				return;
			}
			if (termSentAt > 0 && now - termSentAt > killGraceMs()) {
				killed = true;
				try {
					process.kill(child.pid, "SIGKILL");
				} catch {
					// Already gone.
				}
			}
		})();
	}, options.pollMs ?? 100);

	const code = await exit;
	clearInterval(statusTimer);
	clearInterval(poll);

	const finalState = await readState(options.root, options.batchId);
	finalState.pid = undefined;
	if (isActive(finalState)) {
		const stopped =
			stopRequested ||
			finalState.stopRequested ||
			(await isGlobalStop(options.root)) ||
			(await isBatchStop(options.root, options.batchId));
		if (stopped) {
			finalState.status = "stopped";
			finalState.stopRequested = true;
		} else {
			finalState.status = "paused";
			addBlocker(finalState, "supervisor exited without finish");
		}
		finalState.endedAt = new Date().toISOString();
	}
	finalState.updatedAt = new Date().toISOString();
	finalState.heartbeatAt = finalState.updatedAt;
	await writeState(options.root, finalState);
	await appendLog(options.root, options.batchId, statusLine(finalState));
	return code;
}
