import { describe, expect, it } from "vitest";
import { RULER_GUTTER } from "../styles/theme";
import { cmToPx, displayToCm } from "./geometry";
import {
	buildRulerTicks,
	chooseRulerStep,
	formatRulerLabel,
	RULER_MAJOR_MIN_PX,
	RULER_TITLE_BLOCK_RESERVE_PX,
} from "./ruler";

const input = {
	stageWidth: 1280,
	stageHeight: 720,
	offsetX: 0,
	offsetY: 0,
};

describe("chooseRulerStep", () => {
	it("uses the sparse 1-2-5 cm cadence across 0.1×–8×", () => {
		const table: Array<[number, number, number]> = [
			[0.1, 500, 250],
			[0.25, 200, 100],
			[0.5, 100, 50],
			[1, 50, 25],
			[2, 20, 10],
			[4, 10, 5],
			[8, 5, 2.5],
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
		expect(step.majorLabel).toBe(20);
		expect(step.minorLabel).toBe(10);
		expect(step.majorCm).toBeCloseTo(displayToCm(20, "in"), 10);
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
		expect(formatRulerLabel(50)).toBe("50");
		expect(formatRulerLabel(2.5)).toBe("2.5");
	});

	it("uses a typographic minus for negative world coordinates", () => {
		expect(formatRulerLabel(-20)).toBe("\u221220");
		expect(formatRulerLabel(-2.5)).toBe("\u22122.5");
	});
});

describe("buildRulerTicks", () => {
	it("anchors the left and bottom world origins to the gutters", () => {
		const ticks = buildRulerTicks(1, "cm", input);
		expect(ticks.left.find((tick) => tick.origin)?.px).toBe(0);
		expect(ticks.bottom.find((tick) => tick.origin)?.px).toBe(RULER_GUTTER.x);
		expect(ticks.majorLabel).toBe(50);
		expect(ticks.minorLabel).toBe(25);
	});

	it("labels the visible world coordinates sparsely", () => {
		const ticks = buildRulerTicks(1, "cm", input);
		expect(ticks.leftLabels[0]).toBe("50");
		expect(ticks.bottomLabels[0]).toBe("50");
		const last = Number(
			ticks.bottomLabels[ticks.bottomLabels.length - 1]?.replace("\u2212", "-"),
		);
		const lastPx = displayToCm(last, "cm") * 4 + RULER_GUTTER.x;
		expect(lastPx).toBeLessThanOrEqual(
			input.stageWidth + RULER_GUTTER.x - RULER_TITLE_BLOCK_RESERVE_PX,
		);
	});

	it("moves labels with pan (world-anchored, not screen-fixed)", () => {
		const before = buildRulerTicks(1, "cm", input);
		const after = buildRulerTicks(1, "cm", { ...input, offsetX: 500 });
		expect(after.bottomLabels.join(",")).not.toBe(
			before.bottomLabels.join(","),
		);
	});

	it("prints negative world coordinates", () => {
		const ticks = buildRulerTicks(1, "cm", {
			...input,
			offsetX: 500,
			offsetY: 500,
		});
		expect(ticks.bottomLabels).toContain("\u221250");
		expect(ticks.leftLabels).toContain("\u221250");
	});

	it("switches to inch majors and labels", () => {
		const ticks = buildRulerTicks(1, "in", input);
		expect(ticks.majorLabel).toBe(20);
		expect(ticks.majorCm).toBeCloseTo(50.8, 10);
	});

	it("caps pathological tick counts", () => {
		const ticks = buildRulerTicks(0.1, "cm", {
			...input,
			stageWidth: 100_000,
		});
		expect(ticks.bottom.length).toBeLessThanOrEqual(400);
	});
});
