import { describe, expect, it } from "vitest";
import { formatWaveReport } from "./report.ts";
import type { WaveState } from "./wave-state.ts";

const state: WaveState = {
	version: 1,
	id: "boss-wave-1",
	status: "complete",
	startedAt: "2026-10-25T20:00:00.000Z",
	endedAt: "2026-10-25T21:20:00.000Z",
	planPath: "/plans/boss-wave-1.json",
	batches: [
		{
			batch: "boss/boss-1",
			branch: "p5-03-pedals-boss-1",
			worktree: "/w/boss-1",
			total: 26,
			status: "complete",
			log: "/w/boss-1.jsonl",
			startedAt: "2026-10-25T20:00:00.000Z",
			endedAt: "2026-10-25T21:20:00.000Z",
			runner: {
				done: 26,
				total: 26,
				imagesAccepted: 24,
				imagesRejected: 0,
				tokens: 312_000,
				status: "complete",
				blockers: [],
				startedAt: "2026-10-25T20:00:00.000Z",
				endedAt: "2026-10-25T21:20:00.000Z",
			},
			session: {
				sessionId: "ses_x",
				tokens: 118_000,
				costUsd: 0.2,
				texts: ["26/26 done; PR #46 open."],
				parse: "complete",
				errors: [],
			},
			pr: {
				number: 46,
				url: "https://github.com/x/y/pull/46",
				state: "OPEN",
				checks: "pass",
			},
		},
	],
	notes: ["started boss/boss-1"],
	reportPath: "/w/report.md",
};

describe("formatWaveReport", () => {
	it("renders one line per batch plus totals, PR/CI and session text", () => {
		const report = formatWaveReport(state);
		expect(report).toContain(
			"| boss/boss-1 | complete | 26/26 | 24/0 | 312k | 118k (floor) | 80 min | [#46]",
		);
		expect(report).toContain("| **Total** | **complete** | **26/26**");
		expect(report).toContain("PR #46 open");
		expect(
			report.split("\n").filter((line) => line.startsWith("| boss/")),
		).toHaveLength(1);
	});

	it("shows unknown instead of 0 when the session token total is missing", () => {
		const report = formatWaveReport({
			...state,
			batches: [
				{
					...state.batches[0]!,
					session: { ...state.batches[0]!.session!, tokens: null },
				},
			],
		});
		expect(report).toContain("unknown (floor)");
	});
});
