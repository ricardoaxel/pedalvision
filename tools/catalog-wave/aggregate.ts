/**
 * Tolerant `opencode run --format json` aggregator. The CLI is an external
 * contract: unknown event types, non-JSON supervisor lines and schema drift are
 * ignored rather than fatal, but a run with no `step_finish` is explicitly
 * marked `partial` so a broken parse never looks like a successful batch.
 *
 * Token totals cover the root session only; subagent sessions (image/code
 * reviewers) are not in this stream, so the value is a **floor**.
 */

export type AggregateParse = "complete" | "partial" | "failed";

export type JsonlSummary = {
	sessionId?: string;
	/**
	 * Cache-inclusive root-session token total (input + output + reasoning +
	 * cache read/write); null when no step_finish carried tokens. This is the
	 * JSONL floor, not the billing metric.
	 */
	tokens: number | null;
	/**
	 * Billed non-cache root-session tokens (input + output + reasoning); null
	 * when no step_finish carried those fields. This is the metric used by the
	 * per-batch and wave budgets.
	 */
	billedTokens: number | null;
	/** Root-session cost floor (USD); null when unavailable. */
	costUsd: number | null;
	/** Assistant text parts, in order, deduped by part id. */
	texts: string[];
	parse: AggregateParse;
	errors: string[];
};

const MAX_TEXT_CHARS = 20_000;

export function summarizeJsonl(source: string): JsonlSummary {
	const summary: JsonlSummary = {
		tokens: null,
		billedTokens: null,
		costUsd: null,
		texts: [],
		parse: "partial",
		errors: [],
	};
	const seenParts = new Set<string>();
	let sawStepFinish = false;

	for (const rawLine of source.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line.startsWith("{")) continue;
		let event: unknown;
		try {
			event = JSON.parse(line);
		} catch {
			continue;
		}
		if (typeof event !== "object" || event === null) continue;
		const record = event as Record<string, unknown>;
		if (typeof record.sessionID === "string" && !summary.sessionId) {
			summary.sessionId = record.sessionID;
		}
		const type = record.type;
		const part =
			typeof record.part === "object" && record.part !== null
				? (record.part as Record<string, unknown>)
				: undefined;

		if (type === "error") {
			const message = errorMessage(part ?? record);
			summary.errors.push(message);
			continue;
		}
		if (part?.type === "error") {
			summary.errors.push(errorMessage(part));
			continue;
		}
		if (type === "text" && typeof part?.text === "string") {
			const id = typeof part.id === "string" ? part.id : undefined;
			if (id && seenParts.has(id)) continue;
			if (id) seenParts.add(id);
			summary.texts.push(part.text.slice(0, MAX_TEXT_CHARS));
			continue;
		}
		if (type === "step_finish") {
			sawStepFinish = true;
			const tokens = part?.tokens as Record<string, unknown> | undefined;
			const total = tokens?.total;
			if (typeof total === "number") {
				summary.tokens = (summary.tokens ?? 0) + total;
			} else {
				const derived = cacheInclusive(tokens);
				if (derived !== null) {
					summary.tokens = (summary.tokens ?? 0) + derived;
				}
			}
			const billed = billedNonCache(tokens);
			if (billed !== null) {
				summary.billedTokens = (summary.billedTokens ?? 0) + billed;
			}
			const cost = part?.cost;
			if (typeof cost === "number") {
				summary.costUsd = (summary.costUsd ?? 0) + cost;
			}
		}
	}

	if (summary.errors.length > 0) {
		summary.parse = "failed";
	} else if (sawStepFinish) {
		summary.parse = "complete";
	} else {
		summary.parse = "partial";
		summary.errors.push("no step_finish event (format drift or early exit)");
	}
	return summary;
}

/** Billed tokens: input + output + reasoning, excluding cache read/write. */
function billedNonCache(
	tokens: Record<string, unknown> | undefined,
): number | null {
	const values = [tokens?.input, tokens?.output, tokens?.reasoning].filter(
		(value): value is number => typeof value === "number",
	);
	if (values.length === 0) return null;
	return values.reduce((sum, value) => sum + value, 0);
}

/** Fallback for a step without `total`: sum every token field we recognise. */
function cacheInclusive(
	tokens: Record<string, unknown> | undefined,
): number | null {
	if (!tokens) return null;
	const cache = tokens.cache as Record<string, unknown> | undefined;
	const values = [
		tokens.input,
		tokens.output,
		tokens.reasoning,
		cache?.read,
		cache?.write,
	].filter((value): value is number => typeof value === "number");
	if (values.length === 0) return null;
	return values.reduce((sum, value) => sum + value, 0);
}

function errorMessage(value: unknown): string {
	if (typeof value !== "object" || value === null) return "unknown error event";
	const record = value as Record<string, unknown>;
	const nested =
		typeof record.error === "object" && record.error !== null
			? (record.error as Record<string, unknown>)
			: undefined;
	const data =
		nested && typeof nested.data === "object" && nested.data !== null
			? (nested.data as Record<string, unknown>)
			: undefined;
	for (const candidate of [
		data?.message,
		nested?.message,
		record.text,
		record.message,
	]) {
		if (typeof candidate === "string" && candidate.length > 0) {
			return candidate.slice(0, 500);
		}
	}
	return "error event without a message";
}
