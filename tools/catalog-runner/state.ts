import {
	appendFile,
	mkdir,
	readdir,
	readFile,
	rename,
	writeFile,
} from "node:fs/promises";
import { dirname } from "node:path";
import { checkpointPath, logPath, stateDir, statePath } from "./paths.ts";

let writeSequence = 0;

/**
 * Per-batch progress state (P5-02). Written atomically; the checkpoint log is
 * append-only so a kill can never lose the items already completed.
 */

export type RunnerStatus =
	| "running"
	| "paused"
	| "stopped"
	| "blocked"
	| "complete"
	| "cap-reached";

export type BatchState = {
	version: 1;
	batchId: string;
	kind: "pedals" | "boards";
	brand: string;
	worktree: string;
	status: RunnerStatus;
	total: number;
	done: number;
	currentId?: string;
	imagesAccepted: number;
	imagesRejected: number;
	tokens: number;
	startedAt: string;
	updatedAt: string;
	heartbeatAt: string;
	lastCheckpointAt?: string;
	lastItemStartedAt?: string;
	/** Active (unpaused) time only; paused gaps do not count toward the 4h limit. */
	activeMs?: number;
	activeSince?: string;
	endedAt?: string;
	pid?: number;
	/** The supervisor process, which keeps finalizing after the child exits. */
	supervisorPid?: number;
	pauseRequested?: boolean;
	stopRequested?: boolean;
	blockers: string[];
};

export type NewBatchState = {
	batchId: string;
	kind: "pedals" | "boards";
	brand: string;
	total: number;
	worktree: string;
	now?: Date;
};

export function createState(input: NewBatchState): BatchState {
	const now = (input.now ?? new Date()).toISOString();
	return {
		version: 1,
		batchId: input.batchId,
		kind: input.kind,
		brand: input.brand,
		worktree: input.worktree,
		status: "running",
		total: input.total,
		done: 0,
		imagesAccepted: 0,
		imagesRejected: 0,
		tokens: 0,
		startedAt: now,
		updatedAt: now,
		heartbeatAt: now,
		activeMs: 0,
		activeSince: now,
		blockers: [],
	};
}

export async function writeState(
	root: string,
	state: BatchState,
): Promise<void> {
	const path = statePath(root, state.batchId);
	await mkdir(dirname(path), { recursive: true });
	const temp = `${path}.tmp-${process.pid}-${writeSequence++}`;
	await writeFile(temp, `${JSON.stringify(state, null, 2)}\n`);
	await rename(temp, path);
}

export async function readState(
	root: string,
	batchId: string,
): Promise<BatchState> {
	const raw = await readFile(statePath(root, batchId), "utf8");
	return JSON.parse(raw) as BatchState;
}

export async function tryReadState(
	root: string,
	batchId: string,
): Promise<BatchState | undefined> {
	try {
		return await readState(root, batchId);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
		throw error;
	}
}

export async function listStates(root: string): Promise<BatchState[]> {
	let entries: string[];
	try {
		entries = await readdir(stateDir(root));
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
		throw error;
	}
	const states: BatchState[] = [];
	for (const entry of entries.filter((name) => name.endsWith(".json")).sort()) {
		const raw = await readFile(`${stateDir(root)}/${entry}`, "utf8");
		states.push(JSON.parse(raw) as BatchState);
	}
	return states;
}

export async function appendCheckpoint(
	root: string,
	batchId: string,
	entry: Record<string, unknown>,
): Promise<void> {
	const path = checkpointPath(root, batchId);
	await mkdir(dirname(path), { recursive: true });
	await appendFile(path, `${JSON.stringify(entry)}\n`);
}

export async function appendLog(
	root: string,
	batchId: string,
	line: string,
): Promise<void> {
	const path = logPath(root, batchId);
	await mkdir(dirname(path), { recursive: true });
	await appendFile(path, `${line}\n`);
}

export function elapsedMs(state: BatchState, now = Date.now()): number {
	return Math.max(0, now - Date.parse(state.startedAt));
}

export function statusLine(state: BatchState, now = Date.now()): string {
	const percent =
		state.total > 0 ? Math.round((state.done / state.total) * 100) : 0;
	const images = `${state.imagesAccepted}/${state.imagesRejected}`;
	const blockers = state.blockers.length;
	const minutes = Math.round(elapsedMs(state, now) / 60_000);
	return `${state.brand} ${state.batchId}: ${percent}% · ${state.done}/${state.total} items · images ${images} · ${minutes}m · blockers ${blockers} · ${state.status}`;
}

export function itemLimitMs(): number {
	return Number(process.env.CATALOG_ITEM_LIMIT_MS ?? 12 * 60_000);
}

export function batchLimitMs(): number {
	return Number(process.env.CATALOG_BATCH_LIMIT_MS ?? 4 * 60 * 60_000);
}

export function staleMs(): number {
	return Number(process.env.CATALOG_STALE_MS ?? 30 * 60_000);
}

export function isStale(state: BatchState, now = Date.now()): boolean {
	return (
		(state.status === "running" || state.status === "paused") &&
		now - Date.parse(state.heartbeatAt) > staleMs()
	);
}

export function isActive(state: BatchState): boolean {
	return state.status === "running" || state.status === "paused";
}

export function addBlocker(state: BatchState, blocker: string): void {
	if (!state.blockers.includes(blocker)) state.blockers.push(blocker);
}
