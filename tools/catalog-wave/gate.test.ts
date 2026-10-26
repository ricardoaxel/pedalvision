import { describe, expect, it } from "vitest";
import type { BatchState } from "../catalog-runner/state.ts";
import {
	canStartNext,
	estimateBatchTokens,
	startDecision,
	waveBudget,
} from "./gate.ts";

function state(overrides: Partial<BatchState> = {}): BatchState {
	return {
		version: 1,
		batchId: "boss/boss-2",
		kind: "pedals",
		brand: "BOSS",
		worktree: "/tmp",
		status: "running",
		total: 26,
		done: 13,
		imagesAccepted: 0,
		imagesRejected: 0,
		tokens: 100_000,
		startedAt: new Date(Date.now() - 60 * 60_000).toISOString(),
		updatedAt: new Date().toISOString(),
		heartbeatAt: new Date().toISOString(),
		blockers: [],
		...overrides,
	};
}

const now = new Date();

describe("third-slot gate", () => {
	it("opens after midpoint, ≤40% soft budget and ≥2 items/h", () => {
		expect(canStartNext([state()], now)).toEqual({
			ok: true,
			reason: "midpoint + budget + rate gates pass",
		});
	});

	it("stays closed before midpoint, over budget or under rate", () => {
		expect(canStartNext([state({ done: 12 })], now).ok).toBe(false);
		expect(canStartNext([state({ tokens: 160_001 })], now).ok).toBe(false);
		expect(
			canStartNext(
				[
					state({
						done: 13,
						startedAt: new Date(Date.now() - 8 * 60 * 60_000).toISOString(),
					}),
				],
				now,
			).ok,
		).toBe(false);
	});

	it("requires an active batch and refuses a fourth slot", () => {
		expect(canStartNext([], now).ok).toBe(false);
		expect(
			canStartNext(
				[state(), state({ batchId: "b/2" }), state({ batchId: "b/3" })],
				now,
			).ok,
		).toBe(false);
	});
});

describe("wave budget + start decision", () => {
	it("uses the higher of ledger and JSONL floor", () => {
		expect(estimateBatchTokens(1_000, 5_000)).toBe(5_000);
		expect(estimateBatchTokens(9_000, null)).toBe(9_000);
		expect(estimateBatchTokens(0, undefined)).toBe(0);
	});

	it("flags the wave soft/hard budgets", () => {
		expect(waveBudget(1_199_999)).toEqual({
			tokens: 1_199_999,
			softExceeded: false,
			hardExceeded: false,
		});
		expect(waveBudget(1_200_000).softExceeded).toBe(true);
		expect(waveBudget(2_400_000).hardExceeded).toBe(true);
	});

	it("never starts a queued batch after a stop, and stops on budget", () => {
		const base = {
			active: 1,
			queued: 1,
			maxParallel: 3,
			budget: waveBudget(0),
		};
		expect(startDecision({ ...base, stopping: true }).action).toBe("stop");
		expect(
			startDecision({ ...base, stopping: false, budget: waveBudget(1_200_000) })
				.action,
		).toBe("stop");
		expect(startDecision({ ...base, stopping: false }).action).toBe("start");
		expect(startDecision({ ...base, stopping: false, active: 2 }).action).toBe(
			"wait",
		);
		expect(startDecision({ ...base, stopping: false, queued: 0 }).action).toBe(
			"wait",
		);
	});
});
