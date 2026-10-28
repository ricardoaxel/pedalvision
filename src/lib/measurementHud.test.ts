import { describe, expect, it } from "vitest";
import { cmToPx, PX_PER_CM } from "./geometry";
import {
	chooseScaleBar,
	SCALE_BAR_CANDIDATES,
	SCALE_BAR_MAX_PX,
	zoomPercent,
} from "./measurementHud";

describe("zoomPercent", () => {
	it("renders the stage scale as an integer percentage", () => {
		expect(zoomPercent(0.1)).toBe(10);
		expect(zoomPercent(1)).toBe(100);
		expect(zoomPercent(2.5)).toBe(250);
		expect(zoomPercent(8)).toBe(800);
	});

	it("rounds and never leaks non-finite values into the readout", () => {
		expect(zoomPercent(1.234)).toBe(123);
		expect(zoomPercent(Number.NaN)).toBe(100);
		expect(zoomPercent(Number.POSITIVE_INFINITY)).toBe(100);
	});
});

describe("chooseScaleBar", () => {
	it("draws a true-length bar at every zoom (barPx = cm × PX_PER_CM × scale)", () => {
		for (const scale of [0.1, 0.25, 0.5, 1, 2, 4, 8]) {
			for (const units of ["cm", "in"] as const) {
				const bar = chooseScaleBar(scale, units);
				expect(bar.barPx).toBeCloseTo(cmToPx(bar.lengthCm, scale), 10);
				expect(bar.barPx).toBeCloseTo(bar.lengthCm * PX_PER_CM * scale, 10);
			}
		}
	});

	it("keeps the drawn bar within the readable budget at the zoom extremes", () => {
		for (const scale of [0.1, 0.25, 0.5, 1, 2, 4, 8]) {
			for (const units of ["cm", "in"] as const) {
				const bar = chooseScaleBar(scale, units);
				expect(bar.barPx).toBeGreaterThan(0);
				expect(bar.barPx).toBeLessThanOrEqual(SCALE_BAR_MAX_PX);
			}
		}
	});

	it("falls back to the smallest round length past the app's zoom range", () => {
		const bar = chooseScaleBar(50, "cm");
		expect(bar.lengthLabel).toBe(1);
		expect(bar.barPx).toBeCloseTo(cmToPx(1, 50), 10);
	});

	it("picks round candidates that match the cartographic table", () => {
		const cm = (scale: number) => chooseScaleBar(scale, "cm").lengthLabel;
		expect(cm(0.1)).toBe(200);
		expect(cm(0.25)).toBe(100);
		expect(cm(0.5)).toBe(50);
		expect(cm(1)).toBe(25);
		expect(cm(2)).toBe(10);
		expect(cm(4)).toBe(5);
		expect(cm(8)).toBe(2);

		const inches = (scale: number) => chooseScaleBar(scale, "in").lengthLabel;
		expect(inches(0.1)).toBe(100);
		expect(inches(1)).toBe(10);
		expect(inches(8)).toBe(1);
	});

	it("converts the round display label back to exact cm", () => {
		const inches = chooseScaleBar(1, "in");
		expect(inches.lengthLabel).toBe(10);
		expect(inches.lengthCm).toBeCloseTo(25.4, 10);
		expect(inches.units).toBe("in");
	});

	it("is defensive about a non-finite or non-positive scale", () => {
		const fallback = chooseScaleBar(Number.NaN, "cm");
		const one = chooseScaleBar(1, "cm");
		expect(fallback).toEqual(one);
		expect(chooseScaleBar(0, "cm")).toEqual(one);
		expect(chooseScaleBar(-3, "cm")).toEqual(one);
	});

	it("only offers the documented round lengths", () => {
		const readings = [0.1, 0.5, 1, 4, 8].flatMap((scale) =>
			(["cm", "in"] as const).map(
				(units) => chooseScaleBar(scale, units).lengthLabel,
			),
		);
		for (const label of readings) {
			expect(SCALE_BAR_CANDIDATES).toContain(label);
		}
	});
});
