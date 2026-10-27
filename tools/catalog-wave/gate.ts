import type { JsonlSummary } from "./aggregate.ts";

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

/**
 * How many batches a wave starts up front. The third slot is **explicit**:
 * `--allow-third` is required to start 3-wide, and a wave never starts a batch
 * later when a slot frees. Max 3 in flight.
 */
export function initialStartCount(input: {
	batchCount: number;
	maxParallel: number;
	allowThird: boolean;
}): number {
	const width = Math.min(Math.max(1, input.maxParallel), 3);
	if (width >= 3 && !input.allowThird) {
		return Math.min(2, input.batchCount);
	}
	return Math.min(width, input.batchCount);
}

/**
 * Wave budgets (AGENTS.md / T-0b): soft ≤1.6M, hard ≤2.4M **billed non-cache**
 * tokens. The cache-inclusive JSONL floor is reported separately and is not
 * gated.
 */
export const WAVE_SOFT_TOKENS = 1_600_000;
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

/**
 * Pre-start budget guard (resume waves can already be over budget from the
 * previous session): refuse at the hard cap, degrade to 1-wide at the soft cap.
 */
export function preStartBudget(
	baseWidth: number,
	budget: WaveBudget,
): { width: number; stopReason?: string; note?: string } {
	if (budget.hardExceeded) {
		return {
			width: 0,
			stopReason: `wave hard budget already reached (${budget.tokens} billed tokens); refusing to start`,
		};
	}
	if (budget.softExceeded) {
		return {
			width: Math.min(1, baseWidth),
			note: `wave soft budget already reached (${budget.tokens} billed tokens); starting 1-wide`,
		};
	}
	return { width: baseWidth };
}
