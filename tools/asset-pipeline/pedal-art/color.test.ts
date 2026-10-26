import { describe, expect, it } from "vitest";
import {
	ART_PALETTE,
	clampChroma,
	contrastRatio,
	hexToOklch,
	parseHex,
	pickInk,
	rgbToHex,
	shade,
} from "./color.ts";

describe("pedal-art colour", () => {
	it("round-trips hex and rgb", () => {
		expect(parseHex("#E8722F")).toEqual({ r: 232, g: 114, b: 47 });
		expect(rgbToHex({ r: 232, g: 114, b: 47 })).toBe("#E8722F");
	});

	it("computes the house ink contrast", () => {
		expect(
			contrastRatio(ART_PALETTE.printDark, ART_PALETTE.printLight),
		).toBeCloseTo(15.6, 1);
	});

	it("keeps the sampled DS-1 orange inside the body chroma cap", () => {
		const orange = "#E8722F";
		expect(hexToOklch(orange).c).toBeLessThan(0.18);
		expect(clampChroma(orange, 0.18)).toBe(orange);
	});

	it("clamps a neon fill while preserving lightness/hue", () => {
		const neon = "#FF00FF";
		const clamped = clampChroma(neon, 0.18);
		const before = hexToOklch(neon);
		const after = hexToOklch(clamped);
		expect(after.c).toBeLessThanOrEqual(0.1801);
		expect(after.l).toBeCloseTo(before.l, 1);
		expect(after.h).toBeCloseTo(before.h, 0);
	});

	it("shades per sRGB channel", () => {
		expect(shade("#E8722F", 0.88)).toBe("#CC6429");
	});

	it("picks the dark ink on orange and the light ink on charcoal", () => {
		expect(pickInk("#E8722F").hex).toBe(ART_PALETTE.printDark);
		expect(pickInk("#414045").hex).toBe(ART_PALETTE.printLight);
	});
});
