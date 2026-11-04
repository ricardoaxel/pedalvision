import {
	EXPORT_STANDARD_PX_PER_CM,
	type ExportPlan,
	type ExportQuality,
} from "./exportScene";

/**
 * Fit-to-page PDF planning (Q-02 rework, owner decision 2026-11-03).
 *
 * True-size pages of a 40–80 cm board do not fit A4/Letter. This module lays a
 * plan onto one standard sheet: it chooses the better orientation, scales the
 * plan into the drawing area (never above 1:1), and reserves a fixed bottom
 * band for the ruler, ratio and assumed-jack note. The renderer draws those
 * annotations in page space so they stay legible at paper size while the plan
 * itself may be reduced.
 *
 * Pure: no DOM/Konva. The same plan drives the panel readout and the artifact.
 */

export type FitPaper = "a4" | "letter";
export type PdfPaper = FitPaper | "true";
export type PageOrientation = "portrait" | "landscape";

export interface PaperSizeCm {
	widthCm: number;
	heightCm: number;
}

/** ISO A4 and US Letter, portrait values. */
export const PAPER_SIZES_CM: Record<FitPaper, PaperSizeCm> = {
	a4: { widthCm: 21, heightCm: 29.7 },
	letter: { widthCm: 21.59, heightCm: 27.94 },
};

/** 12 mm safe margin on every page edge (home printers clip ~4–6 mm). */
export const PAGE_MARGIN_CM = 1.2;

/** Reserved bottom band: ruler, caption and assumed-jack note. */
export const PAGE_BAND_CM = 2.2;

/** Bottom-band baselines measured from the page bottom edge. */
export const PAGE_BAND_LAYOUT_CM = {
	note: 1.55,
	caption: 2.05,
	rule: 2.6,
} as const;

/** Raster density of the page itself (print quality, not plan density). */
export const PAGE_DPI_STANDARD = 200;
export const PAGE_DPI_HD = 300;

/** Candidate ruler lengths for a reduced plan, in real cm. */
export const FIT_BAR_CANDIDATES_CM = [10, 20, 50] as const;

export interface PdfPagePlan {
	paper: FitPaper;
	orientation: PageOrientation;
	pageWidthCm: number;
	pageHeightCm: number;
	/** Page raster pixels per cm (200/300 DPI). */
	pagePxPerCm: number;
	stageWidthPx: number;
	stageHeightPx: number;
	outputPpi: number;
	/** Printed cm per real cm (≤ 1: never enlarge a small plan). */
	printScale: number;
	ratioLabel: string;
	/** Drawing area (inside the safe margins and above the bottom band). */
	contentRectCm: { x: number; y: number; widthCm: number; heightCm: number };
	/** Top-left of the scaled plan inside the drawing area. */
	contentOriginCm: { x: number; y: number };
	/** Ruler length in real cm and the length it prints on paper. */
	barLengthCm: number;
	barPrintedLengthCm: number;
}

function pageSize(paper: FitPaper, orientation: PageOrientation): PaperSizeCm {
	const size = PAPER_SIZES_CM[paper];
	return orientation === "portrait"
		? size
		: { widthCm: size.heightCm, heightCm: size.widthCm };
}

function drawingArea(page: PaperSizeCm) {
	return {
		x: PAGE_MARGIN_CM,
		y: PAGE_MARGIN_CM,
		widthCm: page.widthCm - PAGE_MARGIN_CM * 2,
		heightCm: page.heightCm - PAGE_MARGIN_CM - PAGE_MARGIN_CM - PAGE_BAND_CM,
	};
}

function fitFor(
	plan: ExportPlan,
	paper: FitPaper,
	orientation: PageOrientation,
	quality: ExportQuality,
): Omit<PdfPagePlan, "ratioLabel"> {
	const page = pageSize(paper, orientation);
	const area = drawingArea(page);
	const printScale = Math.min(
		1,
		area.widthCm / plan.contentBoundsCm.widthCm,
		area.heightCm / plan.contentBoundsCm.heightCm,
	);
	const widthCm = plan.contentBoundsCm.widthCm * printScale;
	const heightCm = plan.contentBoundsCm.heightCm * printScale;
	const pagePxPerCm =
		(quality === "hd" ? PAGE_DPI_HD : PAGE_DPI_STANDARD) / 2.54;
	const stageWidthPx = Math.round(page.widthCm * pagePxPerCm);
	const stageHeightPx = Math.round(page.heightCm * pagePxPerCm);
	const barLengthCm = chooseFitBarLengthCm(printScale);

	return {
		paper,
		orientation,
		pageWidthCm: page.widthCm,
		pageHeightCm: page.heightCm,
		pagePxPerCm,
		stageWidthPx,
		stageHeightPx,
		outputPpi: quality === "hd" ? PAGE_DPI_HD : PAGE_DPI_STANDARD,
		printScale,
		contentRectCm: area,
		contentOriginCm: {
			x: area.x + (area.widthCm - widthCm) / 2,
			y: area.y + (area.heightCm - heightCm) / 2,
		},
		barLengthCm,
		barPrintedLengthCm: barLengthCm * printScale,
	};
}

/**
 * Pick the ruler length that prints as a usable instrument (15–100 mm). A
 * reduced plan keeps the caption readable while the bar remains measurable.
 */
export function chooseFitBarLengthCm(printScale: number): number {
	for (const lengthCm of FIT_BAR_CANDIDATES_CM) {
		const printed = lengthCm * printScale;
		if (printed >= 1.5 && printed <= 10) return lengthCm;
	}
	return FIT_BAR_CANDIDATES_CM[0];
}

/**
 * Format a fit ratio as `1:N`: one decimal below 10, a whole number at 10+,
 * and a trailing `.0` is dropped. The bar is the exact reference; this label is
 * the rounded convenience.
 */
export function formatScaleRatio(printScale: number): string {
	const safe = Number.isFinite(printScale) && printScale > 0 ? printScale : 1;
	const denominator = 1 / safe;
	if (denominator >= 9.95) return `1:${Math.round(denominator)}`;
	const rounded = Math.round(denominator * 10) / 10;
	return `1:${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}`;
}

/**
 * Lay a plan onto the chosen paper. The plan’s own orientation wins unless the
 * other orientation fits at least 2% larger (near-square plans do not flip).
 */
export function resolvePdfPage(
	plan: ExportPlan,
	options: { paper: FitPaper; quality: ExportQuality },
): PdfPagePlan {
	const prefersPortrait =
		plan.contentBoundsCm.heightCm >= plan.contentBoundsCm.widthCm;
	const preferred: PageOrientation = prefersPortrait ? "portrait" : "landscape";
	const other: PageOrientation = prefersPortrait ? "landscape" : "portrait";

	let best = fitFor(plan, options.paper, preferred, options.quality);
	const alternative = fitFor(plan, options.paper, other, options.quality);
	if (alternative.printScale > best.printScale * 1.02) best = alternative;

	return {
		...best,
		ratioLabel: formatScaleRatio(best.printScale),
	};
}

/**
 * Local label unit for a page-mode plan. The content group is scaled by
 * `printScale × pagePxPerCm / planPxPerCm`; dividing by this unit keeps item/
 * board labels at the same physical paper size in Standard and HD.
 */
export function pageLabelUnit(pxPerCm: number, printScale: number): number {
	return (EXPORT_STANDARD_PX_PER_CM / pxPerCm) * printScale;
}

/** Does the exact-cm page fit either orientation of this paper? */
export function truePageFitsPaper(
	boundsCm: { widthCm: number; heightCm: number },
	paper: FitPaper,
): boolean {
	const size = PAPER_SIZES_CM[paper];
	return (
		(boundsCm.widthCm <= size.widthCm && boundsCm.heightCm <= size.heightCm) ||
		(boundsCm.widthCm <= size.heightCm && boundsCm.heightCm <= size.widthCm)
	);
}
