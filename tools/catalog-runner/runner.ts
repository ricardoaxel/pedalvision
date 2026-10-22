import { access, mkdir, rm, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { canStartBatch, capIssues } from "../catalog-pipeline/caps.ts";
import {
	clearBatchPause,
	clearBatchStop,
	clearGlobalStop,
	isBatchPause,
	isBatchStop,
	isGlobalStop,
	requestBatchPause,
	requestBatchStop,
	requestGlobalStop,
} from "./control.ts";
import { remainingPlanned, runnerAssetCounts, withPlanned } from "./counts.ts";
import { controlDir, ensureControlDirs } from "./paths.ts";
import {
	addBlocker,
	appendCheckpoint,
	appendLog,
	type BatchState,
	batchLimitMs,
	createState,
	isActive,
	itemLimitMs,
	listStates,
	readState,
	statusLine,
	tryReadState,
	writeState,
} from "./state.ts";

/** Runner orchestration (P5-02). Filesystem state, no database, no daemon. */

export type StartOptions = {
	root: string;
	batchId: string;
	kind: "pedals" | "boards";
	brand: string;
	total: number;
	worktree: string;
	assetsDir?: string;
	now?: Date;
};

export type CheckpointOptions = {
	root: string;
	batchId: string;
	itemId: string;
	done?: number;
	imagesAccepted?: number;
	imagesRejected?: number;
	tokens?: number;
	now?: Date;
};

export type RunnerResult = {
	state: BatchState;
	exitCode: number;
};

async function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withStartLock<T>(
	root: string,
	fn: () => Promise<T>,
): Promise<T> {
	const lock = join(controlDir(root), "start.lock");
	let locked = false;
	for (let attempt = 0; attempt < 80; attempt++) {
		try {
			await mkdir(lock);
			locked = true;
			break;
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
			try {
				const info = await stat(lock);
				if (Date.now() - info.mtimeMs > 60_000) {
					await rm(lock, { recursive: true, force: true });
					continue;
				}
			} catch {
				// Lock disappeared between mkdir and stat.
			}
			await sleep(25);
		}
	}
	if (!locked) throw new Error("catalog start lock is busy; retry");
	try {
		return await fn();
	} finally {
		await rm(lock, { recursive: true, force: true });
	}
}

async function assertWorktree(path: string): Promise<void> {
	try {
		await access(path);
	} catch {
		throw new Error(`worktree does not exist: ${path}`);
	}
}

export async function startBatch(options: StartOptions): Promise<BatchState> {
	if (!/^[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9-]*$/.test(options.batchId)) {
		throw new Error(
			`batch id must be "<brand-slug>/<batch-slug>" (got "${options.batchId}")`,
		);
	}
	await ensureControlDirs(options.root);
	if (await isGlobalStop(options.root)) {
		throw new Error(
			"global STOP is active; clear it with `catalog:resume --all`",
		);
	}
	const worktree = resolve(options.worktree);
	await assertWorktree(worktree);
	return withStartLock(options.root, async () => {
		const existing = await tryReadState(options.root, options.batchId);
		if (existing && isActive(existing)) {
			throw new Error(
				`batch "${options.batchId}" is already ${existing.status}`,
			);
		}
		const states = await listStates(options.root);
		const active = states.filter(isActive);
		if (active.length >= 3) {
			throw new Error(
				`max 3 batches in flight (active: ${active.map((state) => state.batchId).join(", ")})`,
			);
		}

		const counts = await runnerAssetCounts(
			options.root,
			options.assetsDir ? [options.assetsDir] : [],
			[worktree],
		);
		const projected = withPlanned(
			counts,
			remainingPlanned(states, options.kind),
			options.kind,
		);
		const check = canStartBatch(options.kind, options.total, projected);
		if (!check.ok) {
			throw new Error(`refused "${options.batchId}": ${check.reason}`);
		}

		const state = createState({
			batchId: options.batchId,
			kind: options.kind,
			brand: options.brand,
			total: options.total,
			worktree,
			now: options.now,
		});
		state.lastItemStartedAt = state.startedAt;
		await writeState(options.root, state);
		await appendLog(options.root, state.batchId, statusLine(state));
		return state;
	});
}

export async function checkpoint(
	options: CheckpointOptions,
): Promise<RunnerResult> {
	const state = await readState(options.root, options.batchId);
	if (!isActive(state)) {
		return { state, exitCode: 0 };
	}
	const now = options.now ?? new Date();
	const nowMs = now.getTime();
	const checkpointAt = now.toISOString();

	state.activeMs =
		(state.activeMs ?? 0) +
		(state.activeSince
			? Math.max(0, nowMs - Date.parse(state.activeSince))
			: 0);
	state.activeSince = checkpointAt;

	const done = Math.min(
		state.total,
		Math.max(state.done + 1, options.done ?? 0),
	);
	state.done = done;
	state.currentId = options.itemId;
	state.imagesAccepted += options.imagesAccepted ?? 0;
	state.imagesRejected += options.imagesRejected ?? 0;
	state.tokens += options.tokens ?? 0;
	state.lastCheckpointAt = checkpointAt;
	state.heartbeatAt = checkpointAt;
	state.updatedAt = checkpointAt;

	await appendCheckpoint(options.root, options.batchId, {
		at: checkpointAt,
		item: options.itemId,
		done,
		imagesAccepted: state.imagesAccepted,
		imagesRejected: state.imagesRejected,
		tokens: state.tokens,
	});

	const itemMs = state.lastItemStartedAt
		? nowMs - Date.parse(state.lastItemStartedAt)
		: 0;
	if (itemMs > itemLimitMs()) {
		addBlocker(
			state,
			`per-item limit exceeded: ${options.itemId} took ${Math.round(itemMs / 60_000)}m`,
		);
		state.status = "paused";
		state.endedAt = checkpointAt;
	}
	if ((state.activeMs ?? 0) > batchLimitMs()) {
		addBlocker(state, "per-batch 4h limit exceeded");
		state.status = "stopped";
		state.endedAt = checkpointAt;
		await requestBatchStop(options.root, options.batchId, "per-batch limit");
	}

	const globalStop = await isGlobalStop(options.root);
	const stopped = await isBatchStop(options.root, options.batchId);
	const paused = await isBatchPause(options.root, options.batchId);
	if (globalStop || stopped) {
		state.status = "stopped";
		state.endedAt = checkpointAt;
	} else if (paused && state.status === "running") {
		state.status = "paused";
		state.endedAt = checkpointAt;
	}

	if (state.status === "running") {
		state.lastItemStartedAt = checkpointAt;
		state.activeSince = checkpointAt;
	} else {
		state.activeSince = undefined;
	}
	await writeState(options.root, state);
	await appendLog(options.root, options.batchId, statusLine(state, nowMs));
	return {
		state,
		exitCode:
			state.status === "running" || state.status === "complete" ? 0 : 75,
	};
}

export async function finishBatch(
	root: string,
	batchId: string,
	assetsDir?: string,
	now = new Date(),
): Promise<RunnerResult> {
	const state = await readState(root, batchId);
	if (state.done < state.total) {
		addBlocker(state, `finished at ${state.done}/${state.total} items`);
	}
	const counts = await runnerAssetCounts(root, assetsDir ? [assetsDir] : []);
	const issues = capIssues(counts);
	for (const cap of issues) addBlocker(state, cap.message);
	if (issues.length > 0) {
		state.status = "cap-reached";
		await requestGlobalStop(root, issues.map((cap) => cap.message).join("; "));
	} else if (state.done < state.total) {
		state.status = "blocked";
	} else {
		state.status = "complete";
	}
	state.activeSince = undefined;
	state.updatedAt = now.toISOString();
	state.heartbeatAt = state.updatedAt;
	state.endedAt = state.updatedAt;
	await writeState(root, state);
	await appendLog(root, batchId, statusLine(state, now.getTime()));
	return {
		state,
		exitCode: state.status === "complete" ? 0 : 75,
	};
}

export async function pauseBatch(
	root: string,
	batchId: string,
): Promise<BatchState> {
	await requestBatchPause(root, batchId);
	const state = await readState(root, batchId);
	if (isActive(state)) {
		state.pauseRequested = true;
		state.updatedAt = new Date().toISOString();
		await writeState(root, state);
	}
	await appendLog(root, batchId, `pause requested ${state.batchId}`);
	return state;
}

export async function stopBatch(
	root: string,
	batchId: string,
): Promise<BatchState> {
	await requestBatchStop(root, batchId);
	const state = await readState(root, batchId);
	if (isActive(state)) {
		state.stopRequested = true;
		state.updatedAt = new Date().toISOString();
		await writeState(root, state);
	}
	await appendLog(root, batchId, `stop requested ${state.batchId}`);
	return state;
}

export async function resumeBatch(
	root: string,
	batchId: string,
): Promise<BatchState> {
	if (await isGlobalStop(root)) {
		throw new Error(
			"global STOP is active; clear it with `catalog:resume --all`",
		);
	}
	await clearBatchStop(root, batchId);
	await clearBatchPause(root, batchId);
	const state = await readState(root, batchId);
	state.status = "running";
	state.endedAt = undefined;
	state.pauseRequested = false;
	state.stopRequested = false;
	state.updatedAt = new Date().toISOString();
	state.heartbeatAt = state.updatedAt;
	state.lastItemStartedAt = state.updatedAt;
	state.activeSince = state.updatedAt;
	await writeState(root, state);
	await appendLog(root, batchId, `resumed ${state.batchId}`);
	return state;
}

export async function stopAll(
	root: string,
	reason = "global STOP",
): Promise<void> {
	await requestGlobalStop(root, reason);
	for (const state of await listStates(root)) {
		if (!isActive(state)) continue;
		state.stopRequested = true;
		state.updatedAt = new Date().toISOString();
		await writeState(root, state);
	}
}

export async function resumeAll(root: string): Promise<BatchState[]> {
	await clearGlobalStop(root);
	const states = await listStates(root);
	for (const state of states) {
		if (
			state.status !== "stopped" &&
			state.status !== "paused" &&
			!state.stopRequested &&
			!state.pauseRequested
		) {
			continue;
		}
		await clearBatchStop(root, state.batchId);
		await clearBatchPause(root, state.batchId);
		state.status = "running";
		state.endedAt = undefined;
		state.pauseRequested = false;
		state.stopRequested = false;
		state.updatedAt = new Date().toISOString();
		state.heartbeatAt = state.updatedAt;
		state.lastItemStartedAt = state.updatedAt;
		state.activeSince = state.updatedAt;
		await writeState(root, state);
	}
	return listStates(root);
}

export async function heartbeat(
	root: string,
	batchId: string,
): Promise<BatchState> {
	const state = await readState(root, batchId);
	state.heartbeatAt = new Date().toISOString();
	state.updatedAt = state.heartbeatAt;
	await writeState(root, state);
	return state;
}

export async function flagBatch(
	root: string,
	batchId: string,
	reason: string,
): Promise<BatchState> {
	const state = await readState(root, batchId);
	addBlocker(state, reason);
	state.updatedAt = new Date().toISOString();
	await writeState(root, state);
	await appendLog(root, batchId, `flag: ${reason}`);
	return state;
}

export async function unflagBatch(
	root: string,
	batchId: string,
	reason: string,
): Promise<BatchState> {
	const state = await readState(root, batchId);
	state.blockers = state.blockers.filter((entry) => entry !== reason);
	state.updatedAt = new Date().toISOString();
	await writeState(root, state);
	return state;
}
