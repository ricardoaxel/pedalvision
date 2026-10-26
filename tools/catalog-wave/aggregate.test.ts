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
		expect(summary.costUsd).toBeCloseTo(0.02);
		expect(summary.texts).toEqual(["first", "done"]);
		expect(summary.parse).toBe("complete");
	});

	it("marks a run with no step_finish as partial, never successful", () => {
		const summary = summarizeJsonl(text("t1", "hi"));
		expect(summary.parse).toBe("partial");
		expect(summary.tokens).toBeNull();
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
