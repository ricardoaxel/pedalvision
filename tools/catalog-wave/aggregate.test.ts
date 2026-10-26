import { describe, expect, it } from "vitest";
import { summarizeJsonl } from "./aggregate.ts";

const session = "ses_test";
const text = (id: string, value: string) =>
	JSON.stringify({
		type: "text",
		sessionID: session,
		part: { id, type: "text", text: value },
	});
const finish = (total: number, cost = 0.01) =>
	JSON.stringify({
		type: "step_finish",
		sessionID: session,
		part: {
			id: `finish-${total}`,
			type: "step-finish",
			tokens: { total },
			cost,
		},
	});
const finishUsage = (
	id: string,
	tokens: Record<string, unknown>,
	cost = 0.01,
) =>
	JSON.stringify({
		type: "step_finish",
		sessionID: session,
		part: { id, type: "step-finish", tokens, cost },
	});

describe("summarizeJsonl", () => {
	it("sums root-session tokens/cost, dedupes text and ignores chatter", () => {
		const summary = summarizeJsonl(
			[
				"$ pnpm catalog:status",
				"{not json",
				text("t1", "first"),
				text("t1", "first"),
				text("t2", "done"),
				finish(1500),
				finish(500),
				JSON.stringify({ type: "unknown", sessionID: session }),
			].join("\n"),
		);
		expect(summary.sessionId).toBe(session);
		expect(summary.tokens).toBe(2000);
		expect(summary.billedTokens).toBeNull();
		expect(summary.costUsd).toBeCloseTo(0.02);
		expect(summary.texts).toEqual(["first", "done"]);
		expect(summary.parse).toBe("complete");
	});

	it("separates billed non-cache tokens from the cache-inclusive total", () => {
		const summary = summarizeJsonl(
			[
				finishUsage("f1", {
					total: 16_876,
					input: 15_001,
					output: 83,
					reasoning: 0,
					cache: { read: 1_792, write: 0 },
				}),
				finishUsage("f2", {
					total: 18_981,
					input: 2_072,
					output: 132,
					reasoning: 9,
					cache: { read: 16_768, write: 0 },
				}),
			].join("\n"),
		);
		expect(summary.tokens).toBe(35_857);
		expect(summary.billedTokens).toBe(17_297);
	});

	it("derives both totals when a step omits the total field", () => {
		const summary = summarizeJsonl(
			finishUsage("f1", {
				input: 10,
				output: 5,
				reasoning: 1,
				cache: { read: 4, write: 2 },
			}),
		);
		expect(summary.tokens).toBe(22);
		expect(summary.billedTokens).toBe(16);
	});

	it("marks a run with no step_finish as partial, never successful", () => {
		const summary = summarizeJsonl(text("t1", "hi"));
		expect(summary.parse).toBe("partial");
		expect(summary.tokens).toBeNull();
		expect(summary.billedTokens).toBeNull();
		expect(summary.errors[0]).toMatch(/no step_finish/);
	});

	it("turns error events into a failed parse with the provider message", () => {
		const summary = summarizeJsonl(
			JSON.stringify({
				type: "error",
				sessionID: session,
				part: {
					type: "error",
					error: { data: { message: "429 rate limit" } },
				},
			}),
		);
		expect(summary.parse).toBe("failed");
		expect(summary.errors[0]).toContain("429");
	});
});
