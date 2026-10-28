import {
	type DisplayUnits,
	displayToCm,
	type Point,
	PX_PER_CM,
} from "./geometry";

/**
 * The canvas-edge rulers (F-03 "Edge Rule"). Pure 1-2-5 cadence + tick math so
 * the top/left rules and the Scale Tag are deterministic and unit-tested.
 *
 * Labels are **world coordinates** in the active display unit; the tick
 * positions are exact (`cm × PX_PER_CM × scale + stage offset`). The rules are
 * screen chrome: they never rotate with the content and are not exported.
 */

/** 1-2-5 major lengths, in the active display unit. */
export const RULER_MAJOR_STEPS = [
	1, 2, 5, 10, 20, 50, 100, 200, 500, 1000,
] as const;

/** The chosen major step must be at least this wide on screen. */
export const RULER_MAJOR_MIN_PX = 64;

/** Labels this close to an edge would clip; the tick still draws. */
export const RULER_LABEL_INSET_PX = 24;

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
	/** Minor ticks per major (4 for mantissa 2, 5 otherwise). */
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
}

export interface RulerTicks {
	majorLabel: number;
	majorCm: number;
	minorLabel: number;
	minorCm: number;
	subdivisions: number;
	units: DisplayUnits;
	top: RulerTick[];
	left: RulerTick[];
	/** Labels that are actually rendered (edge-clipped labels excluded). */
	topLabels: string[];
	leftLabels: string[];
}

/** The leading 1/2/5 mantissa of a step (20 → 2, 500 → 5). */
function mantissa(value: number): number {
	const exponent = Math.floor(Math.log10(Math.abs(value)));
	const normalized = value / 10 ** exponent;
	return Math.round(normalized);
}

/**
 * Pick the smallest 1-2-5 major step whose screen length is at least
 * {@link RULER_MAJOR_MIN_PX}. Subdivide 4× for mantissa 2, 5× otherwise, which
 * keeps minor ticks ~16–32 px across the app's 0.1×–8× zoom range.
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
	const subdivisions = mantissa(major) === 2 ? 4 : 5;
	const minor = major / subdivisions;
	return {
		majorLabel: major,
		majorCm: displayToCm(major, units),
		minorLabel: minor,
		minorCm: displayToCm(minor, units),
		subdivisions,
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
		ticks.push({
			value,
			px: cm * PX_PER_CM * scale + safeOffset,
			label: formatRulerLabel(value),
			major: isMajorValue(value, step.majorLabel),
			origin: Math.abs(value) < 1e-9,
		});
	}
	return ticks;
}

/**
 * Build the top and left ruler ticks for a viewport. `viewport` is the stage
 * transform (screen offset in px); `size` is the canvas pane size.
 */
export function buildRulerTicks(
	scale: number,
	units: DisplayUnits,
	size: { width: number; height: number },
	viewport: Point,
): RulerTicks {
	const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
	const step = chooseRulerStep(safeScale, units);
	const top = buildAxisTicks(safeScale, units, size.width, viewport.x, step);
	const left = buildAxisTicks(safeScale, units, size.height, viewport.y, step);
	const labelVisible = (tick: RulerTick, length: number) =>
		tick.major &&
		tick.px >= RULER_LABEL_INSET_PX &&
		tick.px <= length - RULER_LABEL_INSET_PX;
	return {
		...step,
		units,
		top,
		left,
		topLabels: top
			.filter((tick) => labelVisible(tick, size.width))
			.map((tick) => tick.label),
		leftLabels: left
			.filter((tick) => labelVisible(tick, size.height))
			.map((tick) => tick.label),
	};
}
