import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { BatchState } from "../catalog-runner/state.ts";
import type { JsonlSummary } from "./aggregate.ts";
import type { BatchTokens } from "./gate.ts";

/** Shared wave state (gitignored under work/catalog/waves/<id>/state.json). */
export type WaveBatchStatus =
	| "queued"
	| "running"
	| "complete"
	| "stopped"
	| "failed"
	| "not-started";

export type WavePr = {
	number: number;
	url: string;
	state: string;
	checks: string;
};

export type WaveBatchRun = {
	batch: string;
	branch: string;
	worktree: string;
	total: number;
	status: WaveBatchStatus;
	log: string;
	pid?: number;
	startedAt?: string;
	endedAt?: string;
	runner?: Pick<
		BatchState,
		| "done"
		| "total"
		| "imagesAccepted"
		| "imagesRejected"
		| "tokens"
		| "status"
		| "blockers"
		| "startedAt"
		| "endedAt"
	>;
	session?: JsonlSummary;
	/** Billed non-cache (gated) + cache-inclusive JSONL floor (reported). */
	usage?: BatchTokens;
	pr?: WavePr;
	error?: string;
};

export type WaveState = {
	version: 1;
	id: string;
	status: "running" | "complete" | "stopped" | "failed";
	startedAt: string;
	endedAt?: string;
	planPath: string;
	runnerPid?: number;
	batches: WaveBatchRun[];
	notes: string[];
	reportPath: string;
};

export function waveDirPath(workRoot: string, id: string): string {
	return join(workRoot, "waves", id);
}

export function waveStatePath(workRoot: string, id: string): string {
	return join(waveDirPath(workRoot, id), "state.json");
}

export function waveReportPath(workRoot: string, id: string): string {
	return join(waveDirPath(workRoot, id), "report.md");
}

export async function readWaveState(
	workRoot: string,
	id: string,
): Promise<WaveState | undefined> {
	try {
		return JSON.parse(
			await readFile(waveStatePath(workRoot, id), "utf8"),
		) as WaveState;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
		throw error;
	}
}

export async function writeWaveState(
	workRoot: string,
	state: WaveState,
): Promise<void> {
	const path = waveStatePath(workRoot, state.id);
	await mkdir(dirname(path), { recursive: true });
	const temp = `${path}.${process.pid}.${Date.now()}.tmp`;
	await writeFile(temp, `${JSON.stringify(state, null, 2)}\n`);
	await rename(temp, path);
}
