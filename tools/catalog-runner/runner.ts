import { access } from "node:fs/promises";
import {
	canStartBatch,
	capIssues,
	scanAssetCounts,
} from "../catalog-pipeline/caps.ts";
import { assetsRoot } from "../catalog-pipeline/paths.ts";
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
import { ensureControlDirs } from "./paths.ts";
import {
	addBlocker,
	appendCheckpoint,
	appendLog,
	type BatchState,
	batchLimitMs,
	createState,
	elapsedMs,
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

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function terminate(pid: number | undefined): Promise<void> {
	if (!pid || !alive(pid)) return;
	try {
		process.kill(pid, "SIGTERM");
	} catch {
		return;
	}
	const deadline = Date.now() + killGraceMs();
	while (Date.now() < deadline) {
		if (!alive(pid)) return;
		await sleep(50);
	}
	try {
		process.kill(pid, "SIGKILL");
	} catch {
		// Already gone.
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
	const existing = await tryReadState(options.root, options.batchId);
	if (existing && isActive(existing)) {
		throw new Error(`batch "${options.batchId}" is already ${existing.status}`);
	}
	const active = (await listStates(options.root)).filter(isActive);
	if (active.length >= 3) {
		throw new Error(
			`max 3 batches in flight (active: ${active.map((state) => state.batchId).join(", ")})`,
		);
	}
	await assertWorktree(options.worktree);

	const counts = await scanAssetCounts(
		options.assetsDir ?? assetsRoot(options.root),
	);
	const check = canStartBatch(options.kind, options.total, counts);
	if (!check.ok) {
		throw new Error(`refused "${options.batchId}": ${check.reason}`);
	}

	const state = createState({
		batchId: options.batchId,
		kind: options.kind,
		brand: options.brand,
		total: options.total,
		worktree: options.worktree,
		now: options.now,
	});
	state.lastItemStartedAt = state.startedAt;
	await writeState(options.root, state);
	await appendLog(options.root, state.batchId, statusLine(state));
	return state;
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
	if (elapsedMs(state, nowMs) > batchLimitMs()) {
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
	const counts = await scanAssetCounts(assetsDir ?? assetsRoot(root));
	const issues = capIssues(counts);
	for (const cap of issues) addBlocker(state, cap.message);
	if (issues.length > 0) {
		state.status = "cap-reached";
		await requestGlobalStop(root, issues.map((cap) => cap.message).join("; "));
	} else if (state.status !== "stopped") {
		state.status = "complete";
	}
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
	await terminate(state.pid);
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
		await terminate(state.pid);
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
