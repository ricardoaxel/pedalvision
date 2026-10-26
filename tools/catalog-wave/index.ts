import { spawn } from "node:child_process";
import { closeSync, mkdirSync, openSync } from "node:fs";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { requestBatchStop } from "../catalog-runner/control.ts";
import { workRoot } from "../catalog-runner/paths.ts";
import { repoRoot } from "../catalog-runner/repo.ts";
import { type BatchState, tryReadState } from "../catalog-runner/state.ts";
import { summarizeJsonl } from "./aggregate.ts";
import {
	canStartNext,
	estimateBatchTokens,
	startDecision,
	waveBudget,
} from "./gate.ts";
import { batchLogPath, launchBatch } from "./launch.ts";
import {
	type ResolvedBatch,
	readWavePlan,
	validatePlan,
	type WavePlan,
} from "./plan.ts";
import { resolvePr } from "./pr.ts";
import { formatWaveReport } from "./report.ts";
import {
	readWaveState,
	type WaveBatchRun,
	type WaveState,
	waveDirPath,
	waveReportPath,
	writeWaveState,
} from "./wave-state.ts";

const USAGE = `catalog-wave — launch and supervise up to 3 independent batch sessions

Usage:
  catalog-wave run --plan <wave.json> [--foreground] [--dry-run] [--poll-ms <n>]
  catalog-wave status --wave <id> [--wait]
  catalog-wave report --wave <id>
  --help

Run is detached by default: it starts the wave runner in the background and
prints the wave id, log and report paths. "status --wait" blocks until the wave
finishes. The runner starts 2 batches, and a third only when the owner gate
passes (midpoint, ≤40% soft budget, ≥2 items/h). It starts each batch through
catalog-runner (state + supervise) and captures the session's JSONL + final
text; the report is written to work/catalog/waves/<id>/report.md.

The plan prompt must NOT call catalog:start: the wrapper already starts the
batch. It must checkpoint after every item and finish with catalog:finish.
`;

type Args = {
	command: string;
	plan?: string;
	wave?: string;
	foreground: boolean;
	dryRun: boolean;
	wait: boolean;
	pollMs: number;
};

function parseArgs(argv: string[]): Args {
	const args: Args = {
		command: argv[0] ?? "",
		foreground: false,
		dryRun: false,
		wait: false,
		pollMs: Number(process.env.CATALOG_WAVE_POLL_MS ?? 5000),
	};
	for (let i = 1; i < argv.length; i++) {
		switch (argv[i]) {
			case "--plan":
				args.plan = argv[++i];
				break;
			case "--wave":
				args.wave = argv[++i];
				break;
			case "--foreground":
				args.foreground = true;
				break;
			case "--dry-run":
				args.dryRun = true;
				break;
			case "--wait":
				args.wait = true;
				break;
			case "--poll-ms": {
				const value = Number(argv[++i]);
				if (!Number.isFinite(value) || value < 50) {
					throw new Error("--poll-ms must be a number >= 50");
				}
				args.pollMs = value;
				break;
			}
			case "--help":
			case "-h":
				args.command = "help";
				break;
			default:
				throw new Error(`unknown argument "${argv[i]}"`);
		}
	}
	return args;
}

function mainRoot(): string {
	return repoRoot(process.cwd());
}

function workRootFor(root: string): string {
	return workRoot(root);
}

async function main(): Promise<void> {
	const args = parseArgs(process.argv.slice(2));
	if (!args.command || args.command === "help") {
		console.log(USAGE);
		return;
	}
	const root = mainRoot();
	const work = workRootFor(root);
	if (args.command === "run") {
		if (!args.plan) throw new Error("run requires --plan <wave.json>");
		const resolved = readWavePlan(args.plan);
		const check = await validatePlan(resolved.batches, root);
		if (!check.ok) {
			throw new Error(`invalid wave plan:\n- ${check.errors.join("\n- ")}`);
		}
		if (args.dryRun) {
			printDryRun(resolved.plan, resolved.batches);
			return;
		}
		if (!args.foreground) {
			await detach(resolved.plan, resolved.planPath);
			return;
		}
		await runWave(
			root,
			work,
			resolved.plan,
			resolved.batches,
			resolved.planPath,
			args.pollMs,
		);
		return;
	}
	if (args.command === "status") {
		if (!args.wave) throw new Error("status requires --wave <id>");
		await printStatus(work, args.wave, args.wait, args.pollMs);
		return;
	}
	if (args.command === "report") {
		if (!args.wave) throw new Error("report requires --wave <id>");
		const path = waveReportPath(work, args.wave);
		try {
			console.log(await readFile(path, "utf8"));
		} catch {
			const state = await readWaveState(work, args.wave);
			if (!state) throw new Error(`unknown wave "${args.wave}"`);
			console.log(formatWaveReport(state));
		}
		return;
	}
	throw new Error(`unknown command "${args.command}"`);
}

function printDryRun(plan: WavePlan, batches: ResolvedBatch[]): void {
	console.log(`wave ${plan.id}: maxParallel=${plan.maxParallel}`);
	for (const batch of batches) {
		console.log(
			`  ${batch.batch}: start state + opencode run --auto --format json --dir ${resolve(
				batch.worktree,
			)} (branch ${batch.branch}, ${batch.total} items)`,
		);
	}
	console.log("dry run: nothing started");
}

async function detach(plan: WavePlan, planPath: string): Promise<void> {
	const work = workRoot(mainRoot());
	await assertNoLiveWave(work, plan.id);
	const dir = waveDirPath(work, plan.id);
	mkdirSync(dir, { recursive: true });
	const logPath = join(dir, "runner.log");
	const logFd = openSync(logPath, "a");
	const self = fileURLToPath(import.meta.url);
	const child = spawn(
		process.execPath,
		[
			"--experimental-strip-types",
			self,
			"run",
			"--plan",
			planPath,
			"--foreground",
		],
		{
			cwd: process.cwd(),
			detached: true,
			stdio: ["ignore", logFd, logFd],
			env: { ...process.env },
		},
	);
	closeSync(logFd);
	child.unref();
	console.log(`wave ${plan.id} started (detached, pid ${child.pid ?? "?"})`);
	console.log(`  log:    ${logPath}`);
	console.log(`  report: ${waveReportPath(work, plan.id)}`);
	console.log(`  status: pnpm catalog:wave status --wave ${plan.id} --wait`);
}

function lockPath(work: string, id: string): string {
	return join(waveDirPath(work, id), ".lock");
}

async function assertNoLiveWave(work: string, id: string): Promise<void> {
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

async function acquireWaveLock(work: string, id: string): Promise<void> {
	await assertNoLiveWave(work, id);
	const path = lockPath(work, id);
	try {
		await writeFile(path, String(process.pid), { flag: "wx" });
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
		const pid = Number(await readFile(path, "utf8").catch(() => ""));
		if (Number.isFinite(pid) && pid > 0 && isAlive(pid)) {
			throw new Error(
				`wave "${id}" lock is held by a live runner (pid ${pid})`,
			);
		}
		await unlink(path).catch(() => undefined);
		await writeFile(path, String(process.pid), { flag: "wx" });
	}
}

async function releaseWaveLock(work: string, id: string): Promise<void> {
	await unlink(lockPath(work, id)).catch(() => undefined);
}

async function runWave(
	root: string,
	work: string,
	plan: WavePlan,
	batches: ResolvedBatch[],
	planPath: string,
	pollMs: number,
): Promise<void> {
	const dir = waveDirPath(work, plan.id);
	await mkdir(dir, { recursive: true });
	await acquireWaveLock(work, plan.id);
	const startedAt = new Date().toISOString();
	const state: WaveState = {
		version: 1,
		id: plan.id,
		status: "running",
		startedAt,
		planPath,
		runnerPid: process.pid,
		batches: batches.map((batch) => ({
			batch: batch.batch,
			branch: batch.branch,
			worktree: resolve(batch.worktree),
			total: batch.total,
			status: "queued",
			log: batchLogPath(dir, batch.batch),
		})),
		notes: [],
		reportPath: waveReportPath(work, plan.id),
	};
	let stopping = false;
	const onSignal = () => {
		stopping = true;
		state.notes.push("stop requested; asking active batches to stop");
		void Promise.all(
			state.batches
				.filter((batch) => batch.status === "running")
				.map((batch) => requestBatchStop(root, batch.batch, "wave stop")),
		);
	};
	process.on("SIGINT", onSignal);
	process.on("SIGTERM", onSignal);

	await writeStateAndReport(work, state);
	const initial = Math.min(2, plan.maxParallel, batches.length);
	for (let i = 0; i < initial; i++) {
		await startOne(root, plan, batches[i] as ResolvedBatch, state);
	}
	await writeStateAndReport(work, state);

	while (true) {
		await refresh(root, work, state, batches, plan, stopping);
		if (
			state.batches.every((batch) =>
				["complete", "stopped", "failed", "not-started"].includes(batch.status),
			)
		) {
			break;
		}
		if (stopping) {
			state.notes.push("waiting for supervised sessions to exit after stop");
		}
		await sleep(pollMs);
	}

	state.status = state.batches.some((batch) => batch.status === "failed")
		? "failed"
		: state.batches.some((batch) => batch.status === "stopped")
			? "stopped"
			: "complete";
	state.endedAt = new Date().toISOString();
	await writeStateAndReport(work, state);
	await releaseWaveLock(work, plan.id);
	console.log(formatWaveReport(state));
}

async function startOne(
	root: string,
	plan: WavePlan,
	batch: ResolvedBatch,
	state: WaveState,
): Promise<void> {
	const run = state.batches.find((entry) => entry.batch === batch.batch);
	if (!run) throw new Error(`unknown batch ${batch.batch}`);
	try {
		const launched = await launchBatch({
			root,
			waveId: plan.id,
			batch,
			prompt: batch.prompt,
			logPath: run.log,
		});
		run.status = "running";
		run.pid = launched.pid;
		run.startedAt = new Date().toISOString();
		state.notes.push(`started ${batch.batch} (pid ${launched.pid})`);
	} catch (error) {
		run.status = "failed";
		run.error = error instanceof Error ? error.message : String(error);
		state.notes.push(`failed to start ${batch.batch}: ${run.error}`);
	}
}

async function refresh(
	root: string,
	work: string,
	state: WaveState,
	batches: ResolvedBatch[],
	plan: WavePlan,
	stopping: boolean,
): Promise<void> {
	for (const run of state.batches) {
		if (run.status !== "running") continue;
		const runnerState = await tryReadState(root, run.batch);
		if (runnerState) run.runner = snapshot(runnerState);
		const alive = run.pid ? isAlive(run.pid) : false;
		const terminal =
			runnerState &&
			["complete", "stopped", "blocked", "cap-reached"].includes(
				runnerState.status,
			);
		if (alive && !terminal) continue;
		await finalizeBatch(root, run);
	}

	const queued = state.batches.filter((batch) => batch.status === "queued");
	const active = state.batches.filter((batch) => batch.status === "running");
	const tokens = await estimateWaveTokens(state);
	const budget = waveBudget(tokens);
	const decision = startDecision({
		stopping,
		active: active.length,
		queued: queued.length,
		maxParallel: plan.maxParallel,
		budget,
	});
	if (decision.action === "stop") {
		for (const batch of queued) {
			batch.status = "not-started";
			batch.error = decision.reason;
		}
		const note = `stopped launching queued batches: ${decision.reason}`;
		if (!state.notes.includes(note)) state.notes.push(note);
	} else if (decision.action === "start" && queued.length > 0) {
		const next = queued[0];
		if (next) {
			const batch = batches.find((entry) => entry.batch === next.batch);
			if (batch) await startOne(root, plan, batch, state);
		}
	} else if (
		decision.action === "wait" &&
		plan.maxParallel === 3 &&
		active.length === 2 &&
		queued.length > 0
	) {
		const activeStates = (
			await Promise.all(active.map((batch) => tryReadState(root, batch.batch)))
		).filter((entry): entry is BatchState => entry !== undefined);
		const gate = canStartNext(activeStates);
		if (gate.ok) {
			const next = queued[0];
			if (next) {
				const batch = batches.find((entry) => entry.batch === next.batch);
				if (batch) {
					state.notes.push(`third slot gate passed: ${gate.reason}`);
					await startOne(root, plan, batch, state);
				}
			}
		} else {
			const note = `third slot waiting: ${gate.reason}`;
			if (!state.notes.includes(note)) state.notes.push(note);
		}
	}
	await writeStateAndReport(work, state);
}

async function finalizeBatch(root: string, run: WaveBatchRun): Promise<void> {
	const source = await readFile(run.log, "utf8").catch(() => "");
	const session = summarizeJsonl(source);
	run.session = session;
	const pr = resolvePr(run.branch, root);
	if (pr) run.pr = pr;
	run.runner = run.runner ?? undefined;
	run.endedAt = new Date().toISOString();
	if (session.parse === "failed") {
		run.status = "failed";
		run.error = session.errors[0] ?? "session error";
		return;
	}
	const status = run.runner?.status;
	if (status === "stopped") {
		run.status = "stopped";
		return;
	}
	if (status === "complete" && session.parse === "complete") {
		run.status = "complete";
		return;
	}
	run.status = "failed";
	run.error =
		session.parse === "partial"
			? "no step_finish event (format drift or early exit)"
			: `session exited without finish (${status ?? "no runner state"})`;
}

async function estimateWaveTokens(state: WaveState): Promise<number> {
	let total = 0;
	for (const batch of state.batches) {
		let floor = batch.session?.tokens ?? null;
		if (floor === null && batch.status === "running") {
			const source = await readFile(batch.log, "utf8").catch(() => "");
			floor = summarizeJsonl(source).tokens;
		}
		total += estimateBatchTokens(batch.runner?.tokens ?? 0, floor);
	}
	return total;
}

function snapshot(state: BatchState): WaveBatchRun["runner"] {
	return {
		done: state.done,
		total: state.total,
		imagesAccepted: state.imagesAccepted,
		imagesRejected: state.imagesRejected,
		tokens: state.tokens,
		status: state.status,
		blockers: [...state.blockers],
		startedAt: state.startedAt,
		endedAt: state.endedAt,
	};
}

async function writeStateAndReport(
	work: string,
	state: WaveState,
): Promise<void> {
	await writeWaveState(work, state);
	await writeFile(waveReportPath(work, state.id), formatWaveReport(state));
}

async function printStatus(
	work: string,
	id: string,
	wait: boolean,
	pollMs: number,
): Promise<void> {
	while (true) {
		const state = await readWaveState(work, id);
		if (!state) throw new Error(`unknown wave "${id}"`);
		const alive = state.runnerPid ? isAlive(state.runnerPid) : false;
		const report = await readFile(waveReportPath(work, id), "utf8").catch(() =>
			formatWaveReport(state),
		);
		console.log(report);
		if (!wait || state.status !== "running") {
			if (state.status === "running" && !alive) {
				console.log(
					"warning: wave runner is not alive; the state was last written by a dead runner",
				);
			}
			return;
		}
		await sleep(pollMs);
	}
}

function isAlive(pid: number): boolean {
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

main().catch((error: unknown) => {
	console.error(`error: ${error instanceof Error ? error.message : error}`);
	process.exitCode = 1;
});
