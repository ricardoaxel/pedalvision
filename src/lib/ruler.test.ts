import { describe, expect, it } from "vitest";
import { RULER_GUTTER } from "../styles/theme";
import { cmToPx, displayToCm } from "./geometry";
import {
	buildRulerTicks,
	chooseRulerStep,
	formatRulerLabel,
	RULER_BOTTOM_END_INSET_PX,
	RULER_MAJOR_MIN_PX,
} from "./ruler";

const input = {
	stageWidth: 1280,
	offsetX: 0,
};

describe("chooseRulerStep", () => {
	it("uses the pencil 1-2-5 cm cadence across 0.1×–8×", () => {
		const table: Array<[number, number, number]> = [
			[0.1, 1000, 500],
			[0.25, 500, 250],
			[0.5, 200, 100],
			[1, 100, 50],
			[2, 50, 25],
			[4, 20, 10],
			[8, 10, 5],
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

	it("keeps majors sparse and minors at half", () => {
		for (const scale of [0.1, 0.25, 0.5, 1, 2, 4, 8]) {
			for (const units of ["cm", "in"] as const) {
				const step = chooseRulerStep(scale, units);
				expect(step.majorPx).toBeGreaterThanOrEqual(RULER_MAJOR_MIN_PX);
				expect(step.subdivisions).toBe(2);
				expect(step.minorPx).toBeCloseTo(step.majorPx / 2, 10);
			}
		}
	});

	it("uses inch majors and converts them back to exact cm", () => {
		const step = chooseRulerStep(1, "in");
		expect(step.majorLabel).toBe(50);
		expect(step.minorLabel).toBe(25);
		expect(step.majorCm).toBeCloseTo(displayToCm(50, "in"), 10);
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
		expect(formatRulerLabel(100)).toBe("100");
		expect(formatRulerLabel(2.5)).toBe("2.5");
	});

	it("uses a typographic minus for negative world coordinates", () => {
		expect(formatRulerLabel(-100)).toBe("\u2212100");
		expect(formatRulerLabel(-2.5)).toBe("\u22122.5");
	});
});

describe("buildRulerTicks", () => {
	it("anchors the bottom world origin to the gutter", () => {
		const ticks = buildRulerTicks(1, "cm", input);
		expect(ticks.bottom.find((tick) => tick.origin)?.px).toBe(RULER_GUTTER.x);
		expect(ticks.majorLabel).toBe(100);
		expect(ticks.minorLabel).toBe(50);
	});

	it("labels the origin and a few unit-marked bottom coordinates", () => {
		const ticks = buildRulerTicks(1, "cm", input);
		expect(ticks.bottomLabels[0]).toBe("0");
		expect(ticks.bottomLabels[1]).toBe("100");
		expect(ticks.bottomLabels.length).toBeLessThanOrEqual(4);
		const last = Number(
			ticks.bottomLabels[ticks.bottomLabels.length - 1]?.replace("\u2212", "-"),
		);
		const lastPx = displayToCm(last, "cm") * 4 + RULER_GUTTER.x;
		expect(lastPx).toBeLessThanOrEqual(
			input.stageWidth + RULER_GUTTER.x - RULER_BOTTOM_END_INSET_PX,
		);
	});

	it("moves labels with pan and prints negative world coordinates", () => {
		const before = buildRulerTicks(1, "cm", input);
		const after = buildRulerTicks(1, "cm", { ...input, offsetX: 500 });
		expect(after.bottomLabels.join(",")).not.toBe(
			before.bottomLabels.join(","),
		);
		expect(after.bottomLabels).toContain("\u2212100");
	});

	it("switches to inch majors and labels", () => {
		const ticks = buildRulerTicks(1, "in", input);
		expect(ticks.majorLabel).toBe(50);
		expect(ticks.majorCm).toBeCloseTo(127, 10);
	});

	it("caps pathological tick counts", () => {
		const ticks = buildRulerTicks(0.1, "cm", {
			...input,
			stageWidth: 100_000,
		});
		expect(ticks.bottom.length).toBeLessThanOrEqual(400);
	});
});
