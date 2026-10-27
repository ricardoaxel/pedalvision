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
				maxParallel: 3,
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
				maxParallel: 2,
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
				maxParallel: 2,
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

describe("catalog:wave 3-wide explicit start", () => {
	it("starts all three batches by default and logs the start", async () => {
		const temp = await mkdtemp(join(tmpdir(), "catalog-wave-3wide-"));
		tempDirs.push(temp);
		const waveId = `wave-3wide-${process.pid}`;
		const batches = ["a", "b", "c"].map(
			(suffix) => `acme/wide-${suffix}-${process.pid}`,
		);
		const bin = join(temp, "bin");
		await mkdir(bin, { recursive: true });
		await writeFile(
			join(bin, "opencode"),
			[
				"#!/bin/sh",
				"trap 'exit 0' TERM",
				'echo \'{"type":"text","sessionID":"ses_wide","part":{"id":"p1","type":"text","text":"wide running"}}\'',
				'echo \'{"type":"step_finish","sessionID":"ses_wide","part":{"id":"f1","type":"step-finish","tokens":{"total":1000,"input":700,"output":200,"reasoning":100,"cache":{"read":0,"write":0}},"cost":0.01}}\'',
				"sleep 10",
			].join("\n"),
		);
		await chmod(join(bin, "opencode"), 0o755);
		const worktreesForWide = ["a", "b", "c"].map((suffix) =>
			addWorktree(temp, `wide-${suffix}`),
		);
		const planPath = join(temp, "wave.json");
		await writeFile(
			planPath,
			JSON.stringify({
				id: waveId,
				batches: batches.map((batch, index) => ({
					batch,
					kind: "pedals",
					brand: "Acme",
					total: 1,
					worktree: worktreesForWide[index]?.path as string,
					branch: worktreesForWide[index]?.branch as string,
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
						batches: Array<{ status: string }>;
					};
					return (
						state.batches.filter((batch) => batch.status === "running")
							.length === 3
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
		expect(state.notes.join("\n")).toContain(
			"3-wide start: starting 3 batches",
		);
		expect(state.batches.every((batch) => batch.status === "running")).toBe(
			true,
		);
		expect(state.batches.every((batch) => batches.includes(batch.batch))).toBe(
			true,
		);
		child.kill("SIGTERM");
		await new Promise<void>((resolve) => child.on("exit", () => resolve()));
	}, 120_000);
});

describe("catalog:wave freed-slot regression", () => {
	it("never starts the queued third batch when a slot frees", async () => {
		const temp = await mkdtemp(join(tmpdir(), "catalog-wave-freeslot-"));
		tempDirs.push(temp);
		const waveId = `wave-freeslot-${process.pid}`;
		const batches = ["a", "b", "c"].map(
			(suffix) => `acme/free-${suffix}-${process.pid}`,
		);
		const bin = join(temp, "bin");
		await mkdir(bin, { recursive: true });
		await writeFile(
			join(bin, "opencode"),
			[
				"#!/bin/sh",
				"trap 'exit 0' TERM",
				'case "$CATALOG_BATCH_ID" in',
				"  *-a-*)",
				'    echo \'{"type":"text","sessionID":"ses_free","part":{"id":"p1","type":"text","text":"first batch done"}}\'',
				'    echo \'{"type":"step_finish","sessionID":"ses_free","part":{"id":"f1","type":"step-finish","tokens":{"total":1000,"input":700,"output":200,"reasoning":100,"cache":{"read":0,"write":0}},"cost":0.01}}\'',
				`    "${process.execPath}" --experimental-strip-types tools/catalog-runner/index.ts checkpoint --batch "$CATALOG_BATCH_ID" --item fake-1 --done 1 --images-accepted 1 --tokens 1000 >/dev/null 2>&1`,
				`    "${process.execPath}" --experimental-strip-types tools/catalog-runner/index.ts finish --batch "$CATALOG_BATCH_ID" >/dev/null 2>&1`,
				"    ;;",
				"  *-b-*)",
				'    echo \'{"type":"text","sessionID":"ses_free","part":{"id":"p1","type":"text","text":"second batch done"}}\'',
				'    echo \'{"type":"step_finish","sessionID":"ses_free","part":{"id":"f1","type":"step-finish","tokens":{"total":1000,"input":700,"output":200,"reasoning":100,"cache":{"read":0,"write":0}},"cost":0.01}}\'',
				"    sleep 2",
				`    "${process.execPath}" --experimental-strip-types tools/catalog-runner/index.ts checkpoint --batch "$CATALOG_BATCH_ID" --item fake-1 --done 1 --images-accepted 1 --tokens 1000 >/dev/null 2>&1`,
				`    "${process.execPath}" --experimental-strip-types tools/catalog-runner/index.ts finish --batch "$CATALOG_BATCH_ID" >/dev/null 2>&1`,
				"    ;;",
				"  *)",
				'    echo \'{"type":"text","sessionID":"ses_free","part":{"id":"p1","type":"text","text":"still running"}}\'',
				'    echo \'{"type":"step_finish","sessionID":"ses_free","part":{"id":"f1","type":"step-finish","tokens":{"total":1000,"input":700,"output":200,"reasoning":100,"cache":{"read":0,"write":0}},"cost":0.01}}\'',
				"    sleep 10",
				"    ;;",
				"esac",
			].join("\n"),
		);
		await chmod(join(bin, "opencode"), 0o755);
		const worktreesForFree = ["a", "b", "c"].map((suffix) =>
			addWorktree(temp, `free-${suffix}`),
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
					worktree: worktreesForFree[index]?.path as string,
					branch: worktreesForFree[index]?.branch as string,
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
						byId.get(batches[0] as string) === "complete" &&
						byId.get(batches[1] as string) === "running" &&
						byId.get(batches[2] as string) === "queued"
					);
				} catch {
					return false;
				}
			});
		} catch (error) {
			child.kill("SIGKILL");
			throw new Error((error as Error).message);
		}
		await new Promise((resolve) => setTimeout(resolve, 400));
		const state = JSON.parse(await readFile(statePath, "utf8")) as {
			batches: Array<{ batch: string; status: string }>;
			notes: string[];
		};
		const byId = new Map(
			state.batches.map((batch) => [batch.batch, batch.status]),
		);
		expect(byId.get(batches[2] as string)).toBe("queued");
		expect(state.notes.join("\n")).toContain("third batch queued");
		expect(state.notes.join("\n")).not.toContain(`started ${batches[2]}`);

		await waitFor(async () => {
			try {
				const ended = JSON.parse(await readFile(statePath, "utf8")) as {
					status: string;
					batches: Array<{ batch: string; status: string }>;
				};
				const endedById = new Map(
					ended.batches.map((batch) => [batch.batch, batch.status]),
				);
				return (
					ended.status === "stopped" &&
					endedById.get(batches[2] as string) === "not-started"
				);
			} catch {
				return false;
			}
		});
		const ended = JSON.parse(await readFile(statePath, "utf8")) as {
			notes: string[];
			batches: Array<{ batch: string; status: string }>;
		};
		expect(ended.notes.join("\n")).toContain(
			"no active batch; queued batches need a maxParallel=3 plan (or --resume refill)",
		);
		expect(
			ended.batches.find((batch) => batch.batch === (batches[2] as string))
				?.status,
		).toBe("not-started");
		const exited = await new Promise<boolean>((resolve) => {
			if (child.exitCode !== null) {
				resolve(true);
				return;
			}
			const timer = setTimeout(() => resolve(false), 15_000);
			child.once("exit", () => {
				clearTimeout(timer);
				resolve(true);
			});
		});
		if (!exited) {
			child.kill("SIGKILL");
			throw new Error("wave did not exit after the queued batch");
		}
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
				'echo \'{"type":"step_finish","sessionID":"ses_soft","part":{"id":"f1","type":"step-finish","tokens":{"total":900000,"input":800000,"output":70000,"reasoning":30000,"cache":{"read":0,"write":0}},"cost":0.01}}\'',
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

describe("catalog:wave explicit resume path", () => {
	it("resumes stopped state, adopts a completed sibling, refills a stateless batch and clears the stale .stop", async () => {
		const temp = await mkdtemp(join(tmpdir(), "catalog-wave-resume-"));
		tempDirs.push(temp);
		const waveId = `wave-resume-${process.pid}`;
		const doneBatch = `acme/resume-done-${process.pid}`;
		const stoppedBatch = `acme/resume-${process.pid}`;
		const newBatch = `acme/resume-new-${process.pid}`;
		const doneWorktree = addWorktree(temp, "resume-done");
		const stoppedWorktree = addWorktree(temp, "resume-stopped");
		const newWorktree = addWorktree(temp, "resume-new");
		const work = join(temp, "work");
		const stateDir = join(work, "state");
		const controlDir = join(work, "control");
		await mkdir(stateDir, { recursive: true });
		await mkdir(controlDir, { recursive: true });
		const waveDir = join(work, "waves", waveId);
		await mkdir(waveDir, { recursive: true });
		const idFile = stoppedBatch.replaceAll("/", "__");
		const startedAt = new Date(Date.now() - 60_000).toISOString();
		await writeFile(
			join(waveDir, "state.json"),
			JSON.stringify({
				version: 1,
				id: waveId,
				status: "stopped",
				startedAt,
				planPath: join(temp, "prior-wave.json"),
				batches: [],
				notes: [],
				reportPath: join(waveDir, "report.md"),
			}),
		);
		const base = {
			version: 1,
			kind: "pedals",
			brand: "Acme",
			total: 2,
			done: 2,
			imagesAccepted: 2,
			imagesRejected: 0,
			startedAt,
			updatedAt: startedAt,
			heartbeatAt: startedAt,
			endedAt: startedAt,
			blockers: [],
		};
		await writeFile(
			join(stateDir, `${doneBatch.replaceAll("/", "__")}.json`),
			JSON.stringify({
				...base,
				batchId: doneBatch,
				worktree: doneWorktree.path,
				status: "complete",
				tokens: 500,
			}),
		);
		const stoppedPath = join(stateDir, `${idFile}.json`);
		await writeFile(
			stoppedPath,
			JSON.stringify({
				...base,
				batchId: stoppedBatch,
				worktree: stoppedWorktree.path,
				status: "stopped",
				tokens: 1234,
				stopRequested: true,
			}),
		);
		await writeFile(join(controlDir, `${idFile}.stop`), "stale stop\n");

		const bin = join(temp, "bin");
		await mkdir(bin, { recursive: true });
		await writeFile(
			join(bin, "opencode"),
			[
				"#!/bin/sh",
				"trap 'exit 0' TERM",
				'echo \'{"type":"text","sessionID":"ses_resume","part":{"id":"p1","type":"text","text":"resumed running"}}\'',
				'echo \'{"type":"step_finish","sessionID":"ses_resume","part":{"id":"f1","type":"step-finish","tokens":{"total":1000,"input":700,"output":200,"reasoning":100,"cache":{"read":0,"write":0}},"cost":0.01}}\'',
				"sleep 10",
			].join("\n"),
		);
		await chmod(join(bin, "opencode"), 0o755);
		const planPath = join(temp, "wave.json");
		await writeFile(
			planPath,
			JSON.stringify({
				id: waveId,
				maxParallel: 3,
				batches: [
					{
						batch: doneBatch,
						kind: "pedals",
						brand: "Acme",
						total: 2,
						worktree: doneWorktree.path,
						branch: doneWorktree.branch,
						prompt: "fake",
					},
					{
						batch: stoppedBatch,
						kind: "pedals",
						brand: "Acme",
						total: 2,
						worktree: stoppedWorktree.path,
						branch: stoppedWorktree.branch,
						prompt: "fake",
					},
					{
						batch: newBatch,
						kind: "pedals",
						brand: "Acme",
						total: 1,
						worktree: newWorktree.path,
						branch: newWorktree.branch,
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
				"--resume",
				"--foreground",
				"--poll-ms",
				"50",
			],
			{
				cwd: repoRoot,
				env: {
					...process.env,
					PATH: `${bin}:${process.env.PATH ?? ""}`,
					CATALOG_WORK_DIR: work,
					CATALOG_STOP_GRACE_MS: "100",
					CATALOG_KILL_GRACE_MS: "100",
				},
				stdio: ["ignore", "pipe", "pipe"],
			},
		);
		const waveStatePath = join(work, "waves", waveId, "state.json");
		try {
			await waitFor(async () => {
				try {
					const wave = JSON.parse(await readFile(waveStatePath, "utf8")) as {
						batches: Array<{
							batch: string;
							status: string;
							runner?: { done: number };
						}>;
					};
					const byId = new Map(
						wave.batches.map((batch) => [batch.batch, batch]),
					);
					const done = byId.get(doneBatch);
					const stopped = byId.get(stoppedBatch);
					const fresh = byId.get(newBatch);
					return (
						done?.status === "complete" &&
						stopped?.status === "running" &&
						stopped.runner?.done === 2 &&
						fresh?.status === "running"
					);
				} catch {
					return false;
				}
			});
		} catch (error) {
			child.kill("SIGKILL");
			throw new Error((error as Error).message);
		}
		const resumed = JSON.parse(await readFile(stoppedPath, "utf8")) as {
			status: string;
			done: number;
			tokens: number;
			startedAt: string;
		};
		expect(resumed.status).toBe("running");
		expect(resumed.done).toBe(2);
		expect(resumed.tokens).toBe(1234);
		expect(resumed.startedAt).toBe(startedAt);
		const controlFiles = await readdir(controlDir).catch(() => []);
		expect(controlFiles.filter((name) => name.endsWith(".stop"))).toEqual([]);
		const wave = JSON.parse(await readFile(waveStatePath, "utf8")) as {
			notes: string[];
			batches: Array<{ batch: string; status: string }>;
		};
		expect(wave.notes.join("\n")).toContain(`resumed ${stoppedBatch}`);
		expect(wave.notes.join("\n")).toContain(`adopted completed ${doneBatch}`);
		expect(wave.notes.join("\n")).toContain(`started ${newBatch}`);
		expect(wave.notes.join("\n")).not.toContain("failed to resume");
		child.kill("SIGTERM");
		await new Promise<void>((resolve) => child.on("exit", () => resolve()));
	}, 120_000);
});

describe("catalog:wave default start width", () => {
	it("starts 2 for a 2-batch plan even with maxParallel 3", async () => {
		const temp = await mkdtemp(join(tmpdir(), "catalog-wave-two-"));
		tempDirs.push(temp);
		const waveId = `wave-two-${process.pid}`;
		const batches = ["a", "b"].map(
			(suffix) => `acme/two-${suffix}-${process.pid}`,
		);
		const bin = join(temp, "bin");
		await mkdir(bin, { recursive: true });
		await writeFile(
			join(bin, "opencode"),
			[
				"#!/bin/sh",
				"trap 'exit 0' TERM",
				'echo \'{"type":"text","sessionID":"ses_two","part":{"id":"p1","type":"text","text":"two running"}}\'',
				'echo \'{"type":"step_finish","sessionID":"ses_two","part":{"id":"f1","type":"step-finish","tokens":{"total":1000,"input":700,"output":200,"reasoning":100,"cache":{"read":0,"write":0}},"cost":0.01}}\'',
				"sleep 10",
			].join("\n"),
		);
		await chmod(join(bin, "opencode"), 0o755);
		const worktrees = ["a", "b"].map((suffix) =>
			addWorktree(temp, `two-${suffix}`),
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
					worktree: worktrees[index]?.path as string,
					branch: worktrees[index]?.branch as string,
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
						batches: Array<{ status: string }>;
					};
					return (
						state.batches.filter((batch) => batch.status === "running")
							.length === 2
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
			batches: Array<{ status: string }>;
			notes: string[];
		};
		expect(state.batches).toHaveLength(2);
		expect(state.batches.every((batch) => batch.status === "running")).toBe(
			true,
		);
		expect(state.notes.join("\n")).not.toContain("3-wide start");
		child.kill("SIGTERM");
		await new Promise<void>((resolve) => child.on("exit", () => resolve()));
	}, 120_000);
});

describe("catalog:wave deprecated --allow-third", () => {
	it("is accepted as a no-op that does not widen a maxParallel-2 wave", async () => {
		const temp = await mkdtemp(join(tmpdir(), "catalog-wave-deprecated-"));
		tempDirs.push(temp);
		const batches = ["a", "b", "c"].map(
			(suffix) => `acme/deprecated-${suffix}-${process.pid}`,
		);
		const worktrees = ["a", "b", "c"].map((suffix) =>
			addWorktree(temp, `deprecated-${suffix}`),
		);
		const planPath = join(temp, "wave.json");
		await writeFile(
			planPath,
			JSON.stringify({
				id: `wave-deprecated-${process.pid}`,
				maxParallel: 2,
				batches: batches.map((batch, index) => ({
					batch,
					kind: "pedals",
					brand: "Acme",
					total: 1,
					worktree: worktrees[index]?.path as string,
					branch: worktrees[index]?.branch as string,
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
				"--dry-run",
				"--allow-third",
			],
			{
				cwd: repoRoot,
				encoding: "utf8",
				env: {
					...process.env,
					CATALOG_WORK_DIR: join(temp, "work"),
				},
			},
		);
		expect(result.status, result.stderr).toBe(0);
		expect(result.stdout).toContain("--allow-third is deprecated");
		expect(result.stdout).toContain("starts up to 2/3");
		expect(result.stdout).toContain("nothing started");
	}, 60_000);
});

describe("catalog:wave pre-start budget guard", () => {
	it("starts 3 over the soft budget (owner accepts over-soft)", async () => {
		const temp = await mkdtemp(join(tmpdir(), "catalog-wave-soft-start-"));
		tempDirs.push(temp);
		const waveId = `wave-soft-start-${process.pid}`;
		const setup = await setupPriorResumeWave({
			temp,
			waveId,
			prefix: `softstart-${process.pid}`,
			billedPerBatch: 600_000,
		});
		const child = spawn(
			process.execPath,
			[
				"--experimental-strip-types",
				join(repoRoot, "tools/catalog-wave/index.ts"),
				"run",
				"--plan",
				setup.planPath,
				"--resume",
				"--foreground",
				"--poll-ms",
				"50",
			],
			{
				cwd: repoRoot,
				env: {
					...process.env,
					PATH: `${setup.bin}:${process.env.PATH ?? ""}`,
					CATALOG_WORK_DIR: setup.work,
					CATALOG_STOP_GRACE_MS: "100",
					CATALOG_KILL_GRACE_MS: "100",
				},
				stdio: ["ignore", "pipe", "pipe"],
			},
		);
		try {
			await waitFor(async () => {
				try {
					const state = JSON.parse(await readFile(setup.statePath, "utf8")) as {
						batches: Array<{ status: string }>;
						notes: string[];
					};
					return (
						state.batches.filter((batch) => batch.status === "running")
							.length === 3 &&
						state.notes.some((note) =>
							note.startsWith("wave soft budget already reached"),
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
		const state = JSON.parse(await readFile(setup.statePath, "utf8")) as {
			batches: Array<{ status: string }>;
			notes: string[];
		};
		expect(
			state.batches.filter((batch) => batch.status === "running"),
		).toHaveLength(3);
		expect(state.notes.join("\n")).toContain("starting at the planned width");
		expect(state.notes.join("\n")).not.toContain("starting 1-wide");
		child.kill("SIGTERM");
		await new Promise<void>((resolve) => child.on("exit", () => resolve()));
	}, 120_000);

	it("refuses to start at the hard budget", async () => {
		const temp = await mkdtemp(join(tmpdir(), "catalog-wave-hard-start-"));
		tempDirs.push(temp);
		const waveId = `wave-hard-start-${process.pid}`;
		const setup = await setupPriorResumeWave({
			temp,
			waveId,
			prefix: `hardstart-${process.pid}`,
			billedPerBatch: 900_000,
		});
		const result = spawnSync(
			process.execPath,
			[
				"--experimental-strip-types",
				join(repoRoot, "tools/catalog-wave/index.ts"),
				"run",
				"--plan",
				setup.planPath,
				"--resume",
				"--foreground",
				"--poll-ms",
				"50",
			],
			{
				cwd: repoRoot,
				encoding: "utf8",
				env: {
					...process.env,
					PATH: `${setup.bin}:${process.env.PATH ?? ""}`,
					CATALOG_WORK_DIR: setup.work,
				},
				timeout: 30_000,
			},
		);
		expect(result.status, result.stderr).toBe(0);
		const state = JSON.parse(await readFile(setup.statePath, "utf8")) as {
			status: string;
			batches: Array<{ status: string }>;
			notes: string[];
		};
		expect(state.status).toBe("stopped");
		expect(state.batches.every((batch) => batch.status === "not-started")).toBe(
			true,
		);
		expect(state.notes.join("\n")).toContain(
			"wave hard budget already reached",
		);
		expect(state.notes.join("\n")).toContain("refusing to start");
	}, 60_000);
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

async function setupPriorResumeWave(options: {
	temp: string;
	waveId: string;
	prefix: string;
	billedPerBatch: number;
}): Promise<{
	planPath: string;
	work: string;
	statePath: string;
	bin: string;
}> {
	const { temp, waveId, prefix, billedPerBatch } = options;
	const work = join(temp, "work");
	const stateDir = join(work, "state");
	const controlDir = join(work, "control");
	const waveDir = join(work, "waves", waveId);
	await mkdir(stateDir, { recursive: true });
	await mkdir(controlDir, { recursive: true });
	await mkdir(waveDir, { recursive: true });
	const batches = ["a", "b", "c"].map((suffix) => `acme/${prefix}-${suffix}`);
	const worktrees = ["a", "b", "c"].map((suffix) =>
		addWorktree(temp, `${prefix}-${suffix}`),
	);
	const startedAt = new Date(Date.now() - 60_000).toISOString();
	await writeFile(
		join(waveDir, "state.json"),
		JSON.stringify({
			version: 1,
			id: waveId,
			status: "stopped",
			startedAt,
			planPath: join(temp, "prior-wave.json"),
			batches: [],
			notes: [],
			reportPath: join(waveDir, "report.md"),
		}),
	);
	const input = Math.max(0, billedPerBatch - 1000);
	for (const [index, batch] of batches.entries()) {
		await writeFile(
			join(stateDir, `${batch.replaceAll("/", "__")}.json`),
			JSON.stringify({
				version: 1,
				batchId: batch,
				kind: "pedals",
				brand: "Acme",
				worktree: worktrees[index]?.path as string,
				status: "stopped",
				total: 1,
				done: 1,
				imagesAccepted: 1,
				imagesRejected: 0,
				tokens: 0,
				startedAt,
				updatedAt: startedAt,
				heartbeatAt: startedAt,
				endedAt: startedAt,
				blockers: [],
				stopRequested: true,
			}),
		);
		await writeFile(
			join(waveDir, `${batch.replaceAll("/", "__")}.jsonl`),
			`${JSON.stringify({
				type: "step_finish",
				sessionID: "ses_prior",
				part: {
					id: `f${index}`,
					type: "step-finish",
					tokens: {
						total: billedPerBatch,
						input,
						output: 700,
						reasoning: 300,
						cache: { read: 0, write: 0 },
					},
					cost: 0.01,
				},
			})}\n`,
		);
	}
	const bin = join(temp, "bin");
	await mkdir(bin, { recursive: true });
	await writeFile(
		join(bin, "opencode"),
		[
			"#!/bin/sh",
			"trap 'exit 0' TERM",
			'echo \'{"type":"text","sessionID":"ses_prior","part":{"id":"p1","type":"text","text":"prior resume running"}}\'',
			'echo \'{"type":"step_finish","sessionID":"ses_prior","part":{"id":"f1","type":"step-finish","tokens":{"total":1000,"input":700,"output":200,"reasoning":100,"cache":{"read":0,"write":0}},"cost":0.01}}\'',
			"sleep 10",
		].join("\n"),
	);
	await chmod(join(bin, "opencode"), 0o755);
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
				worktree: worktrees[index]?.path as string,
				branch: worktrees[index]?.branch as string,
				prompt: "fake",
			})),
		}),
	);
	return { planPath, work, statePath: join(waveDir, "state.json"), bin };
}

async function waitFor(check: () => Promise<boolean>): Promise<void> {
	for (let i = 0; i < 100; i++) {
		if (await check()) return;
		await new Promise((resolve) => setTimeout(resolve, 50));
	}
	throw new Error("timed out waiting for wave state");
}
