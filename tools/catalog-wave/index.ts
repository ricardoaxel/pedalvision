import { spawn } from "node:child_process";
import { closeSync, mkdirSync, openSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { requestBatchStop } from "../catalog-runner/control.ts";
import { workRoot } from "../catalog-runner/paths.ts";
import { repoRoot } from "../catalog-runner/repo.ts";
import { type BatchState, tryReadState } from "../catalog-runner/state.ts";
import { summarizeJsonl } from "./aggregate.ts";
import {
	initialStartCount,
	preStartBudget,
	resolveBatchTokens,
	waveBudget,
} from "./gate.ts";
import { batchLogPath, detachArgs, launchBatch } from "./launch.ts";
import { acquireWaveLock, assertNoLiveWave, releaseWaveLock } from "./lock.ts";
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
  catalog-wave run --plan <wave.json> [--resume]
                   [--foreground] [--dry-run] [--poll-ms <n>]
  catalog-wave status --wave <id> [--wait]
  catalog-wave report --wave <id>
  --help

Run is detached by default: it starts the wave runner in the background and
prints the wave id, log and report paths. "status --wait" blocks until the wave
finishes. Waves start 3-wide by default: min(3, maxParallel, batchCount); an
explicit 1/2-batch plan stays 1/2. --allow-third is deprecated and has no effect.
It never starts a queued batch later when a slot frees. --resume explicitly
resumes the plan's existing stopped/paused batches (clears stale stop/pause
markers) instead of recreating their state. The true billed-token metric still
enforces the wave budgets/stops; soft over-spend is logged, the hard 2.4M cap
refuses. It starts each batch through catalog-runner (state + supervise) and
captures the session's JSONL + final text; the report is written to
work/catalog/waves/<id>/report.md.

The plan prompt must NOT call catalog:start/resume: the wrapper already does it.
It must checkpoint after every item and finish with catalog:finish.
`;

type Args = {
	command: string;
	plan?: string;
	wave?: string;
	foreground: boolean;
	dryRun: boolean;
	wait: boolean;
	allowThird: boolean;
	resume: boolean;
	pollMs: number;
};

function parseArgs(argv: string[]): Args {
	const args: Args = {
		command: argv[0] ?? "",
		foreground: false,
		dryRun: false,
		wait: false,
		allowThird: false,
		resume: false,
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
			case "--allow-third":
				args.allowThird = true;
				break;
			case "--resume":
				args.resume = true;
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
		if (args.allowThird) {
			console.log(
				"note: --allow-third is deprecated and has no effect; waves start up to 3 by default",
			);
		}
		if (args.resume && !(await readWaveState(work, resolved.plan.id))) {
			throw new Error(
				`--resume requires the existing wave state at work/catalog/waves/${resolved.plan.id}/state.json; reuse the original wave id so the prior JSONL continues`,
			);
		}
		const check = await validatePlan(resolved.batches, root, {
			resume: args.resume,
			alive: isAlive,
		});
		if (!check.ok) {
			throw new Error(`invalid wave plan:\n- ${check.errors.join("\n- ")}`);
		}
		if (args.dryRun) {
			printDryRun(resolved.plan, resolved.batches, args.resume);
			return;
		}
		if (!args.foreground) {
			await detach(
				resolved.plan,
				resolved.planPath,
				args.allowThird,
				args.resume,
			);
			return;
		}
		await runWave(
			root,
			work,
			resolved.plan,
			resolved.batches,
			resolved.planPath,
			args.pollMs,
			args.resume,
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

function printDryRun(
	plan: WavePlan,
	batches: ResolvedBatch[],
	resume: boolean,
): void {
	const initial = initialStartCount({
		batchCount: batches.length,
		maxParallel: plan.maxParallel,
	});
	const width = initial === 3 ? " (3-wide start when all are started)" : "";
	console.log(
		`wave ${plan.id}: maxParallel=${plan.maxParallel}${width} · starts up to ${initial}/${batches.length} up front${resume ? " · resume (completed siblings are adopted)" : ""}`,
	);
	for (const [index, batch] of batches.entries()) {
		const action = index < initial ? (resume ? "resume" : "start") : "queue";
		console.log(
			`  ${batch.batch}: ${action} state + opencode run --auto --format json --dir ${resolve(
				batch.worktree,
			)} (branch ${batch.branch}, ${batch.total} items)`,
		);
	}
	if (initial < batches.length) {
		console.log(
			"  queued batches do not start later; use maxParallel=3 (the default wave width) or --resume to refill",
		);
	}
	console.log("dry run: nothing started");
}

async function detach(
	plan: WavePlan,
	planPath: string,
	allowThird: boolean,
	resume: boolean,
): Promise<void> {
	const work = workRoot(mainRoot());
	await assertNoLiveWave(work, plan.id, isAlive);
	const dir = waveDirPath(work, plan.id);
	mkdirSync(dir, { recursive: true });
	const logPath = join(dir, "runner.log");
	const logFd = openSync(logPath, "a");
	const self = fileURLToPath(import.meta.url);
	const child = spawn(
		process.execPath,
		detachArgs(self, planPath, allowThird, resume),
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

async function runWave(
	root: string,
	work: string,
	plan: WavePlan,
	batches: ResolvedBatch[],
	planPath: string,
	pollMs: number,
	resume: boolean,
): Promise<void> {
	const dir = waveDirPath(work, plan.id);
	await mkdir(dir, { recursive: true });
	await acquireWaveLock(work, plan.id, process.pid, isAlive);
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

	if (resume) {
		state.notes.push("resume launch: reusing existing batch state");
		for (const run of state.batches) {
			const existing = await tryReadState(root, run.batch);
			if (!existing) continue;
			if (existing.status === "complete") {
				run.status = "complete";
				run.runner = snapshot(existing);
				run.usage = resolveBatchTokens(
					existing.tokens,
					await summarizeLog(run.log),
				);
				run.startedAt = existing.startedAt;
				run.endedAt = existing.endedAt;
				state.notes.push(`adopted completed ${run.batch}`);
			} else if (existing.status === "cap-reached") {
				run.status = "failed";
				run.error = "cap-reached; not resumable";
				state.notes.push(`skipped cap-reached ${run.batch}`);
			}
		}
	}

	const baseWidth = initialStartCount({
		batchCount: batches.length,
		maxParallel: plan.maxParallel,
	});
	const priorBilled = await priorWaveBilled(root, state);
	const preStart = preStartBudget(baseWidth, waveBudget(priorBilled));
	const initial = preStart.width;
	if (preStart.stopReason) {
		markQueuedNotStarted(state, preStart.stopReason);
		state.status = "stopped";
		state.notes.push(preStart.stopReason);
		state.endedAt = new Date().toISOString();
		await writeStateAndReport(work, state);
		await releaseWaveLock(work, plan.id);
		console.log(formatWaveReport(state));
		return;
	}
	if (preStart.note) state.notes.push(preStart.note);
	const willStart = state.batches
		.filter((batch) => batch.status === "queued")
		.slice(0, initial).length;
	if (willStart === 3) {
		state.notes.push(
			"3-wide start: starting 3 batches (default; owner override 2026-10-27)",
		);
	} else if (baseWidth < batches.length) {
		state.notes.push(
			"third batch queued: plan maxParallel < 3; a queued batch never starts when a slot frees (use --resume to refill)",
		);
	}
	await writeStateAndReport(work, state);
	let started = 0;
	for (const run of state.batches) {
		if (run.status !== "queued") continue;
		if (started >= initial) break;
		const batch = batches.find((entry) => entry.batch === run.batch);
		if (!batch) continue;
		const existing = resume ? await tryReadState(root, run.batch) : undefined;
		await startOne(root, plan, batch, state, Boolean(existing));
		started++;
	}
	await writeStateAndReport(work, state);

	while (true) {
		await refresh(root, work, state, stopping);
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
		: state.batches.some(
					(batch) =>
						batch.status === "stopped" || batch.status === "not-started",
				)
			? "stopped"
			: "complete";
	state.endedAt = new Date().toISOString();
	await writeStateAndReport(work, state);
	await releaseWaveLock(work, plan.id);
	console.log(formatWaveReport(state));
}

/** Resume budget guard input: prior session JSONL + checkpoint ledger per batch. */
async function priorWaveBilled(
	root: string,
	state: WaveState,
): Promise<number> {
	let total = 0;
	for (const run of state.batches) {
		const existing = await tryReadState(root, run.batch);
		total += resolveBatchTokens(
			existing?.tokens ?? 0,
			await summarizeLog(run.log),
		).billed;
	}
	return total;
}

async function startOne(
	root: string,
	plan: WavePlan,
	batch: ResolvedBatch,
	state: WaveState,
	resume: boolean,
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
			resume,
		});
		run.status = "running";
		run.pid = launched.pid;
		run.startedAt ??= new Date().toISOString();
		state.notes.push(
			`${resume ? "resumed" : "started"} ${batch.batch} (pid ${launched.pid})`,
		);
	} catch (error) {
		run.status = "failed";
		run.error = error instanceof Error ? error.message : String(error);
		state.notes.push(
			`failed to ${resume ? "resume" : "start"} ${batch.batch}: ${run.error}`,
		);
	}
}

async function refresh(
	root: string,
	work: string,
	state: WaveState,
	stopping: boolean,
): Promise<void> {
	for (const run of state.batches) {
		if (run.status !== "running") continue;
		const runnerState = await tryReadState(root, run.batch);
		if (runnerState) run.runner = snapshot(runnerState);
		const session = await summarizeLog(run.log);
		run.session = session;
		run.usage = resolveBatchTokens(run.runner?.tokens ?? 0, session);
		const alive = run.pid ? isAlive(run.pid) : false;
		const terminal =
			runnerState &&
			["complete", "stopped", "blocked", "cap-reached"].includes(
				runnerState.status,
			);
		if (alive && !terminal) continue;
		await finalizeBatch(root, run);
	}
	for (const run of state.batches) {
		run.usage ??= resolveBatchTokens(run.runner?.tokens ?? 0, run.session);
	}

	const queued = state.batches.filter((batch) => batch.status === "queued");
	const active = state.batches.filter((batch) => batch.status === "running");
	const inFlight = queued.length > 0 || active.length > 0;
	const tokens = inFlight ? billedWaveTokens(state) : 0;
	const budget = waveBudget(tokens);
	if (stopping && queued.length > 0) {
		markQueuedNotStarted(state, "wave stop requested");
	}
	if (budget.hardExceeded && active.length > 0) {
		const reason = `wave hard budget reached (${tokens} billed tokens); stopping active batches`;
		if (!state.notes.some((note) => note.startsWith("wave hard budget"))) {
			await Promise.all(
				active.map((batch) => requestBatchStop(root, batch.batch, reason)),
			);
			state.notes.push(reason);
		}
	}
	if (budget.hardExceeded) {
		markQueuedNotStarted(
			state,
			`wave hard budget reached (${tokens} billed tokens)`,
		);
	} else if (budget.softExceeded) {
		markQueuedNotStarted(
			state,
			`wave soft budget reached (${tokens} billed tokens)`,
		);
	} else if (active.length === 0 && queued.length > 0) {
		// A freed slot never starts a queued batch; with no active batch left the
		// wave cannot make progress, so record why the queue is left unstarted.
		markQueuedNotStarted(
			state,
			"no active batch; queued batches need a maxParallel=3 plan (or --resume refill)",
		);
	}
	// No batch is ever started here: a freed slot must not auto-start a queued
	// batch. Only the explicit wave start (up to 3 by default) starts batches.
	await writeStateAndReport(work, state);
}

function markQueuedNotStarted(state: WaveState, reason: string): void {
	const queued = state.batches.filter((batch) => batch.status === "queued");
	if (queued.length === 0) return;
	for (const batch of queued) {
		batch.status = "not-started";
		batch.error = reason;
	}
	const note = `stopped launching queued batches: ${reason}`;
	if (
		!state.notes.some((entry) =>
			entry.startsWith("stopped launching queued batches"),
		)
	) {
		state.notes.push(note);
	}
}

async function finalizeBatch(root: string, run: WaveBatchRun): Promise<void> {
	let source = await readFile(run.log, "utf8").catch(() => "");
	let session = summarizeJsonl(source);
	// The supervisor exits as soon as the child does; a final JSON line can race
	// the read. A completed runner state + partial parse is worth one re-read.
	if (session.parse !== "complete" && run.runner?.status === "complete") {
		await sleep(200);
		source = await readFile(run.log, "utf8").catch(() => "");
		session = summarizeJsonl(source);
	}
	run.session = session;
	run.usage = resolveBatchTokens(run.runner?.tokens ?? 0, session);
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

function billedWaveTokens(state: WaveState): number {
	return state.batches.reduce((sum, batch) => sum + batchBilled(batch), 0);
}

function batchBilled(batch: WaveBatchRun): number {
	return (
		batch.usage ?? resolveBatchTokens(batch.runner?.tokens ?? 0, batch.session)
	).billed;
}

async function summarizeLog(path: string) {
	const source = await readFile(path, "utf8").catch(() => "");
	return summarizeJsonl(source);
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
