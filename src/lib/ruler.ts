import { RULER_GUTTER } from "../styles/theme";
import { type DisplayUnits, displayToCm, PX_PER_CM } from "./geometry";

/**
 * The left + bottom sheet-margin rulers (F-03 "Sheet Margin"). Pure 1-2-5
 * cadence + tick math so the margins and the bottom-right scale block are
 * deterministic and unit-tested.
 *
 * Labels are **world coordinates** in the active display unit; tick positions
 * are exact (`cm × PX_PER_CM × scale + stage offset`). The rulers are screen
 * chrome: they never rotate with content and are not exported.
 */

/** 1-2-5 major lengths, in the active display unit. */
export const RULER_MAJOR_STEPS = [
	1, 2, 5, 10, 20, 50, 100, 200, 500, 1000,
] as const;

/** Sparse drafting cadence: a major step is at least this wide on screen. */
export const RULER_MAJOR_MIN_PX = 120;

/** Half-major minor ticks (no minor labels). */
export const RULER_SUBDIVISIONS = 2;

/** Labels this close to the top/left edge would clip; the tick still draws. */
export const RULER_LABEL_INSET_PX = 20;

/** The left axis stops labelling this close to the bottom corner cell. */
export const RULER_LEFT_END_INSET_PX = 40;

/** Bottom labels start after the corner unit cell. */
export const RULER_BOTTOM_START_INSET_PX = 28;

/** Bottom labels stop before the bottom-right scale block. */
export const RULER_TITLE_BLOCK_RESERVE_PX = 400;

/** Hard guard against pathological viewport/scale combinations. */
export const RULER_MAX_TICKS = 400;

export interface RulerStep {
	/** Major length in the active display unit. */
	majorLabel: number;
	/** Major length in cm (source of truth). */
	majorCm: number;
	/** Minor length in the active display unit. */
	minorLabel: number;
	/** Minor length in cm. */
	minorCm: number;
	subdivisions: number;
	majorPx: number;
	minorPx: number;
}

export interface RulerTick {
	/** Display-unit value (may be negative). */
	value: number;
	/** Screen px along the axis. */
	px: number;
	label: string;
	major: boolean;
	origin: boolean;
	/** True when this major label fits inside the strip (rendered once). */
	showLabel: boolean;
}

export interface RulerTicks {
	majorLabel: number;
	majorCm: number;
	minorLabel: number;
	minorCm: number;
	subdivisions: number;
	units: DisplayUnits;
	left: RulerTick[];
	bottom: RulerTick[];
	leftLabels: string[];
	bottomLabels: string[];
}

export interface RulerInput {
	/** Stage width (the canvas minus the left gutter). */
	stageWidth: number;
	/** Stage height (the canvas minus the bottom gutter). */
	stageHeight: number;
	/** Stage transform offsets (screen px). */
	offsetX: number;
	offsetY: number;
}

/**
 * Pick the smallest 1-2-5 major step whose screen length is at least
 * {@link RULER_MAJOR_MIN_PX}, then subdivide in half. At 1× this is 50/25 cm;
 * at 0.1× 500/250 cm; at 8× 5/2.5 cm.
 */
export function chooseRulerStep(scale: number, units: DisplayUnits): RulerStep {
	const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
	let major = RULER_MAJOR_STEPS[RULER_MAJOR_STEPS.length - 1] as number;
	for (const candidate of RULER_MAJOR_STEPS) {
		const px = displayToCm(candidate, units) * PX_PER_CM * safeScale;
		if (px >= RULER_MAJOR_MIN_PX) {
			major = candidate;
			break;
		}
	}
	const minor = major / RULER_SUBDIVISIONS;
	return {
		majorLabel: major,
		majorCm: displayToCm(major, units),
		minorLabel: minor,
		minorCm: displayToCm(minor, units),
		subdivisions: RULER_SUBDIVISIONS,
		majorPx: displayToCm(major, units) * PX_PER_CM * safeScale,
		minorPx: displayToCm(minor, units) * PX_PER_CM * safeScale,
	};
}

/**
 * Format a ruler label: up to 2 decimals, no trailing zeros, U+2212 for
 * negatives (typographic minus, never a hyphen).
 */
export function formatRulerLabel(value: number): string {
	const rounded = Math.round(value * 100) / 100;
	const text = Number.isInteger(rounded)
		? String(rounded)
		: String(rounded).replace(/0+$/, "").replace(/\.$/, "");
	return text.startsWith("-") ? `\u2212${text.slice(1)}` : text;
}

function isMajorValue(value: number, major: number): boolean {
	const ratio = value / major;
	return Math.abs(ratio - Math.round(ratio)) < 1e-9;
}

function buildAxisTicks(
	scale: number,
	units: DisplayUnits,
	lengthPx: number,
	offsetPx: number,
	step: RulerStep,
	startInset: number,
	endInset: number,
): RulerTick[] {
	const pxPerDisplay =
		(units === "in" ? displayToCm(1, units) : 1) * PX_PER_CM * scale;
	const safeLength = Number.isFinite(lengthPx) ? Math.max(0, lengthPx) : 0;
	const safeOffset = Number.isFinite(offsetPx) ? offsetPx : 0;
	const minValue = (0 - safeOffset) / pxPerDisplay;
	const maxValue = (safeLength - safeOffset) / pxPerDisplay;
	const first = Math.ceil(minValue / step.minorLabel - 1e-9);
	const last = Math.floor(maxValue / step.minorLabel + 1e-9);
	const ticks: RulerTick[] = [];
	for (let index = first; index <= last; index++) {
		if (ticks.length >= RULER_MAX_TICKS) break;
		const value = index * step.minorLabel;
		const cm = displayToCm(value, units);
		const px = cm * PX_PER_CM * scale + safeOffset;
		const major = isMajorValue(value, step.majorLabel);
		ticks.push({
			value,
			px,
			label: formatRulerLabel(value),
			major,
			origin: Math.abs(value) < 1e-9,
			showLabel: major && px >= startInset && px <= safeLength - endInset,
		});
	}
	return ticks;
}

/**
 * Build the left and bottom ticks for a desktop stage. `stageWidth`/
 * `stageHeight` are the inset stage size; the bottom strip spans the full
 * canvas (stage + left gutter), and the bottom labels reserve the scale block.
 */
export function buildRulerTicks(
	scale: number,
	units: DisplayUnits,
	input: RulerInput,
): RulerTicks {
	const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
	const step = chooseRulerStep(safeScale, units);
	const left = buildAxisTicks(
		safeScale,
		units,
		input.stageHeight,
		input.offsetY,
		step,
		RULER_LABEL_INSET_PX,
		RULER_LEFT_END_INSET_PX,
	);
	const bottomLength = input.stageWidth + RULER_GUTTER.x;
	const bottom = buildAxisTicks(
		safeScale,
		units,
		bottomLength,
		input.offsetX + RULER_GUTTER.x,
		step,
		RULER_BOTTOM_START_INSET_PX,
		RULER_TITLE_BLOCK_RESERVE_PX,
	);
	return {
		...step,
		units,
		left,
		bottom,
		leftLabels: left.filter((tick) => tick.showLabel).map((tick) => tick.label),
		bottomLabels: bottom
			.filter((tick) => tick.showLabel)
			.map((tick) => tick.label),
	};
}
