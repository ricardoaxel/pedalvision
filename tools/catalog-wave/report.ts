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
	let billedKnown = 0;
	let cache = 0;
	let cacheKnown = 0;
	for (const batch of state.batches) {
		done += batch.runner?.done ?? 0;
		total += batch.runner?.total ?? batch.total;
		accepted += batch.runner?.imagesAccepted ?? 0;
		rejected += batch.runner?.imagesRejected ?? 0;
		const batchBilled = billedTokens(batch);
		if (batchBilled !== null) {
			billed += batchBilled;
			billedKnown++;
		}
		const batchCache = cacheInclusiveTokens(batch);
		if (batchCache !== null) {
			cache += batchCache;
			cacheKnown++;
		}
		lines.push(formatBatchRow(batch));
	}
	const billedTotal =
		billedKnown === state.batches.length
			? formatTokens(billed)
			: `${billedKnown > 0 ? formatTokens(billed) : "unknown"} (known only)`;
	const cacheTotal = `${
		cacheKnown > 0 ? formatTokens(cache) : "unknown"
	} (floor${cacheKnown === state.batches.length ? "" : ", known only"})`;
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
	const billed = billedTokens(batch);
	const cache = cacheInclusiveTokens(batch);
	const minutes = formatMinutes(batch);
	const pr = batch.pr ? `[#${batch.pr.number}](${batch.pr.url})` : "—";
	const ci = batch.pr?.checks ?? "—";
	const status = batch.error
		? `${batch.status} (${batch.error})`
		: batch.status;
	const billedSource =
		batch.usage?.source ?? (batch.session ? "jsonl" : "ledger");
	const billedLabel =
		billed === null
			? "unknown"
			: `${formatTokens(billed)}${billedSource === "ledger" ? " (ledger)" : ""}`;
	const cacheLabel = cache === null ? "unknown" : formatTokens(cache);
	return `| ${batch.batch} | ${status} | ${items} | ${images} | ${billedLabel} | ${cacheLabel} | ${minutes} | ${pr} | ${ci} |`;
}

function billedTokens(batch: WaveBatchRun): number | null {
	if (batch.usage) return batch.usage.billed;
	const session = batch.session;
	if (session?.billedTokens !== null && session?.billedTokens !== undefined) {
		return session.billedTokens;
	}
	// A cache-inclusive total is not a billed value; never conflate them. Only a
	// ledger fallback (no session at all) may populate the billed column.
	if (session) return null;
	return batch.runner?.tokens ?? null;
}

function cacheInclusiveTokens(batch: WaveBatchRun): number | null {
	if (batch.usage) return batch.usage.cacheInclusive;
	return batch.session?.tokens ?? null;
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
