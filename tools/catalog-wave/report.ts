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
		"| Batch | Status | Items | Images | Tokens (checkpoint) | Main-session tokens (floor) | Minutes | PR | CI |",
	);
	lines.push("| --- | --- | --- | --- | --- | --- | --- | --- | --- |");
	let done = 0;
	let total = 0;
	let accepted = 0;
	let rejected = 0;
	let tokens = 0;
	let mainTokens = 0;
	for (const batch of state.batches) {
		done += batch.runner?.done ?? 0;
		total += batch.runner?.total ?? batch.total;
		accepted += batch.runner?.imagesAccepted ?? 0;
		rejected += batch.runner?.imagesRejected ?? 0;
		tokens += batch.runner?.tokens ?? 0;
		mainTokens += batch.session?.tokens ?? 0;
		lines.push(formatBatchRow(batch));
	}
	lines.push(
		`| **Total** | **${state.status}** | **${done}/${total}** | **${accepted}/${rejected}** | **${formatTokens(tokens)}** | **${formatTokens(mainTokens)} (floor, known only)** | | | |`,
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
	const tokens = formatTokens(batch.runner?.tokens ?? 0);
	const main =
		batch.session?.tokens === null || batch.session?.tokens === undefined
			? "unknown"
			: formatTokens(batch.session.tokens);
	const minutes = formatMinutes(batch);
	const pr = batch.pr ? `[#${batch.pr.number}](${batch.pr.url})` : "—";
	const ci = batch.pr?.checks ?? "—";
	const status = batch.error
		? `${batch.status} (${batch.error})`
		: batch.status;
	return `| ${batch.batch} | ${status} | ${items} | ${images} | ${tokens} | ${main} (floor) | ${minutes} | ${pr} | ${ci} |`;
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
