import {
	type ExportFormat,
	type ExportPlan,
	SCALE_BAR_LONG_CM,
	SCALE_BAR_SHORT_BELOW_CM,
	SCALE_BAR_SHORT_CM,
} from "./exportScene";
import { cmToDisplay, type DisplayUnits } from "./geometry";

/**
 * Q-02 (export scale reference). The P3-01 "Print Ticket" export draws a
 * true-length drafting bar, but the old label was a bare `${n} cm`: it ignored
 * the app-wide display unit and never told the user how to print the artifact at
 * true scale. This pure helper owns the reference copy so the renderer, the
 * panel and the tests share one source of truth.
 */

export interface ExportScaleReference {
	/** True physical length of the drawn bar (cm). */
	lengthCm: number;
	/** The bar length in the active display unit, e.g. "10 cm" / "3.94 in". */
	primaryLabel: string;
	/** Scale word, kept separate so the renderer can emphasize it. */
	scaleLabel: string;
	/** Printed ratio, always 1:1 for a true-scale artifact. */
	ratioLabel: string;
	/** The unambiguous print condition for this format. */
	printHint: string;
	/** One-line caption under the bar. */
	detailLabel: string;
}

/** Pick the drafting bar length for a content width (10 cm, or 5 cm when narrow). */
export function scaleBarLengthCm(contentWidthCm: number): number {
	return contentWidthCm >= SCALE_BAR_SHORT_BELOW_CM
		? SCALE_BAR_LONG_CM
		: SCALE_BAR_SHORT_CM;
}

function formatLength(cm: number, units: DisplayUnits): string {
	return `${cmToDisplay(cm, units)} ${units}`;
}

/** PPI shown on the artifact: the plan's effective raster density, rounded. */
export function exportScalePpi(plan: ExportPlan): number {
	return Math.round(plan.outputPpi);
}

/**
 * Build the artifact's scale reference. `units` is the app-wide display unit:
 * it only changes which unit is primary on the bar; both units are always
 * printed so a plan stays measurable across regions.
 */
export function buildExportScaleReference(
	plan: ExportPlan,
	format: ExportFormat,
	units: DisplayUnits,
): ExportScaleReference {
	const lengthCm = scaleBarLengthCm(plan.contentBoundsCm.widthCm);
	const primaryLabel = formatLength(lengthCm, units);
	const ratioLabel = "1:1";
	// Keep the one instruction a printed plan needs in front; the PPI is a
	// parenthetical (a print-dialog users rarely see) rather than a trailing
	// number that invites guessing. PDF pages are physically sized, so its page
	// geometry already carries the scale.
	const printHint =
		format === "pdf"
			? "PRINT AT 100%"
			: `PRINT AT 100% (${exportScalePpi(plan)} PPI)`;

	return {
		lengthCm,
		primaryLabel,
		scaleLabel: "SCALE",
		ratioLabel,
		printHint,
		detailLabel: `${ratioLabel} · ${printHint}`,
	};
}
