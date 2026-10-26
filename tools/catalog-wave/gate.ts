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
