import { formatCounts, scanAssetCounts } from "../catalog-pipeline/caps.ts";
import { assetsRoot } from "../catalog-pipeline/paths.ts";
import { isGlobalStop } from "./control.ts";
import { elapsedMs, isStale, listStates, staleMs } from "./state.ts";

/** Human-readable control-plane status (P5-02). */

function duration(ms: number): string {
	const minutes = Math.round(ms / 60_000);
	if (minutes < 60) return `${minutes}m`;
	const hours = Math.floor(minutes / 60);
	return `${hours}h${String(minutes % 60).padStart(2, "0")}m`;
}

export async function renderStatus(
	root: string,
	now = Date.now(),
): Promise<string> {
	const states = await listStates(root);
	const counts = await scanAssetCounts(assetsRoot(root));
	const globalStop = await isGlobalStop(root);
	const lines = [
		`catalog status${globalStop ? " — GLOBAL STOP ACTIVE" : ""}`,
		`caps: ${formatCounts(counts)}`,
	];
	if (states.length === 0) {
		lines.push("no batches registered");
		return lines.join("\n");
	}
	lines.push(
		"batch                          kind    brand              status      progress   images  elapsed  heartbeat  blockers",
	);
	for (const state of states.sort((a, b) =>
		a.batchId.localeCompare(b.batchId),
	)) {
		const percent =
			state.total > 0 ? Math.round((state.done / state.total) * 100) : 0;
		const heartbeat = isStale(state, now)
			? `STALE >${Math.round(staleMs() / 60_000)}m`
			: `${Math.round((now - Date.parse(state.heartbeatAt)) / 60_000)}m ago`;
		const images = `${state.imagesAccepted}/${state.imagesRejected}`;
		const requested =
			state.stopRequested || state.pauseRequested
				? ` [${state.stopRequested ? "stop" : "pause"} requested]`
				: "";
		lines.push(
			[
				state.batchId.padEnd(30),
				state.kind.padEnd(7),
				state.brand.padEnd(18),
				`${state.status}${requested}`.padEnd(11),
				`${String(percent).padStart(3)}% ${String(state.done).padStart(3)}/${String(state.total).padEnd(3)}`,
				images.padStart(7),
				duration(elapsedMs(state, now)).padStart(8),
				heartbeat.padEnd(10),
				String(state.blockers.length),
			].join("  "),
		);
		if (state.blockers.length > 0) {
			lines.push(`  blockers: ${state.blockers.join(" | ")}`);
		}
	}
	return lines.join("\n");
}

export async function watchStatus(
	root: string,
	intervalMs = 2_000,
): Promise<void> {
	const limit = Number(process.env.CATALOG_STATUS_WATCH_LIMIT ?? 0);
	let iterations = 0;
	const tick = async (): Promise<void> => {
		process.stdout.write("\x1b[2J\x1b[H");
		process.stdout.write(`${await renderStatus(root)}\n`);
		iterations++;
		if (limit > 0 && iterations >= limit) {
			process.exit(0);
		}
	};
	await tick();
	await new Promise<void>((resolve) => {
		const timer = setInterval(() => void tick(), intervalMs);
		const stop = (): void => {
			clearInterval(timer);
			resolve();
		};
		process.once("SIGINT", stop);
		process.once("SIGTERM", stop);
	});
}
