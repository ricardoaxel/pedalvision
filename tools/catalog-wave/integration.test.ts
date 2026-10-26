import { execSync, spawn, spawnSync } from "node:child_process";
import {
	chmod,
	mkdir,
	mkdtemp,
	readdir,
	readFile,
	rm,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
const tempDirs: string[] = [];
const worktrees: Array<{ path: string; branch: string }> = [];

afterEach(async () => {
	for (const worktree of worktrees.splice(0)) {
		try {
			execSync(`git worktree remove --force "${worktree.path}"`, {
				cwd: repoRoot,
				stdio: "ignore",
			});
		} catch {
			// already gone
		}
		try {
			execSync(`git branch -D "${worktree.branch}"`, {
				cwd: repoRoot,
				stdio: "ignore",
			});
		} catch {
			// already gone
		}
	}
	await Promise.all(
		tempDirs.splice(0).map((dir) => rm(dir, { recursive: true })),
	);
});

function addWorktree(
	temp: string,
	suffix: string,
): { path: string; branch: string } {
	const branch = `p5-wave-it-${process.pid}-${suffix}-${Date.now()}`;
	const path = join(temp, `wt-${suffix}`);
	execSync(`git worktree add -b "${branch}" "${path}" HEAD`, {
		cwd: repoRoot,
		stdio: "ignore",
	});
	worktrees.push({ path, branch });
	return { path, branch };
}

function branches(): string {
	return execSync("git rev-parse --abbrev-ref HEAD", {
		cwd: repoRoot,
		encoding: "utf8",
	}).trim();
}

describe("catalog:wave integration", () => {
	it("launches a fake session, captures its JSONL and writes the report", async () => {
		const temp = await mkdtemp(join(tmpdir(), "catalog-wave-it-"));
		tempDirs.push(temp);
		const batch = `acme/wave-it-${process.pid}`;
		const waveId = `wave-it-${process.pid}`;
		const bin = join(temp, "bin");
		await mkdir(bin, { recursive: true });
		await writeFile(
			join(bin, "opencode"),
			[
				"#!/bin/sh",
				'echo \'{"type":"text","sessionID":"ses_fake","part":{"id":"p1","type":"text","text":"fake batch done"}}\'',
				'echo \'{"type":"step_finish","sessionID":"ses_fake","part":{"id":"f1","type":"step-finish","tokens":{"total":1000,"input":700,"output":200,"reasoning":100,"cache":{"read":0,"write":0}},"cost":0.01}}\'',
				`"${process.execPath}" --experimental-strip-types tools/catalog-runner/index.ts checkpoint --batch "$CATALOG_BATCH_ID" --item fake-1 --done 1 --images-accepted 1 --tokens 1000 >/dev/null 2>&1`,
				`"${process.execPath}" --experimental-strip-types tools/catalog-runner/index.ts finish --batch "$CATALOG_BATCH_ID" >/dev/null 2>&1`,
			].join("\n"),
		);
		await chmod(join(bin, "opencode"), 0o755);

		const planPath = join(temp, "wave.json");
		await writeFile(
			planPath,
			JSON.stringify({
				id: waveId,
				maxParallel: 2,
				batches: [
					{
						batch,
						kind: "pedals",
						brand: "Acme",
						total: 1,
						worktree: repoRoot,
						branch: branches(),
						prompt: "fake",
					},
				],
			}),
		);

		const result = spawnSync(
			process.execPath,
			[
				"--experimental-strip-types",
				join(repoRoot, "tools/catalog-wave/index.ts"),
				"run",
				"--plan",
				planPath,
				"--foreground",
				"--poll-ms",
				"50",
			],
			{
				cwd: repoRoot,
				encoding: "utf8",
				env: {
					...process.env,
					PATH: `${bin}:${process.env.PATH ?? ""}`,
					CATALOG_WORK_DIR: join(temp, "work"),
				},
				timeout: 90_000,
			},
		);
		expect(result.status, result.stderr).toBe(0);
		const report = await readFile(
			join(temp, "work", "waves", waveId, "report.md"),
			"utf8",
		);
		expect(report).toContain("Status **complete**");
		expect(report).toContain("| acme/wave-it-");
		expect(report).toContain("1/1");
		expect(report).toContain("| 1k | 1k |");
		expect(report).toContain("**1k** | **1k (floor)**");
		expect(report).toContain("fake batch done");
		expect(report).not.toContain("not-started");
	}, 120_000);
});

describe("catalog:wave stop path", () => {
	it("never starts the queued third batch after SIGTERM", async () => {
		const temp = await mkdtemp(join(tmpdir(), "catalog-wave-stop-"));
		tempDirs.push(temp);
		const waveId = `wave-stop-${process.pid}`;
		const batches = ["a", "b", "c"].map(
			(suffix) => `acme/stop-${suffix}-${process.pid}`,
		);
		const bin = join(temp, "bin");
		await mkdir(bin, { recursive: true });
		await writeFile(
			join(bin, "opencode"),
			[
				"#!/bin/sh",
				"trap 'exit 0' TERM",
				'echo \'{"type":"text","sessionID":"ses_stop","part":{"id":"p1","type":"text","text":"stopping"}}\'',
				"sleep 10",
			].join("\n"),
		);
		await chmod(join(bin, "opencode"), 0o755);
		const worktreesForStop = ["a", "b", "c"].map((suffix) =>
			addWorktree(temp, `stop-${suffix}`),
		);
		const planPath = join(temp, "wave.json");
		await writeFile(
			planPath,
			JSON.stringify({
				id: waveId,
				maxParallel: 3,
				batches: batches.map((batch, index) => ({
					batch,
					kind: "pedals",
					brand: "Acme",
					total: 1,
					worktree: worktreesForStop[index]?.path as string,
					branch: worktreesForStop[index]?.branch as string,
					prompt: "fake",
				})),
			}),
		);
		const child = spawn(
			process.execPath,
			[
				"--experimental-strip-types",
				join(repoRoot, "tools/catalog-wave/index.ts"),
				"run",
				"--plan",
				planPath,
				"--foreground",
				"--poll-ms",
				"50",
			],
			{
				cwd: repoRoot,
				env: {
					...process.env,
					PATH: `${bin}:${process.env.PATH ?? ""}`,
					CATALOG_WORK_DIR: join(temp, "work"),
					CATALOG_STOP_GRACE_MS: "100",
					CATALOG_KILL_GRACE_MS: "100",
				},
				stdio: ["ignore", "pipe", "pipe"],
			},
		);
		const statePath = join(temp, "work", "waves", waveId, "state.json");
		const stderr: string[] = [];
		const stdout: string[] = [];
		child.stderr?.on("data", (chunk) => stderr.push(String(chunk)));
		child.stdout?.on("data", (chunk) => stdout.push(String(chunk)));
		try {
			await waitFor(async () => {
				try {
					const state = JSON.parse(await readFile(statePath, "utf8")) as {
						batches: Array<{ status: string }>;
					};
					return (
						state.batches.filter((b) => b.status === "running").length === 2
					);
				} catch {
					return false;
				}
			});
		} catch (error) {
			child.kill("SIGKILL");
			throw new Error(
				`${(error as Error).message}\nSTDOUT:\n${stdout.join("")}\nSTDERR:\n${stderr.join("")}`,
			);
		}
		child.kill("SIGTERM");
		await new Promise<void>((resolve, reject) => {
			const timer = setTimeout(
				() => reject(new Error("runner did not exit")),
				30_000,
			);
			child.on("exit", () => {
				clearTimeout(timer);
				resolve();
			});
		});
		const state = JSON.parse(await readFile(statePath, "utf8")) as {
			status: string;
			batches: Array<{ batch: string; status: string }>;
		};
		const byId = new Map(
			state.batches.map((batch) => [batch.batch, batch.status]),
		);
		expect(byId.get(batches[0] as string)).toBe("stopped");
		expect(byId.get(batches[1] as string)).toBe("stopped");
		expect(byId.get(batches[2] as string)).toBe("not-started");
		const report = await readFile(
			join(temp, "work", "waves", waveId, "report.md"),
			"utf8",
		);
		expect(report).toContain("wave stop requested");
	}, 60_000);
});

describe("catalog:wave hard-cap path", () => {
	it("stops active batches and never starts the queued third at the hard cap", async () => {
		const temp = await mkdtemp(join(tmpdir(), "catalog-wave-cap-"));
		tempDirs.push(temp);
		const waveId = `wave-cap-${process.pid}`;
		const batches = ["a", "b", "c"].map(
			(suffix) => `acme/cap-${suffix}-${process.pid}`,
		);
		const bin = join(temp, "bin");
		await mkdir(bin, { recursive: true });
		await writeFile(
			join(bin, "opencode"),
			[
				"#!/bin/sh",
				"trap 'exit 0' TERM",
				'echo \'{"type":"step_finish","sessionID":"ses_cap","part":{"id":"f1","type":"step-finish","tokens":{"total":1300000,"input":1200000,"output":80000,"reasoning":20000,"cache":{"read":0,"write":0}},"cost":0.01}}\'',
				"sleep 10",
			].join("\n"),
		);
		await chmod(join(bin, "opencode"), 0o755);
		const worktreesForCap = ["a", "b", "c"].map((suffix) =>
			addWorktree(temp, `cap-${suffix}`),
		);
		const planPath = join(temp, "wave.json");
		await writeFile(
			planPath,
			JSON.stringify({
				id: waveId,
				maxParallel: 3,
				batches: batches.map((batch, index) => ({
					batch,
					kind: "pedals",
					brand: "Acme",
					total: 1,
					worktree: worktreesForCap[index]?.path as string,
					branch: worktreesForCap[index]?.branch as string,
					prompt: "fake",
				})),
			}),
		);
		const result = spawnSync(
			process.execPath,
			[
				"--experimental-strip-types",
				join(repoRoot, "tools/catalog-wave/index.ts"),
				"run",
				"--plan",
				planPath,
				"--foreground",
				"--poll-ms",
				"50",
			],
			{
				cwd: repoRoot,
				encoding: "utf8",
				env: {
					...process.env,
					PATH: `${bin}:${process.env.PATH ?? ""}`,
					CATALOG_WORK_DIR: join(temp, "work"),
					CATALOG_STOP_GRACE_MS: "100",
					CATALOG_KILL_GRACE_MS: "100",
				},
				timeout: 90_000,
			},
		);
		expect(result.status, result.stderr).toBe(0);
		const state = JSON.parse(
			await readFile(join(temp, "work", "waves", waveId, "state.json"), "utf8"),
		) as {
			status: string;
			notes: string[];
			batches: Array<{ batch: string; status: string }>;
		};
		const byId = new Map(
			state.batches.map((batch) => [batch.batch, batch.status]),
		);
		expect(byId.get(batches[0] as string)).toBe("stopped");
		expect(byId.get(batches[1] as string)).toBe("stopped");
		expect(byId.get(batches[2] as string)).toBe("not-started");
		expect(state.notes.join("\n")).toContain("wave hard budget reached");
		expect(
			state.notes.filter((note) => note.startsWith("wave hard budget reached")),
		).toHaveLength(1);
		const report = await readFile(
			join(temp, "work", "waves", waveId, "report.md"),
			"utf8",
		);
		expect(report).toContain("2.60M");
		expect(report).toContain("wave hard budget reached");
	}, 120_000);
});

describe("catalog:wave third-slot true-token wiring", () => {
	it("keeps the third slot closed when billed tokens pass the gate", async () => {
		const temp = await mkdtemp(join(tmpdir(), "catalog-wave-third-"));
		tempDirs.push(temp);
		const waveId = `wave-third-${process.pid}`;
		const batches = ["a", "b", "c"].map(
			(suffix) => `acme/third-${suffix}-${process.pid}`,
		);
		const bin = join(temp, "bin");
		await mkdir(bin, { recursive: true });
		await writeFile(
			join(bin, "opencode"),
			[
				"#!/bin/sh",
				"trap 'exit 0' TERM",
				'echo \'{"type":"step_finish","sessionID":"ses_third","part":{"id":"f1","type":"step-finish","tokens":{"total":200000,"input":180000,"output":15000,"reasoning":5000,"cache":{"read":0,"write":0}},"cost":0.01}}\'',
				`"${process.execPath}" --experimental-strip-types tools/catalog-runner/index.ts checkpoint --batch "$CATALOG_BATCH_ID" --item fake-1 --done 1 --images-accepted 1 --tokens 1000 >/dev/null 2>&1`,
				"sleep 10",
			].join("\n"),
		);
		await chmod(join(bin, "opencode"), 0o755);
		const worktreesForThird = ["a", "b", "c"].map((suffix) =>
			addWorktree(temp, `third-${suffix}`),
		);
		const planPath = join(temp, "wave.json");
		await writeFile(
			planPath,
			JSON.stringify({
				id: waveId,
				maxParallel: 3,
				batches: batches.map((batch, index) => ({
					batch,
					kind: "pedals",
					brand: "Acme",
					total: 1,
					worktree: worktreesForThird[index]?.path as string,
					branch: worktreesForThird[index]?.branch as string,
					prompt: "fake",
				})),
			}),
		);
		const child = spawn(
			process.execPath,
			[
				"--experimental-strip-types",
				join(repoRoot, "tools/catalog-wave/index.ts"),
				"run",
				"--plan",
				planPath,
				"--foreground",
				"--poll-ms",
				"50",
			],
			{
				cwd: repoRoot,
				env: {
					...process.env,
					PATH: `${bin}:${process.env.PATH ?? ""}`,
					CATALOG_WORK_DIR: join(temp, "work"),
					CATALOG_STOP_GRACE_MS: "100",
					CATALOG_KILL_GRACE_MS: "100",
				},
				stdio: ["ignore", "pipe", "pipe"],
			},
		);
		const statePath = join(temp, "work", "waves", waveId, "state.json");
		try {
			await waitFor(async () => {
				try {
					const state = JSON.parse(await readFile(statePath, "utf8")) as {
						batches: Array<{
							batch: string;
							status: string;
							runner?: { done: number };
						}>;
						notes: string[];
					};
					const active = state.batches.filter(
						(batch) => batch.status === "running",
					);
					return (
						active.length === 2 &&
						active.every((batch) => (batch.runner?.done ?? 0) >= 1) &&
						state.notes.some((note) =>
							note.includes(
								"third slot waiting: first batch used 200000 billed tokens",
							),
						)
					);
				} catch {
					return false;
				}
			});
		} catch (error) {
			child.kill("SIGKILL");
			throw new Error((error as Error).message);
		}
		const state = JSON.parse(await readFile(statePath, "utf8")) as {
			batches: Array<{ batch: string; status: string }>;
			notes: string[];
		};
		const byId = new Map(
			state.batches.map((batch) => [batch.batch, batch.status]),
		);
		expect(byId.get(batches[2] as string)).toBe("queued");
		expect(state.notes.join("\n")).toContain("200000 billed tokens");
		child.kill("SIGTERM");
		await new Promise<void>((resolve) => child.on("exit", () => resolve()));
	}, 120_000);
});

describe("catalog:wave soft-cap path", () => {
	it("stops launching the third batch but leaves active batches running", async () => {
		const temp = await mkdtemp(join(tmpdir(), "catalog-wave-soft-"));
		tempDirs.push(temp);
		const waveId = `wave-soft-${process.pid}`;
		const batches = ["a", "b", "c"].map(
			(suffix) => `acme/soft-${suffix}-${process.pid}`,
		);
		const bin = join(temp, "bin");
		await mkdir(bin, { recursive: true });
		await writeFile(
			join(bin, "opencode"),
			[
				"#!/bin/sh",
				"trap 'exit 0' TERM",
				'echo \'{"type":"step_finish","sessionID":"ses_soft","part":{"id":"f1","type":"step-finish","tokens":{"total":700000,"input":620000,"output":50000,"reasoning":30000,"cache":{"read":0,"write":0}},"cost":0.01}}\'',
				"sleep 10",
			].join("\n"),
		);
		await chmod(join(bin, "opencode"), 0o755);
		const worktreesForSoft = ["a", "b", "c"].map((suffix) =>
			addWorktree(temp, `soft-${suffix}`),
		);
		const planPath = join(temp, "wave.json");
		await writeFile(
			planPath,
			JSON.stringify({
				id: waveId,
				maxParallel: 2,
				batches: batches.map((batch, index) => ({
					batch,
					kind: "pedals",
					brand: "Acme",
					total: 1,
					worktree: worktreesForSoft[index]?.path as string,
					branch: worktreesForSoft[index]?.branch as string,
					prompt: "fake",
				})),
			}),
		);
		const child = spawn(
			process.execPath,
			[
				"--experimental-strip-types",
				join(repoRoot, "tools/catalog-wave/index.ts"),
				"run",
				"--plan",
				planPath,
				"--foreground",
				"--poll-ms",
				"50",
			],
			{
				cwd: repoRoot,
				env: {
					...process.env,
					PATH: `${bin}:${process.env.PATH ?? ""}`,
					CATALOG_WORK_DIR: join(temp, "work"),
					CATALOG_STOP_GRACE_MS: "100",
					CATALOG_KILL_GRACE_MS: "100",
				},
				stdio: ["ignore", "pipe", "pipe"],
			},
		);
		const statePath = join(temp, "work", "waves", waveId, "state.json");
		try {
			await waitFor(async () => {
				try {
					const state = JSON.parse(await readFile(statePath, "utf8")) as {
						batches: Array<{ batch: string; status: string }>;
					};
					const byId = new Map(
						state.batches.map((batch) => [batch.batch, batch.status]),
					);
					return (
						byId.get(batches[0] as string) === "running" &&
						byId.get(batches[1] as string) === "running" &&
						byId.get(batches[2] as string) === "not-started"
					);
				} catch {
					return false;
				}
			});
		} catch (error) {
			child.kill("SIGKILL");
			throw new Error((error as Error).message);
		}
		await new Promise((resolve) => setTimeout(resolve, 300));
		const state = JSON.parse(await readFile(statePath, "utf8")) as {
			batches: Array<{ batch: string; status: string }>;
			notes: string[];
		};
		const byId = new Map(
			state.batches.map((batch) => [batch.batch, batch.status]),
		);
		expect(byId.get(batches[0] as string)).toBe("running");
		expect(byId.get(batches[1] as string)).toBe("running");
		expect(byId.get(batches[2] as string)).toBe("not-started");
		expect(
			state.notes.filter((note) =>
				note.startsWith("stopped launching queued batches"),
			),
		).toHaveLength(1);
		const controlDir = join(temp, "work", "control");
		const controlFiles = await readdir(controlDir).catch(() => []);
		expect(controlFiles.filter((name) => name.endsWith(".stop"))).toEqual([]);
		child.kill("SIGTERM");
		await new Promise<void>((resolve) => child.on("exit", () => resolve()));
	}, 120_000);
});

describe("catalog:wave missing JSONL", () => {
	it("falls back to the checkpoint ledger when the log has no valid tokens", async () => {
		const temp = await mkdtemp(join(tmpdir(), "catalog-wave-missing-"));
		tempDirs.push(temp);
		const waveId = `wave-missing-${process.pid}`;
		const batch = `acme/missing-${process.pid}`;
		const bin = join(temp, "bin");
		await mkdir(bin, { recursive: true });
		await writeFile(
			join(bin, "opencode"),
			[
				"#!/bin/sh",
				"trap 'exit 0' TERM",
				'echo \'{"type":"step_finish","part":\'',
				`"${process.execPath}" --experimental-strip-types tools/catalog-runner/index.ts checkpoint --batch "$CATALOG_BATCH_ID" --item fake-1 --tokens 5000 >/dev/null 2>&1`,
				"sleep 10",
			].join("\n"),
		);
		await chmod(join(bin, "opencode"), 0o755);
		const worktree = addWorktree(temp, "missing");
		const planPath = join(temp, "wave.json");
		await writeFile(
			planPath,
			JSON.stringify({
				id: waveId,
				maxParallel: 2,
				batches: [
					{
						batch,
						kind: "pedals",
						brand: "Acme",
						total: 1,
						worktree: worktree.path,
						branch: worktree.branch,
						prompt: "fake",
					},
				],
			}),
		);
		const child = spawn(
			process.execPath,
			[
				"--experimental-strip-types",
				join(repoRoot, "tools/catalog-wave/index.ts"),
				"run",
				"--plan",
				planPath,
				"--foreground",
				"--poll-ms",
				"50",
			],
			{
				cwd: repoRoot,
				env: {
					...process.env,
					PATH: `${bin}:${process.env.PATH ?? ""}`,
					CATALOG_WORK_DIR: join(temp, "work"),
					CATALOG_STOP_GRACE_MS: "100",
					CATALOG_KILL_GRACE_MS: "100",
				},
				stdio: ["ignore", "pipe", "pipe"],
			},
		);
		const statePath = join(temp, "work", "waves", waveId, "state.json");
		try {
			await waitFor(async () => {
				try {
					const state = JSON.parse(await readFile(statePath, "utf8")) as {
						batches: Array<{
							runner?: { tokens: number };
							usage?: { source: string; billed: number };
						}>;
					};
					const run = state.batches[0];
					return (
						run?.runner?.tokens === 5000 &&
						run.usage?.source === "ledger" &&
						run.usage.billed === 5000
					);
				} catch {
					return false;
				}
			});
		} catch (error) {
			child.kill("SIGKILL");
			throw new Error((error as Error).message);
		}
		const report = await readFile(
			join(temp, "work", "waves", waveId, "report.md"),
			"utf8",
		);
		expect(report).toContain("| 5k (ledger) | 5k |");
		expect(report).toContain("5k (includes ledger fallback)");
		child.kill("SIGTERM");
		await new Promise<void>((resolve) => child.on("exit", () => resolve()));
	}, 120_000);
});

async function waitFor(check: () => Promise<boolean>): Promise<void> {
	for (let i = 0; i < 100; i++) {
		if (await check()) return;
		await new Promise((resolve) => setTimeout(resolve, 50));
	}
	throw new Error("timed out waiting for wave state");
}
