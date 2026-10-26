import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { readWaveState, waveDirPath } from "./wave-state.ts";

/** A wave may not start if a live runner already owns the id. */
export async function assertNoLiveWave(
	work: string,
	id: string,
	isAlive: (pid: number) => boolean,
): Promise<void> {
	const existing = await readWaveState(work, id);
	if (
		existing?.status === "running" &&
		existing.runnerPid &&
		isAlive(existing.runnerPid)
	) {
		throw new Error(
			`wave "${id}" is already running (pid ${existing.runnerPid}); use a new plan id`,
		);
	}
}

export function waveLockPath(work: string, id: string): string {
	return join(waveDirPath(work, id), ".lock");
}

/**
 * `mkdir` is the atomic lock primitive. On a stale lock (dead pid) we remove it
 * and retry exactly once; a second `EEXIST` means another runner won the
 * recovery race, so we refuse instead of double-launching.
 */
export async function acquireWaveLock(
	work: string,
	id: string,
	pid: number,
	isAlive: (pid: number) => boolean,
): Promise<void> {
	await assertNoLiveWave(work, id, isAlive);
	await mkdir(waveDirPath(work, id), { recursive: true });
	const lock = waveLockPath(work, id);
	for (let attempt = 0; attempt < 2; attempt++) {
		try {
			await mkdir(lock);
			await writeFile(join(lock, "pid"), String(pid));
			return;
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
			const holder = Number(
				await readFile(join(lock, "pid"), "utf8").catch(() => ""),
			);
			if (Number.isFinite(holder) && holder > 0 && isAlive(holder)) {
				throw new Error(
					`wave "${id}" lock is held by a live runner (pid ${holder})`,
				);
			}
			if (attempt > 0) {
				throw new Error(`wave "${id}" lock recovery raced; retry`);
			}
			await rm(lock, { recursive: true, force: true });
		}
	}
}

export async function releaseWaveLock(work: string, id: string): Promise<void> {
	await rm(waveLockPath(work, id), { recursive: true, force: true });
}
