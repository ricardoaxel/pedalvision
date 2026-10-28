import { describe, expect, it } from "vitest";
import { gridLevels, MIN_GRID_SCREEN_PITCH } from "./grid";

describe("gridLevels", () => {
	it("keeps the dominant level at the 16 px floor", () => {
		for (const scale of [0.1, 0.25, 0.5, 1, 2, 4, 8]) {
			const levels = gridLevels(scale);
			expect(levels.coarseStepPx).toBeGreaterThanOrEqual(
				MIN_GRID_SCREEN_PITCH - 1e-9,
			);
			expect(levels.fineStepPx).toBeGreaterThanOrEqual(8 - 1e-9);
			expect(levels.coarseStepPx).toBeCloseTo(levels.fineStepPx * 2, 10);
		}
	});

	it("is defensive about a non-finite or non-positive scale", () => {
		expect(gridLevels(Number.NaN)).toEqual(gridLevels(1));
		expect(gridLevels(0)).toEqual(gridLevels(1));
		expect(gridLevels(-3)).toEqual(gridLevels(1));
	});
});
