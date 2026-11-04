import { describe, expect, it } from "vitest";
import type { PlacedBoard, PlacedItem } from "../state/scene";
import {
	buildExportScaleReference,
	exportScalePpi,
	scaleBarLengthCm,
} from "./exportScale";
import { resolveExportPlan } from "./exportScene";

function board(widthCm = 60): PlacedBoard {
	return {
		uid: "board-1",
		boardRefId: null,
		customSize: { widthCm, heightCm: 30 },
		texture: "matte",
		x: 0,
		y: 0,
		rotationDeg: 0,
	};
}

const ITEM: PlacedItem = {
	uid: "item-1",
	refId: "custom-1",
	kind: "pedal",
	boardUid: "board-1",
	x: 5,
	y: 5,
	rotationDeg: 0,
	z: 0,
};

function plan(widthCm = 60) {
	return resolveExportPlan(
		{
			boards: [board(widthCm)],
			items: [ITEM],
			customPedals: [
				{
					refId: "custom-1",
					brand: "Test",
					name: "Part",
					widthCm: 10,
					heightCm: 6,
					category: "pedal",
					effectTypes: [],
				},
			],
		},
		{ scope: "board", boardUid: "board-1" },
	);
}

describe("scaleBarLengthCm", () => {
	it("uses the long 10 cm bar for normal content", () => {
		expect(scaleBarLengthCm(60)).toBe(10);
		expect(scaleBarLengthCm(40)).toBe(10);
	});

	it("uses the short 5 cm bar for narrow content", () => {
		expect(scaleBarLengthCm(39.9)).toBe(5);
	});
});

describe("buildExportScaleReference", () => {
	it("labels the bar in the active unit (cm by default)", () => {
		const reference = buildExportScaleReference(plan(), "png", "cm");
		expect(reference.lengthCm).toBe(10);
		expect(reference.primaryLabel).toBe("10 cm");
		expect(reference.scaleLabel).toBe("SCALE");
		expect(reference.ratioLabel).toBe("1:1");
	});

	it("makes inches primary when the app is set to inches", () => {
		const reference = buildExportScaleReference(plan(), "png", "in");
		expect(reference.primaryLabel).toBe("3.94 in");
	});

	it("converts the short bar to inches", () => {
		const reference = buildExportScaleReference(plan(30), "png", "in");
		expect(reference.lengthCm).toBe(5);
		expect(reference.primaryLabel).toBe("1.97 in");
	});

	it("puts the print condition first and the PNG PPI in parentheses", () => {
		const p = plan();
		const reference = buildExportScaleReference(p, "png", "cm");
		expect(reference.printHint).toBe(
			`PRINT AT 100% (${Math.round(p.outputPpi)} PPI)`,
		);
		expect(reference.detailLabel).toBe(
			`1:1 · PRINT AT 100% (${Math.round(p.outputPpi)} PPI)`,
		);
	});

	it("uses only the page-scale condition for PDF (no PPI)", () => {
		const reference = buildExportScaleReference(plan(), "pdf", "cm");
		expect(reference.printHint).toBe("PRINT AT 100%");
		expect(reference.detailLabel).toBe("1:1 · PRINT AT 100%");
		expect(reference.detailLabel).not.toContain("PPI");
	});

	it("rounds the reported PPI", () => {
		const p = plan();
		expect(exportScalePpi(p)).toBe(Math.round(p.outputPpi));
		expect(Number.isInteger(exportScalePpi(p))).toBe(true);
	});
});
