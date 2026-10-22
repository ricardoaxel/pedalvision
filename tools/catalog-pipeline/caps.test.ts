import { describe, expect, it } from "vitest";
import { CATALOG_LIMITS } from "../catalog-transform/limits.ts";
import { type AssetCounts, canStartBatch, capIssues } from "./caps.ts";

function counts(pedals = 0, boards = 0): AssetCounts {
	return {
		pedals: { items: pedals, files: pedals * 2, bytes: 0 },
		boards: { items: boards, files: boards * 2, bytes: 0 },
	};
}

describe("catalog caps", () => {
	it("allows a batch below the hosted-pedal cap", () => {
		expect(canStartBatch("pedals", 50, counts(1900)).ok).toBe(true);
	});

	it("refuses the next pedal batch at the 2,000 cap", () => {
		const result = canStartBatch(
			"pedals",
			10,
			counts(CATALOG_LIMITS.hostedPedals),
		);
		expect(result.ok).toBe(false);
		expect(result.reason).toContain("pedal items cap");
	});

	it("refuses the next board batch at the 150-board cap", () => {
		const result = canStartBatch(
			"boards",
			1,
			counts(0, CATALOG_LIMITS.tierABoards),
		);
		expect(result.ok).toBe(false);
		expect(result.reason).toContain("board items cap");
	});

	it("boards do not count toward the pedal cap", () => {
		expect(canStartBatch("pedals", 10, counts(100, 150)).ok).toBe(true);
	});

	it("checks the board file and byte budgets independently", () => {
		const overFiles = counts(0, 10);
		overFiles.boards.files = CATALOG_LIMITS.boardImageFiles;
		const result = canStartBatch("boards", 1, overFiles);
		expect(result.ok).toBe(false);
		expect(result.reason).toContain("board files cap");

		const overBytes = counts(0, 10);
		overBytes.boards.bytes = CATALOG_LIMITS.boardImageMb * 1024 * 1024 + 1;
		expect(capIssues(overBytes).some((issue) => issue.unit === "mb")).toBe(
			true,
		);
	});

	it("does not report a cap issue when boards exceed pedal counts", () => {
		expect(capIssues(counts(10, 20))).toEqual([]);
	});
});
