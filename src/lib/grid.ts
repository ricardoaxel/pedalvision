import { PX_PER_CM } from "./geometry";

/**
 * The dot grid's level-of-detail math, kept pure so the canvas has one source
 * for its crossfaded levels.
 */

/** Fixed grid steps offered in the UI (cm). */
export const GRID_STEPS = [1, 2, 5, 10, 20] as const;
export type GridStepCm = (typeof GRID_STEPS)[number];
export const DEFAULT_GRID_STEP_CM: GridStepCm = 5;

export function isGridStepCm(value: unknown): value is GridStepCm {
	return (
		typeof value === "number" &&
		(GRID_STEPS as readonly number[]).includes(value)
	);
}

/** The coarser grid level is always at or above this on-screen pitch. */
export const MIN_GRID_SCREEN_PITCH = 16;

export interface GridLevels {
	/** Grid level (0 = the selected step cell). */
	level: number;
	/** 0–1 crossfade toward the coarser level. */
	frac: number;
	/** Fine-level dot spacing in screen px at the current zoom. */
	fineStepPx: number;
	/** Coarse-level dot spacing in screen px at the current zoom. */
	coarseStepPx: number;
}

/** The cell size the eye reads as "the grid" (the more opaque level), in cm. */
export function gridCellCm(
	scale: number,
	stepCm: GridStepCm = DEFAULT_GRID_STEP_CM,
): number {
	const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
	const { frac, fineStepPx, coarseStepPx } = gridLevels(safeScale, stepCm);
	const fineCellCm = fineStepPx / (PX_PER_CM * safeScale);
	const coarseCellCm = coarseStepPx / (PX_PER_CM * safeScale);
	return frac > 0.5 ? coarseCellCm : fineCellCm;
}

/** Resolve the two crossfaded dot-grid levels at `scale`. */
export function gridLevels(
	scale: number,
	stepCm: GridStepCm = DEFAULT_GRID_STEP_CM,
): GridLevels {
	const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
	const raw = stepCm * PX_PER_CM * safeScale;
	const k = Math.max(0, Math.log2(MIN_GRID_SCREEN_PITCH / raw));
	const level = Math.floor(k);
	const frac = k - level;
	const fineStepPx = raw * 2 ** level;
	return {
		level,
		frac,
		fineStepPx,
		coarseStepPx: fineStepPx * 2,
	};
}
