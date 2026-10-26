import type { BatchState } from "../catalog-runner/state.ts";

/**
 * Owner third-slot gate (AGENTS.md, P5-03): start 2-wide, add the third only
 * when the first batch is past midpoint, has used ≤40% of its soft budget and
 * is sustaining ≥2 items/hour. This is the single executable copy of the rule.
 */
export const SOFT_BATCH_TOKENS = 400_000;
export const THIRD_SLOT_SOFT_FRACTION = 0.4;
export const THIRD_SLOT_MIN_ITEMS_PER_HOUR = 2;

export type GateResult = { ok: boolean; reason: string };

export function canStartNext(
	states: BatchState[],
	now: Date = new Date(),
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
	if (first.tokens > softLimit) {
		return {
			ok: false,
			reason: `first batch used ${first.tokens} tokens (>${Math.round(softLimit)})`,
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

/** Wave budgets (AGENTS.md): soft ≤1.2M, hard ≤2.4M; 2× a batch budget aborts. */
export const WAVE_SOFT_TOKENS = 1_200_000;
export const WAVE_HARD_TOKENS = 2_400_000;

export type WaveBudget = {
	tokens: number;
	softExceeded: boolean;
	hardExceeded: boolean;
};

/** Use the higher of the checkpoint ledger and the parsed JSONL floor. */
export function estimateBatchTokens(
	ledgerTokens: number,
	sessionTokens: number | null | undefined,
): number {
	return Math.max(ledgerTokens, sessionTokens ?? 0);
}

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
