import { describe, expect, it } from "vitest";
import {
	initialStartCount,
	preStartBudget,
	resolveBatchTokens,
	WAVE_SOFT_TOKENS,
	waveBudget,
} from "./gate.ts";

describe("initial start width", () => {
	it("starts 3 by default for a 3-batch / maxParallel 3 plan", () => {
		expect(initialStartCount({ batchCount: 3, maxParallel: 3 })).toBe(3);
	});

	it("honours explicit 1/2-batch plans and maxParallel 2", () => {
		expect(initialStartCount({ batchCount: 2, maxParallel: 3 })).toBe(2);
		expect(initialStartCount({ batchCount: 1, maxParallel: 3 })).toBe(1);
		expect(initialStartCount({ batchCount: 3, maxParallel: 2 })).toBe(2);
		expect(initialStartCount({ batchCount: 2, maxParallel: 2 })).toBe(2);
	});
});

describe("true token resolution + wave budget", () => {
	it("prefers JSONL billed tokens over a low or synthetic-high ledger", () => {
		expect(
			resolveBatchTokens(39_000, {
				billedTokens: 347_434,
				tokens: 10_537_386,
			}),
		).toEqual({
			billed: 347_434,
			cacheInclusive: 10_537_386,
			source: "jsonl",
		});
		expect(
			resolveBatchTokens(4_212_000, {
				billedTokens: 455_267,
				tokens: 23_982_051,
			}),
		).toEqual({
			billed: 455_267,
			cacheInclusive: 23_982_051,
			source: "jsonl",
		});
	});

	it("uses the JSONL total as an upper bound, ledger only with no JSONL", () => {
		expect(
			resolveBatchTokens(12_500, { billedTokens: null, tokens: 20_000 }),
		).toEqual({
			billed: 20_000,
			cacheInclusive: 20_000,
			source: "upper-bound",
		});
		expect(
			resolveBatchTokens(12_500, { billedTokens: null, tokens: null }),
		).toEqual({
			billed: 12_500,
			cacheInclusive: 12_500,
			source: "ledger",
		});
		expect(resolveBatchTokens(0, undefined)).toEqual({
			billed: 0,
			cacheInclusive: 0,
			source: "ledger",
		});
	});

	it("flags the wave soft/hard budgets", () => {
		expect(WAVE_SOFT_TOKENS).toBe(1_600_000);
		expect(waveBudget(1_599_999)).toEqual({
			tokens: 1_599_999,
			softExceeded: false,
			hardExceeded: false,
		});
		expect(waveBudget(1_600_000).softExceeded).toBe(true);
		expect(waveBudget(2_400_000).hardExceeded).toBe(true);
	});

	it("logs over-soft without shrinking, and refuses at hard", () => {
		expect(preStartBudget(3, waveBudget(0))).toEqual({ width: 3 });
		expect(preStartBudget(3, waveBudget(1_600_000))).toEqual({
			width: 3,
			note: "wave soft budget already reached (1600000 billed tokens); starting at the planned width (owner accepts over-soft)",
		});
		expect(preStartBudget(2, waveBudget(1_700_000))).toEqual({
			width: 2,
			note: "wave soft budget already reached (1700000 billed tokens); starting at the planned width (owner accepts over-soft)",
		});
		expect(preStartBudget(3, waveBudget(2_400_000))).toEqual({
			width: 0,
			stopReason:
				"wave hard budget already reached (2400000 billed tokens); refusing to start",
		});
	});
});
