import { cmToPx, type DisplayUnits, displayToCm } from "./geometry";

/**
 * The bottom-axis/mobile readout values (F-03 "Pencil Margin"). Pure so the
 * bar and the zoom readout are unit-tested without a DOM. cm remains the source
 * of truth: the round bar label is a display-unit candidate, converted back to
 * exact cm with `displayToCm`.
 */

/**
 * Round lengths offered to the scale rule, in the **active display unit**. The
 * same numbers read as cm or inches; the chosen value is converted to cm.
 */
export const SCALE_BAR_CANDIDATES = [1, 2, 5, 10, 20, 50, 100, 200] as const;

/** Prefer the largest candidate whose screen length fits this budget. */
export const SCALE_BAR_MAX_PX = 120;

export interface ScaleBarReading {
	/** Exact stored length in cm (source of truth). */
	lengthCm: number;
	/** The round label in the active display unit. */
	lengthLabel: number;
	/** Which unit the round label is expressed in. */
	units: DisplayUnits;
	/** Drawn screen length at the current zoom (`cm × PX_PER_CM × scale`). */
	barPx: number;
}

/**
 * Pick the round scale-rule length for the current zoom. The bar is always
 * drawn at its true length (`barPx = cmToPx(lengthCm, scale)`), so the label
 * never lies about the scale; only the round candidate steps as zoom changes.
 */
export function chooseScaleBar(
	scale: number,
	units: DisplayUnits,
	maxPx = SCALE_BAR_MAX_PX,
): ScaleBarReading {
	const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
	const budget = Number.isFinite(maxPx) && maxPx > 0 ? maxPx : SCALE_BAR_MAX_PX;
	const pxFor = (label: number) => cmToPx(displayToCm(label, units), safeScale);

	let chosen: number = SCALE_BAR_CANDIDATES[0];
	let chosenPx = pxFor(chosen);
	for (const candidate of SCALE_BAR_CANDIDATES) {
		const px = pxFor(candidate);
		if (px > budget) break;
		chosen = candidate;
		chosenPx = px;
	}

	// The app's 0.1×–8× range always fits a candidate. Beyond it, keep the
	// smallest round length rather than inventing a larger label — the bar is
	// still drawn truthfully at its true length.
	return {
		lengthCm: displayToCm(chosen, units),
		lengthLabel: chosen,
		units,
		barPx: chosenPx,
	};
}
