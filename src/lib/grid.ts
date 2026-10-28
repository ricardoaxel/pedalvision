import { GRID_PITCH } from "../styles/theme";
import { PX_PER_CM } from "./geometry";

/**
 * The dot grid's level-of-detail math (F-03 "Edge Rule"). Kept pure so the
 * canvas and the Scale Tag's "grid N cm" readout can never disagree.
 */

/** The coarser grid level is always at or above this on-screen pitch. */
export const MIN_GRID_SCREEN_PITCH = 16;

export interface GridLevels {
	/** Grid level (0 = the base `GRID_PITCH` cell). */
	level: number;
	/** 0–1 crossfade toward the coarser level. */
	frac: number;
	/** Fine-level dot spacing in screen px at the current zoom. */
	fineStepPx: number;
	/** Coarse-level dot spacing in screen px at the current zoom. */
	coarseStepPx: number;
	/** Fine-level cell size in cm. */
	fineCellCm: number;
	/** Coarse-level cell size in cm. */
	coarseCellCm: number;
}

/** Resolve the two crossfaded dot-grid levels at `scale`. */
export function gridLevels(scale: number): GridLevels {
	const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
	const raw = GRID_PITCH * safeScale;
	const k = Math.max(0, Math.log2(MIN_GRID_SCREEN_PITCH / raw));
	const level = Math.floor(k);
	const frac = k - level;
	const fineStepPx = raw * 2 ** level;
	const fineCellCm = (GRID_PITCH * 2 ** level) / PX_PER_CM;
	return {
		level,
		frac,
		fineStepPx,
		coarseStepPx: fineStepPx * 2,
		fineCellCm,
		coarseCellCm: fineCellCm * 2,
	};
}

/**
 * The cell size the eye reads as "the grid" — the more opaque of the two
 * crossfaded levels. At 1× this is 6 cm (`GRID_PITCH 24 / PX_PER_CM 4`).
 */
export function gridCellCm(scale: number): number {
	const { frac, fineCellCm, coarseCellCm } = gridLevels(scale);
	return frac > 0.5 ? coarseCellCm : fineCellCm;
}
