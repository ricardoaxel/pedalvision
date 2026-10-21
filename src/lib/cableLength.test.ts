import { describe, expect, it } from "vitest";
import {
	CABLE_MIN_SLACK_CM,
	CABLE_SLACK_RATIO,
	cableLengthForPoints,
	PLUG_OVERHANG_CM,
	roundUpToSoldLength,
	SOLD_CABLE_LENGTHS_CM,
} from "./cableLength";

describe("roundUpToSoldLength", () => {
	it("rounds up to each stocked length", () => {
		expect(roundUpToSoldLength(9)).toBe(10);
		expect(roundUpToSoldLength(10)).toBe(10);
		expect(roundUpToSoldLength(10.01)).toBe(15);
		expect(roundUpToSoldLength(15)).toBe(15);
		expect(roundUpToSoldLength(15.01)).toBe(20);
		expect(roundUpToSoldLength(20)).toBe(20);
		expect(roundUpToSoldLength(20.01)).toBe(30);
		expect(roundUpToSoldLength(30)).toBe(30);
		expect(roundUpToSoldLength(30.01)).toBe(60);
		expect(roundUpToSoldLength(60)).toBe(60);
	});

	it("returns null above the longest stocked length", () => {
		expect(roundUpToSoldLength(60.01)).toBeNull();
		expect(roundUpToSoldLength(120)).toBeNull();
	});

	it("exposes the documented sold lengths", () => {
		expect(SOLD_CABLE_LENGTHS_CM).toEqual([10, 15, 20, 30, 60]);
	});
});

describe("cableLengthForPoints", () => {
	it("adds plug overhang and slack, then rounds up", () => {
		const result = cableLengthForPoints({ x: 0, y: 0 }, { x: 10, y: 0 });
		expect(result.distanceCm).toBeCloseTo(10);
		expect(result.plugOverhangCm).toBe(PLUG_OVERHANG_CM * 2);
		expect(result.slackCm).toBeCloseTo((10 + 3) * CABLE_SLACK_RATIO);
		expect(result.requiredCm).toBeCloseTo(14.3);
		expect(result.lengthCm).toBe(15);
		expect(result.custom).toBe(false);
	});

	it("uses the minimum slack on a very short run", () => {
		const result = cableLengthForPoints({ x: 0, y: 0 }, { x: 0, y: 0 });
		expect(result.slackCm).toBe(CABLE_MIN_SLACK_CM);
		expect(result.requiredCm).toBe(4);
		expect(result.lengthCm).toBe(10);
	});

	it("uses 2D distance, not the screen path", () => {
		const result = cableLengthForPoints({ x: 0, y: 0 }, { x: 6, y: 8 });
		expect(result.distanceCm).toBeCloseTo(10);
		expect(result.lengthCm).toBe(15);
	});

	it("rounds a 50 cm run up to 60", () => {
		const result = cableLengthForPoints({ x: 0, y: 0 }, { x: 50, y: 0 });
		expect(result.requiredCm).toBeCloseTo(58.3);
		expect(result.lengthCm).toBe(60);
	});

	it("flags a run above 60 cm as custom", () => {
		const result = cableLengthForPoints({ x: 0, y: 0 }, { x: 60, y: 0 });
		expect(result.requiredCm).toBeCloseTo(69.3);
		expect(result.lengthCm).toBeNull();
		expect(result.custom).toBe(true);
	});
});
