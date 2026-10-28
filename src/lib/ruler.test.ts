import { describe, expect, it } from "vitest";
import { cmToPx, displayToCm } from "./geometry";
import {
	buildRulerTicks,
	chooseRulerStep,
	formatRulerLabel,
	RULER_MAJOR_MIN_PX,
} from "./ruler";

describe("chooseRulerStep", () => {
	it("uses the documented 1-2-5 cm cadence across 0.1×–8×", () => {
		const table: Array<[number, number, number]> = [
			[0.1, 200, 50],
			[0.25, 100, 20],
			[0.5, 50, 10],
			[1, 20, 5],
			[2, 10, 2],
			[4, 5, 1],
			[8, 2, 0.5],
		];
		for (const [scale, major, minor] of table) {
			const step = chooseRulerStep(scale, "cm");
			expect(step.majorLabel).toBe(major);
			expect(step.minorLabel).toBe(minor);
			expect(step.majorCm).toBe(major);
			expect(step.majorPx).toBeCloseTo(cmToPx(major, scale), 10);
			expect(step.minorPx).toBeCloseTo(cmToPx(minor, scale), 10);
		}
	});

	it("keeps major ticks readable and minors dense enough", () => {
		for (const scale of [0.1, 0.25, 0.5, 1, 2, 4, 8]) {
			for (const units of ["cm", "in"] as const) {
				const step = chooseRulerStep(scale, units);
				expect(step.majorPx).toBeGreaterThanOrEqual(RULER_MAJOR_MIN_PX);
				expect(step.minorPx).toBeGreaterThanOrEqual(12.8);
				expect(step.minorPx).toBeLessThan(step.majorPx);
			}
		}
	});

	it("uses inch majors and converts them back to exact cm", () => {
		const step = chooseRulerStep(1, "in");
		expect(step.majorLabel).toBe(10);
		expect(step.minorLabel).toBe(2);
		expect(step.majorCm).toBeCloseTo(displayToCm(10, "in"), 10);
	});

	it("is defensive about a non-finite or non-positive scale", () => {
		expect(chooseRulerStep(Number.NaN, "cm")).toEqual(chooseRulerStep(1, "cm"));
		expect(chooseRulerStep(0, "cm")).toEqual(chooseRulerStep(1, "cm"));
		expect(chooseRulerStep(-2, "cm")).toEqual(chooseRulerStep(1, "cm"));
	});
});

describe("formatRulerLabel", () => {
	it("prints integers and trims decimals", () => {
		expect(formatRulerLabel(0)).toBe("0");
		expect(formatRulerLabel(20)).toBe("20");
		expect(formatRulerLabel(2.5)).toBe("2.5");
		expect(formatRulerLabel(0.5)).toBe("0.5");
	});

	it("uses a typographic minus for negative world coordinates", () => {
		expect(formatRulerLabel(-20)).toBe("\u221220");
		expect(formatRulerLabel(-2.5)).toBe("\u22122.5");
	});
});

describe("buildRulerTicks", () => {
	const size = { width: 800, height: 600 };

	it("anchors the world origin to the stage offset", () => {
		const ticks = buildRulerTicks(1, "cm", size, { x: 100, y: 50 });
		expect(ticks.top.find((tick) => tick.origin)?.px).toBe(100);
		expect(ticks.left.find((tick) => tick.origin)?.px).toBe(50);
		expect(ticks.topLabels).toContain("0");
	});

	it("moves labels with pan (world-anchored, not screen-fixed)", () => {
		const before = buildRulerTicks(1, "cm", size, { x: 100, y: 50 });
		const after = buildRulerTicks(1, "cm", size, { x: 180, y: 50 });
		expect(after.topLabels.join(",")).not.toBe(before.topLabels.join(","));
		expect(after.top.find((tick) => tick.origin)?.px).toBe(180);
	});

	it("prints negative world coordinates", () => {
		const ticks = buildRulerTicks(1, "cm", size, { x: 180, y: 50 });
		expect(ticks.topLabels).toContain("\u221220");
	});

	it("switches to inch majors and labels", () => {
		const ticks = buildRulerTicks(1, "in", size, { x: 100, y: 50 });
		expect(ticks.majorLabel).toBe(10);
		expect(ticks.majorCm).toBeCloseTo(25.4, 10);
		expect(ticks.topLabels).toContain("10");
	});

	it("skips labels that would clip at the edges", () => {
		const ticks = buildRulerTicks(1, "cm", size, { x: 0, y: 0 });
		expect(ticks.topLabels).not.toContain("0");
		expect(ticks.topLabels[0]).toBe("20");
	});

	it("caps pathological tick counts", () => {
		const ticks = buildRulerTicks(
			0.1,
			"cm",
			{ width: 100_000, height: 600 },
			{
				x: 0,
				y: 0,
			},
		);
		expect(ticks.top.length).toBeLessThanOrEqual(400);
	});
});
