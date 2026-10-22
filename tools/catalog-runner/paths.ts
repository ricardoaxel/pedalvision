import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { repoRoot } from "./repo.ts";

/** Runtime control-plane paths (P5-02). Everything here is gitignored. */
export function workRoot(root: string): string {
	if (process.env.CATALOG_WORK_DIR) {
		return resolve(root, process.env.CATALOG_WORK_DIR);
	}
	return join(repoRoot(root), "work/catalog");
}

export function stateDir(root: string): string {
	return join(workRoot(root), "state");
}

export function controlDir(root: string): string {
	return join(workRoot(root), "control");
}

export function checkpointDir(root: string): string {
	return join(workRoot(root), "checkpoints");
}

export function logDir(root: string): string {
	return join(workRoot(root), "logs");
}

export function imageQaDir(root: string): string {
	return join(workRoot(root), "image-qa");
}

export async function ensureControlDirs(root: string): Promise<void> {
	for (const dir of [
		stateDir(root),
		controlDir(root),
		checkpointDir(root),
		logDir(root),
		imageQaDir(root),
	]) {
		await mkdir(dir, { recursive: true });
	}
}

export function statePath(root: string, batchId: string): string {
	return join(stateDir(root), `${batchId.replaceAll("/", "__")}.json`);
}

export function checkpointPath(root: string, batchId: string): string {
	return join(checkpointDir(root), `${batchId.replaceAll("/", "__")}.jsonl`);
}

export function logPath(root: string, batchId: string): string {
	return join(logDir(root), `${batchId.replaceAll("/", "__")}.log`);
}

export function globalStopPath(root: string): string {
	return join(controlDir(root), "STOP");
}

export function batchControlPath(
	root: string,
	batchId: string,
	action: "pause" | "stop",
): string {
	return join(controlDir(root), `${batchId.replaceAll("/", "__")}.${action}`);
}
