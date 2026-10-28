import { GRID_PITCH } from "../styles/theme";

/**
 * The dot grid's level-of-detail math, kept pure so the canvas has one source
 * for its crossfaded levels.
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
}

/** Resolve the two crossfaded dot-grid levels at `scale`. */
export function gridLevels(scale: number): GridLevels {
	const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
	const raw = GRID_PITCH * safeScale;
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
