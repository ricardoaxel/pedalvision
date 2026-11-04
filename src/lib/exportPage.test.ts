import { describe, expect, it } from "vitest";
import type { PlacedBoard } from "../state/scene";
import {
	chooseFitBarLengthCm,
	formatScaleRatio,
	PAGE_BAND_CM,
	PAGE_MARGIN_CM,
	PAPER_SIZES_CM,
	pageLabelUnit,
	resolvePdfPage,
	truePageFitsPaper,
} from "./exportPage";
import { resolveExportPlan } from "./exportScene";

function board(widthCm: number, heightCm: number): PlacedBoard {
	return {
		uid: "board-1",
		boardRefId: null,
		customSize: { widthCm, heightCm },
		texture: "matte",
		x: 0,
		y: 0,
		rotationDeg: 0,
	};
}

function plan(widthCm = 60, heightCm = 30) {
	return resolveExportPlan(
		{
			boards: [board(widthCm, heightCm)],
			items: [],
			customPedals: [],
		},
		{ scope: "board", boardUid: "board-1" },
	);
}

describe("resolvePdfPage", () => {
	it("fits a landscape board onto A4 landscape", () => {
		const page = resolvePdfPage(plan(60, 30), {
			paper: "a4",
			quality: "standard",
		});
		expect(page.orientation).toBe("landscape");
		expect(page.pageWidthCm).toBeCloseTo(29.7);
		expect(page.pageHeightCm).toBeCloseTo(21);
		expect(page.printScale).toBeLessThan(1);
		expect(page.contentOriginCm.x).toBeGreaterThanOrEqual(PAGE_MARGIN_CM);
		expect(page.contentOriginCm.y).toBeGreaterThan(PAGE_MARGIN_CM);
		expect(page.outputPpi).toBe(200);
		expect(page.stageWidthPx).toBe(Math.round(29.7 * (200 / 2.54)));
		expect(page.stageHeightPx).toBe(Math.round(21 * (200 / 2.54)));
	});

	it("never enlarges a small plan", () => {
		const page = resolvePdfPage(plan(10, 5), {
			paper: "a4",
			quality: "standard",
		});
		expect(page.printScale).toBe(1);
		expect(page.ratioLabel).toBe("1:1");
	});

	it("keeps the plan orientation for near-square content", () => {
		const page = resolvePdfPage(plan(20, 20), {
			paper: "a4",
			quality: "standard",
		});
		expect(page.orientation).toBe("portrait");
	});

	it("reserves the bottom band below the drawing area", () => {
		const page = resolvePdfPage(plan(60, 30), {
			paper: "a4",
			quality: "standard",
		});
		expect(page.contentRectCm.y + page.contentRectCm.heightCm).toBeCloseTo(
			21 - PAGE_MARGIN_CM - PAGE_BAND_CM,
		);
	});

	it("uses the higher page DPI in HD", () => {
		const page = resolvePdfPage(plan(60, 30), {
			paper: "a4",
			quality: "hd",
		});
		expect(page.outputPpi).toBe(300);
		expect(page.stageWidthPx).toBe(Math.round(29.7 * (300 / 2.54)));
	});

	it("fits the same plan on Letter", () => {
		const page = resolvePdfPage(plan(60, 30), {
			paper: "letter",
			quality: "standard",
		});
		expect(page.pageWidthCm).toBeCloseTo(27.94);
		expect(page.pageHeightCm).toBeCloseTo(21.59);
		expect(page.orientation).toBe("landscape");
	});

	it("reports a printed ruler length that fits the page", () => {
		const page = resolvePdfPage(plan(60, 30), {
			paper: "a4",
			quality: "standard",
		});
		expect(page.barPrintedLengthCm).toBeLessThanOrEqual(10);
	});
});

describe("pageLabelUnit", () => {
	it("keeps label paper size constant across Standard and HD", () => {
		const standard = pageLabelUnit(32, 0.45);
		const hd = pageLabelUnit(64, 0.45);
		expect(standard).toBeCloseTo(0.45);
		expect(hd).toBeCloseTo(0.225);
		// The renderer divides local px by this unit; the extra 2× plan density
		// must be cancelled by the half-size unit.
		expect(standard / 0.45).toBeCloseTo(1);
		expect(hd / 0.45).toBeCloseTo(0.5);
	});

	it("keeps the rendered label point size across quality modes", () => {
		const labelPt = (pxPerCm: number, pagePxPerCm: number) => {
			const unit = pageLabelUnit(pxPerCm, 0.45);
			const groupScale = (0.45 * pagePxPerCm) / pxPerCm;
			const pagePx = (11 / unit) * groupScale;
			return (pagePx / pagePxPerCm / 2.54) * 72;
		};
		expect(labelPt(32, 200 / 2.54)).toBeCloseTo(9.75, 1);
		expect(labelPt(64, 300 / 2.54)).toBeCloseTo(9.75, 1);
	});
});

describe("formatScaleRatio", () => {
	it("formats whole and fractional ratios", () => {
		expect(formatScaleRatio(1)).toBe("1:1");
		expect(formatScaleRatio(0.5)).toBe("1:2");
		expect(formatScaleRatio(0.4)).toBe("1:2.5");
		expect(formatScaleRatio(0.3)).toBe("1:3.3");
	});

	it("rounds to a whole number at 10 and above", () => {
		expect(formatScaleRatio(0.1)).toBe("1:10");
		expect(formatScaleRatio(0.08)).toBe("1:13");
	});
});

describe("chooseFitBarLengthCm", () => {
	it("prefers a bar that prints 15–100 mm", () => {
		expect(chooseFitBarLengthCm(0.4)).toBe(10);
		expect(chooseFitBarLengthCm(0.1)).toBe(20);
		expect(chooseFitBarLengthCm(0.03)).toBe(50);
	});
});

describe("truePageFitsPaper", () => {
	it("detects a page that needs larger paper", () => {
		expect(truePageFitsPaper({ widthCm: 60, heightCm: 30 }, "a4")).toBe(false);
		expect(truePageFitsPaper({ widthCm: 20, heightCm: 15 }, "a4")).toBe(true);
		expect(truePageFitsPaper({ widthCm: 27, heightCm: 20 }, "letter")).toBe(
			true,
		);
	});
});

describe("paper sizes", () => {
	it("matches ISO A4 and US Letter", () => {
		expect(PAPER_SIZES_CM.a4.widthCm).toBe(21);
		expect(PAPER_SIZES_CM.a4.heightCm).toBe(29.7);
		expect(PAPER_SIZES_CM.letter.widthCm).toBeCloseTo(21.59);
	});
});
