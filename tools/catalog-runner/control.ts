import { access, mkdir, rm, writeFile } from "node:fs/promises";
import { batchControlPath, controlDir, globalStopPath } from "./paths.ts";

/**
 * File-based control plane (P5-02): a global STOP marker plus one pause/stop
 * marker per batch. Files are easy for an agent to set and for a supervisor to
 * poll, and work across processes without a database.
 */

async function exists(path: string): Promise<boolean> {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

async function marker(
	root: string,
	path: string,
	reason?: string,
): Promise<void> {
	await mkdir(controlDir(root), { recursive: true });
	await writeFile(path, `${reason ?? ""}\n`);
}

export async function requestGlobalStop(
	root: string,
	reason = "global STOP",
): Promise<void> {
	await marker(root, globalStopPath(root), reason);
}

export async function clearGlobalStop(root: string): Promise<void> {
	await rm(globalStopPath(root), { force: true });
}

export async function isGlobalStop(root: string): Promise<boolean> {
	return exists(globalStopPath(root));
}

export async function requestBatchStop(
	root: string,
	batchId: string,
	reason = "batch stop",
): Promise<void> {
	await marker(root, batchControlPath(root, batchId, "stop"), reason);
}

export async function requestBatchPause(
	root: string,
	batchId: string,
	reason = "batch pause",
): Promise<void> {
	await marker(root, batchControlPath(root, batchId, "pause"), reason);
}

export async function clearBatchStop(
	root: string,
	batchId: string,
): Promise<void> {
	await rm(batchControlPath(root, batchId, "stop"), { force: true });
}

export async function clearBatchPause(
	root: string,
	batchId: string,
): Promise<void> {
	await rm(batchControlPath(root, batchId, "pause"), { force: true });
}

export async function isBatchStop(
	root: string,
	batchId: string,
): Promise<boolean> {
	return exists(batchControlPath(root, batchId, "stop"));
}

export async function isBatchPause(
	root: string,
	batchId: string,
): Promise<boolean> {
	return exists(batchControlPath(root, batchId, "pause"));
}

export async function clearAllControls(root: string): Promise<void> {
	await clearGlobalStop(root);
	await rm(controlDir(root), { recursive: true, force: true });
}
