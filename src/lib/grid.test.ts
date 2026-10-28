import { describe, expect, it } from "vitest";
import { gridCellCm, gridLevels, MIN_GRID_SCREEN_PITCH } from "./grid";

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

	it("reports whole-centimetre grid cells (5 cm base)", () => {
		expect(gridCellCm(1)).toBe(5);
		expect(gridCellCm(2)).toBe(5);
		expect(gridCellCm(0.25)).toBe(20);
		expect(gridCellCm(Number.NaN)).toBe(5);
	});

	it("coarsens a finer selected step to the 16 px floor", () => {
		// 1 cm at 1× is 4 px: the drawn/readout pitch is 4 cm, not a 4 px dot field.
		expect(gridCellCm(1, 1)).toBe(4);
		expect(gridCellCm(1, 2)).toBe(4);
		expect(gridCellCm(1, 5)).toBe(5);
		expect(gridCellCm(1, 10)).toBe(10);
		expect(gridCellCm(2, 1)).toBe(2);
		expect(gridCellCm(4, 1)).toBe(1);
		expect(gridLevels(1, 1).fineStepPx).toBe(16);
	});

	it("is defensive about a non-finite or non-positive scale", () => {
		expect(gridLevels(Number.NaN)).toEqual(gridLevels(1));
		expect(gridLevels(0)).toEqual(gridLevels(1));
		expect(gridLevels(-3)).toEqual(gridLevels(1));
	});
});
