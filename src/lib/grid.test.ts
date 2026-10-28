import { describe, expect, it } from "vitest";
import { gridCellCm, gridLevels, MIN_GRID_SCREEN_PITCH } from "./grid";

describe("gridLevels", () => {
	it("keeps the dominant level at the 16 px floor during crossfades", () => {
		for (const scale of [0.1, 0.25, 0.5, 1, 2, 4, 8]) {
			const levels = gridLevels(scale);
			expect(levels.coarseStepPx).toBeGreaterThanOrEqual(
				MIN_GRID_SCREEN_PITCH - 1e-9,
			);
			expect(levels.fineStepPx).toBeGreaterThanOrEqual(8 - 1e-9);
			expect(levels.coarseStepPx).toBeCloseTo(levels.fineStepPx * 2, 10);
		}
	});

	it("doubles the cell at low zoom and stays 6 cm when zoomed in", () => {
		expect(gridCellCm(0.5)).toBe(6);
		expect(gridCellCm(0.25)).toBe(12);
		expect(gridCellCm(0.1)).toBe(48);
		expect(gridCellCm(1)).toBe(6);
		expect(gridCellCm(4)).toBe(6);
		expect(gridCellCm(8)).toBe(6);
	});

	it("reports the more opaque crossfade level", () => {
		for (const scale of [0.1, 0.2, 0.25, 0.4, 0.5, 1, 2]) {
			const levels = gridLevels(scale);
			const expected =
				levels.frac > 0.5 ? levels.coarseCellCm : levels.fineCellCm;
			expect(gridCellCm(scale)).toBe(expected);
		}
	});

	it("is defensive about a non-finite or non-positive scale", () => {
		expect(gridCellCm(Number.NaN)).toBe(6);
		expect(gridCellCm(0)).toBe(6);
		expect(gridCellCm(-3)).toBe(6);
	});
});
