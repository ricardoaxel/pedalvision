import type { BatchState } from "../catalog-runner/state.ts";
import type { JsonlSummary } from "./aggregate.ts";

/**
 * Owner third-slot gate (AGENTS.md, P5-03): start 2-wide, add the third only
 * when the first batch is past midpoint, has used ≤40% of its soft budget and
 * is sustaining ≥2 items/hour. This is the single executable copy of the rule.
 */
export const SOFT_BATCH_TOKENS = 400_000;
export const THIRD_SLOT_SOFT_FRACTION = 0.4;
export const THIRD_SLOT_MIN_ITEMS_PER_HOUR = 2;

export type GateResult = { ok: boolean; reason: string };

/**
 * Per-batch token usage resolved from the session JSONL (authoritative) or the
 * checkpoint ledger (fallback when the JSONL has no step_finish yet).
 */
export type BatchTokens = {
	billed: number;
	cacheInclusive: number;
	/**
	 * `jsonl` = exact billed fields; `upper-bound` = the JSONL total was used
	 * because the step omitted input/output/reasoning (conservative, never
	 * under-counts); `ledger` = no JSONL numbers at all.
	 */
	source: "jsonl" | "upper-bound" | "ledger";
};

/**
 * Resolve the true billing metric. The JSONL is authoritative because the
 * checkpoint `tokens` value is self-reported and has been both low (39k) and
 * synthetic-high (4.21M); the ledger is only a floor when the JSONL is still
 * empty or partial. Wave budget/gate decisions use `billed`.
 */
export function resolveBatchTokens(
	ledgerTokens: number,
	session: Pick<JsonlSummary, "billedTokens" | "tokens"> | undefined,
): BatchTokens {
	const ledger = Math.max(0, ledgerTokens);
	if (session?.billedTokens !== null && session?.billedTokens !== undefined) {
		return {
			billed: session.billedTokens,
			cacheInclusive: Math.max(session.tokens ?? 0, session.billedTokens),
			source: "jsonl",
		};
	}
	if (session?.tokens !== null && session?.tokens !== undefined) {
		// A step_finish with a total but no input/output/reasoning is old or
		// drifted data. Use the cache-inclusive total as a conservative billed
		// upper bound instead of falling back to the untrusted ledger.
		return {
			billed: session.tokens,
			cacheInclusive: session.tokens,
			source: "upper-bound",
		};
	}
	return {
		billed: ledger,
		cacheInclusive: ledger,
		source: "ledger",
	};
}

export function canStartNext(
	states: BatchState[],
	now: Date,
	/** True billed tokens per batch, resolved before the gate is called. */
	billedByBatch: Readonly<Record<string, number>>,
): GateResult {
	const active = states.filter(
		(state) => state.status === "running" || state.status === "paused",
	);
	if (active.length === 0) return { ok: false, reason: "no active batch" };
	if (active.length >= 3) return { ok: false, reason: "already 3 in flight" };

	// The gate is defined on the *first* batch of the wave.
	const first = [...active].sort((a, b) =>
		a.startedAt.localeCompare(b.startedAt),
	)[0] as BatchState;
	const midpoint = Math.ceil(first.total / 2);
	if (first.done < midpoint) {
		return {
			ok: false,
			reason: `first batch ${first.done}/${first.total} (midpoint ${midpoint})`,
		};
	}
	const softLimit = SOFT_BATCH_TOKENS * THIRD_SLOT_SOFT_FRACTION;
	const billed = billedByBatch[first.batchId];
	if (billed === undefined) {
		return {
			ok: false,
			reason: `no true billed tokens for ${first.batchId}`,
		};
	}
	if (billed > softLimit) {
		return {
			ok: false,
			reason: `first batch used ${billed} billed tokens (>${Math.round(softLimit)})`,
		};
	}
	const elapsedHours =
		(now.getTime() - Date.parse(first.startedAt)) / 3_600_000;
	if (
		!(elapsedHours > 0) ||
		first.done / elapsedHours < THIRD_SLOT_MIN_ITEMS_PER_HOUR
	) {
		const rate =
			elapsedHours > 0 ? (first.done / elapsedHours).toFixed(1) : "0";
		return {
			ok: false,
			reason: `first batch rate ${rate}/h (<${THIRD_SLOT_MIN_ITEMS_PER_HOUR}/h)`,
		};
	}
	return { ok: true, reason: "midpoint + budget + rate gates pass" };
}

/**
 * Wave budgets (AGENTS.md): soft ≤1.2M, hard ≤2.4M **billed non-cache** tokens.
 * The cache-inclusive JSONL floor is reported separately and is not gated.
 */
export const WAVE_SOFT_TOKENS = 1_200_000;
export const WAVE_HARD_TOKENS = 2_400_000;

export type WaveBudget = {
	tokens: number;
	softExceeded: boolean;
	hardExceeded: boolean;
};

export function waveBudget(tokens: number): WaveBudget {
	return {
		tokens,
		softExceeded: tokens >= WAVE_SOFT_TOKENS,
		hardExceeded: tokens >= WAVE_HARD_TOKENS,
	};
}

export type StartDecision = {
	action: "start" | "wait" | "stop";
	reason: string;
};

/**
 * Pure launch decision: stop wins over everything (a queued batch must never
 * start after SIGINT/SIGTERM), then the wave budget, then slot availability.
 * The third-slot midpoint/rate gate is applied separately by `canStartNext`.
 */
export function startDecision(input: {
	stopping: boolean;
	active: number;
	queued: number;
	maxParallel: number;
	budget: WaveBudget;
}): StartDecision {
	if (input.stopping && input.queued > 0) {
		return { action: "stop", reason: "wave stop requested" };
	}
	if (input.budget.hardExceeded) {
		return {
			action: "stop",
			reason: `wave hard budget reached (${input.budget.tokens} tokens)`,
		};
	}
	if (input.budget.softExceeded) {
		return {
			action: "stop",
			reason: `wave soft budget reached (${input.budget.tokens} tokens)`,
		};
	}
	if (input.queued === 0) return { action: "wait", reason: "no queued batch" };
	if (input.active < 2) return { action: "start", reason: "slot available" };
	if (input.active >= 3) return { action: "wait", reason: "3 in flight" };
	// 2 active: the caller applies canStartNext for the third slot.
	return { action: "wait", reason: "third slot needs the midpoint/rate gate" };
}
