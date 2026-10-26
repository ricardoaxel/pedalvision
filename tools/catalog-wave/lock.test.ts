import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	acquireWaveLock,
	assertNoLiveWave,
	releaseWaveLock,
	waveLockPath,
} from "./lock.ts";
import { waveDirPath, writeWaveState } from "./wave-state.ts";

const tempDirs: string[] = [];
const alive = (pid: number) => pid === process.pid;
const dead = () => false;

async function tempWork(): Promise<string> {
	const dir = await mkdtemp(join(tmpdir(), "catalog-wave-lock-"));
	tempDirs.push(dir);
	return dir;
}

afterEach(async () => {
	await Promise.all(
		tempDirs.splice(0).map((dir) => rm(dir, { recursive: true })),
	);
});

describe("wave lock", () => {
	it("refuses a live lock and releases its own", async () => {
		const work = await tempWork();
		await acquireWaveLock(work, "wave-1", process.pid, alive);
		await expect(
			acquireWaveLock(work, "wave-1", conditionPid(), alive),
		).rejects.toThrow(/live runner/);
		await releaseWaveLock(work, "wave-1");
		expect(
			await readFile(waveLockPath(work, "wave-1"), "utf8").catch(() => ""),
		).toBe("");
	});

	it("recovers a stale lock once", async () => {
		const work = await tempWork();
		await mkdir(waveDirPath(work, "wave-2"), { recursive: true });
		await mkdir(waveLockPath(work, "wave-2"));
		await writeFile(join(waveLockPath(work, "wave-2"), "pid"), "999999");
		await acquireWaveLock(work, "wave-2", process.pid, dead);
		expect(
			await readFile(join(waveLockPath(work, "wave-2"), "pid"), "utf8"),
		).toBe(String(process.pid));
	});

	it("refuses a wave state whose runner is alive", async () => {
		const work = await tempWork();
		await writeWaveState(work, {
			version: 1,
			id: "wave-3",
			status: "running",
			startedAt: new Date().toISOString(),
			planPath: "/tmp/plan.json",
			runnerPid: process.pid,
			batches: [],
			notes: [],
			reportPath: "/tmp/report.md",
		});
		await expect(assertNoLiveWave(work, "wave-3", alive)).rejects.toThrow(
			/already running/,
		);
	});
});

function conditionPid(): number {
	return process.pid + 1;
}
