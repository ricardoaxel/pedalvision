import { type BatchTokens, resolveBatchTokens } from "./gate.ts";
import type { WaveBatchRun, WaveState } from "./wave-state.ts";

/**
 * Wave report: one line per batch + totals (the coordinator reads this once per
 * checkpoint instead of re-reading raw logs). The full session text stays in the
 * JSONL/state; the report keeps a short tail for the human summary.
 */
export function formatWaveReport(state: WaveState): string {
	const lines: string[] = [];
	lines.push(`# Wave ${state.id}`);
	lines.push("");
	lines.push(
		`Status **${state.status}** · started ${state.startedAt}${
			state.endedAt ? ` · ended ${state.endedAt}` : ""
		} · plan \`${state.planPath}\``,
	);
	lines.push("");
	lines.push(
		"| Batch | Status | Items | Images | Billed non-cache | Cache-incl. floor | Minutes | PR | CI |",
	);
	lines.push("| --- | --- | --- | --- | --- | --- | --- | --- | --- |");
	let done = 0;
	let total = 0;
	let accepted = 0;
	let rejected = 0;
	let billed = 0;
	let cache = 0;
	const sources = new Set<BatchTokens["source"]>();
	for (const batch of state.batches) {
		done += batch.runner?.done ?? 0;
		total += batch.runner?.total ?? batch.total;
		accepted += batch.runner?.imagesAccepted ?? 0;
		rejected += batch.runner?.imagesRejected ?? 0;
		const usage = usageFor(batch);
		billed += usage.billed;
		cache += usage.cacheInclusive;
		if (hasTokenData(batch)) sources.add(usage.source);
		lines.push(formatBatchRow(batch));
	}
	const billedTotal = `${formatTokens(billed)}${
		sources.has("ledger")
			? " (includes ledger fallback)"
			: sources.has("upper-bound")
				? " (includes upper bound)"
				: ""
	}`;
	const cacheTotal = `${formatTokens(cache)} (floor)`;
	lines.push(
		`| **Total** | **${state.status}** | **${done}/${total}** | **${accepted}/${rejected}** | **${billedTotal}** | **${cacheTotal}** | | | |`,
	);
	lines.push("");
	if (state.notes.length > 0) {
		lines.push("Notes:");
		for (const note of state.notes) lines.push(`- ${note}`);
		lines.push("");
	}
	lines.push("## Session report backs");
	lines.push("");
	for (const batch of state.batches) {
		const text = batch.session?.texts.at(-1)?.replace(/\s+/g, " ").trim();
		if (!text) continue;
		lines.push(`- **${batch.batch}:** ${text.slice(0, 600)}`);
	}
	if (state.batches.every((batch) => !batch.session?.texts.length)) {
		lines.push("- No session text captured (see the batch JSONL log).");
	}
	lines.push("");
	return `${lines.join("\n")}\n`;
}

function formatBatchRow(batch: WaveBatchRun): string {
	const items =
		batch.runner?.done !== undefined
			? `${batch.runner.done}/${batch.runner.total}`
			: `0/${batch.total}`;
	const images =
		batch.runner?.imagesAccepted !== undefined
			? `${batch.runner.imagesAccepted}/${batch.runner.imagesRejected}`
			: "0/0";
	const usage = usageFor(batch);
	const known = hasTokenData(batch);
	const minutes = formatMinutes(batch);
	const pr = batch.pr ? `[#${batch.pr.number}](${batch.pr.url})` : "—";
	const ci = batch.pr?.checks ?? "—";
	const status = batch.error
		? `${batch.status} (${batch.error})`
		: batch.status;
	const sourceSuffix =
		usage.source === "ledger"
			? " (ledger)"
			: usage.source === "upper-bound"
				? " (upper bound)"
				: "";
	const billedLabel = known
		? `${formatTokens(usage.billed)}${sourceSuffix}`
		: "unknown";
	const cacheLabel = known ? formatTokens(usage.cacheInclusive) : "unknown";
	return `| ${batch.batch} | ${status} | ${items} | ${images} | ${billedLabel} | ${cacheLabel} | ${minutes} | ${pr} | ${ci} |`;
}

function usageFor(batch: WaveBatchRun): BatchTokens {
	return (
		batch.usage ?? resolveBatchTokens(batch.runner?.tokens ?? 0, batch.session)
	);
}

/** No session and no checkpoint tokens means there is nothing real to report. */
function hasTokenData(batch: WaveBatchRun): boolean {
	if (batch.session) return true;
	return (batch.runner?.tokens ?? 0) > 0;
}

function formatTokens(value: number): string {
	if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
	if (value >= 1_000) return `${Math.round(value / 1_000)}k`;
	return String(value);
}

function formatMinutes(batch: WaveBatchRun): string {
	const start = batch.runner?.startedAt ?? batch.startedAt;
	if (!start) return "—";
	const end = batch.runner?.endedAt ?? batch.endedAt;
	const ms = (end ? Date.parse(end) : Date.now()) - Date.parse(start);
	if (!Number.isFinite(ms) || ms < 0) return "—";
	return `${Math.round(ms / 60_000)} min`;
}
