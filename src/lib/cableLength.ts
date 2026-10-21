import type { Point } from "./geometry";

/**
 * Cable length model (P4-03, F12). Length is **derived from the graph**, never
 * from the drawn screen curve and never stored: the straight-line world-cm
 * distance between the two jack endpoints, plus the physical plug overhang at
 * both ends, plus a stated slack allowance, rounded **up** to a sold length.
 *
 * Why straight-line: a patch cable is flexible, so the drawn cubic is a routing
 * glyph, not the cable's path. The jack-to-jack span is the honest lower bound a
 * buyer can check against a tape measure.
 */

/**
 * Off-the-shelf patch-cable lengths (cm). The list is deliberately short:
 * these are the lengths a shop actually stocks. Anything longer is reported as
 * a custom length rather than silently clamped to 60 cm.
 */
export const SOLD_CABLE_LENGTHS_CM = [10, 15, 20, 30, 60] as const;

/** Plug body overhang at each end (cm) — the barrel sits outside the jack. */
export const PLUG_OVERHANG_CM = 1.5;

/** Slack added for routing/bends, as a fraction of the span + plugs. */
export const CABLE_SLACK_RATIO = 0.1;

/** Never add less than this much slack (cm), even on a very short run. */
export const CABLE_MIN_SLACK_CM = 1;

/** Floating-point tolerance when comparing against a sold length. */
const EPSILON = 1e-6;

export interface CableLengthResult {
	/** Straight-line jack-to-jack distance in world cm. */
	distanceCm: number;
	/** Total plug overhang added (both ends). */
	plugOverhangCm: number;
	/** Slack added for routing. */
	slackCm: number;
	/** distance + plug overhang + slack (the length to buy). */
	requiredCm: number;
	/** The next sold length, or null when the run needs a custom length. */
	lengthCm: number | null;
	/** True when no sold length covers the requirement (>60 cm). */
	custom: boolean;
}

/**
 * Round a requirement **up** to the next sold length. Returns null above the
 * longest stocked length; the caller reports the calculated requirement.
 */
export function roundUpToSoldLength(requiredCm: number): number | null {
	for (const length of SOLD_CABLE_LENGTHS_CM) {
		if (requiredCm <= length + EPSILON) return length;
	}
	return null;
}

/**
 * Compute the length of one cable from its two anchor points (world cm).
 * Keep the components exposed so the UI can state its method ("straight-line +
 * 3 cm plugs + 10% slack") instead of presenting a magic number.
 */
export function cableLengthForPoints(
	from: Point,
	to: Point,
): CableLengthResult {
	const distanceCm = Math.hypot(to.x - from.x, to.y - from.y);
	const plugOverhangCm = PLUG_OVERHANG_CM * 2;
	const baseCm = distanceCm + plugOverhangCm;
	const slackCm = Math.max(CABLE_MIN_SLACK_CM, baseCm * CABLE_SLACK_RATIO);
	const requiredCm = baseCm + slackCm;
	const lengthCm = roundUpToSoldLength(requiredCm);
	return {
		distanceCm,
		plugOverhangCm,
		slackCm,
		requiredCm,
		lengthCm,
		custom: lengthCm === null,
	};
}
