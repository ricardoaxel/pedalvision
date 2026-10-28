import { RULER_GUTTER } from "../styles/theme";
import { type DisplayUnits, displayToCm, PX_PER_CM } from "./geometry";

/**
 * The bottom pencil-axis (F-03 "Pencil Margin"). Pure 1-2-5 cadence + tick math,
 * deliberately sparse: the sheet is passive scale reassurance, not a measuring
 * tool. There is a single bottom axis; it carries `0` and a few bare world
 * labels, with one unit at the line's end.
 *
 * Labels are world coordinates in the active display unit; tick positions are
 * exact (`cm × PX_PER_CM × scale + stage offset`). DOM/SVG only; never exported.
 */

/** 1-2-5 major lengths, in the active display unit. */
export const RULER_MAJOR_STEPS = [
	1, 2, 5, 10, 20, 50, 100, 200, 500, 1000,
] as const;

/** Pencil cadence: a major label is at least this wide on screen. */
export const RULER_MAJOR_MIN_PX = 280;

/** Half-major minor ticks (no minor labels). */
export const RULER_SUBDIVISIONS = 2;

/** The origin sits at the stage's left edge; this is label-air only. */
export const RULER_AXIS_START_INSET_PX = 16;

/** Keep the last label clear of the right edge/unit mark. */
export const RULER_BOTTOM_END_INSET_PX = 20;

/** Hard guard against pathological viewport/scale combinations. */
export const RULER_MAX_TICKS = 400;

export interface RulerStep {
	majorLabel: number;
	majorCm: number;
	minorLabel: number;
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
	/** True when this major label (or the origin) is rendered. */
	showLabel: boolean;
}

export interface RulerTicks {
	majorLabel: number;
	majorCm: number;
	minorLabel: number;
	minorCm: number;
	subdivisions: number;
	units: DisplayUnits;
	bottom: RulerTick[];
	/** Rendered bare label text (the unit is a separate axis-end mark). */
	bottomLabels: string[];
}

export interface RulerInput {
	stageWidth: number;
	offsetX: number;
}

/**
 * Pick the smallest 1-2-5 major step whose screen length is at least
 * {@link RULER_MAJOR_MIN_PX}, then subdivide in half. At 1× this is 100/50 cm.
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
		const origin = Math.abs(value) < 1e-9;
		ticks.push({
			value,
			px,
			label: formatRulerLabel(value),
			major,
			origin,
			showLabel:
				origin ||
				(major &&
					px >= RULER_AXIS_START_INSET_PX &&
					px <= safeLength - RULER_BOTTOM_END_INSET_PX),
		});
	}
	return ticks;
}

/**
 * Build the bottom axis for a desktop stage. The line spans the full canvas
 * width; labels are bare and the unit is rendered at the axis end.
 */
export function buildRulerTicks(
	scale: number,
	units: DisplayUnits,
	input: RulerInput,
): RulerTicks {
	const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
	const step = chooseRulerStep(safeScale, units);
	const bottomLength = input.stageWidth + RULER_GUTTER.x;
	const bottom = buildAxisTicks(
		safeScale,
		units,
		bottomLength,
		input.offsetX + RULER_GUTTER.x,
		step,
	);
	const bottomLabels = bottom
		.filter((tick) => tick.showLabel)
		.map((tick) => (tick.origin ? "0" : tick.label));
	return {
		...step,
		units,
		bottom,
		bottomLabels,
	};
}
