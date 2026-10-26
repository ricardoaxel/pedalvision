import { describe, expect, it } from "vitest";
import type { BatchState } from "../catalog-runner/state.ts";
import { canStartNext } from "./gate.ts";

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
