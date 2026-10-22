import sharp from "sharp";
import {
	type Bounds,
	isBackground,
	removeBackground,
	sampleBackgroundColor,
	trimBounds,
} from "./pixels.ts";

/**
 * Deterministic image quality analyzer (P5-02). No AI: resolution, background
 * uniformity, alpha, trim, aspect vs the cm footprint, rotation/skew and
 * shadow/perspective signals are all measured from pixels.
 */

export type AnalyzeKind = "pedal" | "board";

export type AspectVerdict = "pass" | "flag" | "reject";

export type AnalyzeOptions = {
	kind: AnalyzeKind;
	widthCm: number;
	heightCm: number;
	/** Per-channel background tolerance. */
	tolerance?: number;
	minLongEdge?: number;
};

export type AnalyzeResult = {
	version: 1;
	kind: AnalyzeKind;
	footprintCm: { width: number; height: number };
	image: { width: number; height: number; longEdge: number; hasAlpha: boolean };
	alpha: { transparentRatio: number };
	background: {
		color: { r: number; g: number; b: number };
		uniformity: number;
	};
	trim: Bounds | null;
	whitespaceRatio: number;
	aspect: {
		image: number | null;
		expected: number;
		error: number | null;
		verdict: AspectVerdict;
	};
	rotationDeg: number | null;
	perspectiveError: number | null;
	shadowRatio: number | null;
	verdict: "accept" | "flag" | "reject";
	reasons: string[];
};

export const ANALYZER_DEFAULTS = {
	minLongEdge: 800,
	tolerance: 32,
	aspectPass: 0.1,
	aspectFlag: 0.15,
	rotationPassDeg: 2,
	boardPerspectiveReject: 0.08,
	perspectiveFlag: 0.06,
} as const;

function borderPixels(width: number, height: number): Array<[number, number]> {
	const points: Array<[number, number]> = [];
	for (let x = 0; x < width; x++) {
		points.push([x, 0], [x, height - 1]);
	}
	for (let y = 1; y < height - 1; y++) {
		points.push([0, y], [width - 1, y]);
	}
	return points;
}

function backgroundUniformity(
	data: Uint8Array,
	width: number,
	height: number,
	background: { r: number; g: number; b: number },
	tolerance: number,
): number {
	const points = borderPixels(width, height);
	let matched = 0;
	for (const [x, y] of points) {
		const i = (y * width + x) * 4;
		if (
			data[i + 3] === 0 ||
			isBackground(data[i], data[i + 1], data[i + 2], background, tolerance)
		) {
			matched++;
		}
	}
	return points.length > 0 ? matched / points.length : 0;
}

function regressionSlope(
	points: Array<{ x: number; y: number }>,
): number | null {
	if (points.length < 8) return null;
	const meanY = points.reduce((sum, point) => sum + point.y, 0) / points.length;
	const meanX = points.reduce((sum, point) => sum + point.x, 0) / points.length;
	let numerator = 0;
	let denominator = 0;
	for (const point of points) {
		numerator += (point.y - meanY) * (point.x - meanX);
		denominator += (point.y - meanY) ** 2;
	}
	if (denominator === 0) return null;
	return numerator / denominator;
}

function skewDegrees(
	alpha: Uint8Array,
	width: number,
	bounds: Bounds,
): number | null {
	const left: Array<{ x: number; y: number }> = [];
	const right: Array<{ x: number; y: number }> = [];
	const startY = bounds.top + Math.round(bounds.height * 0.2);
	const endY = bounds.top + Math.round(bounds.height * 0.8);
	for (let y = startY; y < endY; y++) {
		let first = -1;
		let last = -1;
		for (let x = bounds.left; x < bounds.left + bounds.width; x++) {
			if (alpha[(y * width + x) * 4 + 3] > 0) {
				if (first === -1) first = x;
				last = x;
			}
		}
		if (first >= 0) {
			left.push({ x: first, y });
			right.push({ x: last, y });
		}
	}
	const slopes = [regressionSlope(left), regressionSlope(right)].filter(
		(value): value is number => value !== null,
	);
	if (slopes.length === 0) return null;
	const slope = slopes.reduce((sum, value) => sum + value, 0) / slopes.length;
	return Math.abs((Math.atan(slope) * 180) / Math.PI);
}

function rowWidth(
	alpha: Uint8Array,
	width: number,
	y: number,
	bounds: Bounds,
): number {
	let first = -1;
	let last = -1;
	for (let x = bounds.left; x < bounds.left + bounds.width; x++) {
		if (alpha[(y * width + x) * 4 + 3] > 0) {
			if (first === -1) first = x;
			last = x;
		}
	}
	return first >= 0 ? last - first + 1 : 0;
}

function perspectiveError(
	alpha: Uint8Array,
	width: number,
	bounds: Bounds,
): number | null {
	const topRows = Math.max(1, Math.round(bounds.height * 0.1));
	const bottomRows = Math.max(1, Math.round(bounds.height * 0.1));
	const average = (from: number, count: number): number => {
		let sum = 0;
		for (let y = from; y < from + count; y++) {
			sum += rowWidth(alpha, width, y, bounds);
		}
		return sum / count;
	};
	const top = average(bounds.top, topRows);
	const bottom = average(bounds.top + bounds.height - bottomRows, bottomRows);
	const denominator = Math.max(top, bottom);
	if (denominator === 0) return null;
	return Math.abs(top - bottom) / denominator;
}

function shadowRatio(
	data: Uint8Array,
	width: number,
	height: number,
	bounds: Bounds,
	background: { r: number; g: number; b: number },
): number | null {
	const ring = 4;
	let samples = 0;
	let dark = 0;
	const bgLuma =
		0.2126 * background.r + 0.7152 * background.g + 0.0722 * background.b;
	for (let y = bounds.top - ring; y < bounds.top + bounds.height + ring; y++) {
		for (
			let x = bounds.left - ring;
			x < bounds.left + bounds.width + ring;
			x++
		) {
			const inside =
				x >= bounds.left &&
				x < bounds.left + bounds.width &&
				y >= bounds.top &&
				y < bounds.top + bounds.height;
			if (inside || x < 0 || y < 0 || x >= width || y >= height) continue;
			const i = (y * width + x) * 4;
			if (data[i + 3] === 0) continue;
			samples++;
			const luma =
				0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
			if (bgLuma - luma > 20) dark++;
		}
	}
	return samples > 0 ? dark / samples : null;
}

function aspectVerdict(error: number): AspectVerdict {
	if (error <= ANALYZER_DEFAULTS.aspectPass) return "pass";
	if (error <= ANALYZER_DEFAULTS.aspectFlag) return "flag";
	return "reject";
}

export async function analyzeImage(
	input: Buffer | string,
	options: AnalyzeOptions,
): Promise<AnalyzeResult> {
	const tolerance = options.tolerance ?? ANALYZER_DEFAULTS.tolerance;
	const minLongEdge = options.minLongEdge ?? ANALYZER_DEFAULTS.minLongEdge;
	const metadata = await sharp(input).metadata();
	const { data, info } = await sharp(input)
		.rotate()
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });
	const width = info.width;
	const height = info.height;
	const longEdge = Math.max(width, height);
	const pixels = new Uint8Array(data);
	const background = sampleBackgroundColor(pixels, width, height);
	const uniformity = backgroundUniformity(
		pixels,
		width,
		height,
		background,
		tolerance,
	);

	let transparent = 0;
	for (let i = 3; i < pixels.length; i += 4) {
		if (pixels[i] < 250) transparent++;
	}
	const transparentRatio = transparent / (width * height);

	// A transparent border means the source is already a cutout; otherwise
	// flood-fill the border-connected background into transparency.
	const transparentBorder =
		borderPixels(width, height).filter(
			([x, y]) => pixels[(y * width + x) * 4 + 3] === 0,
		).length / borderPixels(width, height).length;
	if (transparentBorder < 0.25) {
		removeBackground(pixels, width, height, background, tolerance);
	}

	const bounds = trimBounds(pixels, width, height);
	const reasons: string[] = [];

	if (longEdge < minLongEdge) {
		reasons.push(
			`reject:long edge ${longEdge}px is below the ${minLongEdge}px minimum`,
		);
	}
	if (!bounds) {
		return {
			version: 1,
			kind: options.kind,
			footprintCm: { width: options.widthCm, height: options.heightCm },
			image: {
				width,
				height,
				longEdge,
				hasAlpha: metadata.hasAlpha ?? false,
			},
			alpha: { transparentRatio },
			background: { color: background, uniformity },
			trim: null,
			whitespaceRatio: 1,
			aspect: {
				image: null,
				expected: options.widthCm / options.heightCm,
				error: null,
				verdict: "reject",
			},
			rotationDeg: null,
			perspectiveError: null,
			shadowRatio: null,
			verdict: "reject",
			reasons: [...reasons, "reject:no visible foreground after trim"],
		};
	}

	const imageAspect = bounds.width / bounds.height;
	const expected = options.widthCm / options.heightCm;
	const error = Math.abs(imageAspect - expected) / expected;
	const aspect = aspectVerdict(error);
	if (aspect === "reject") {
		reasons.push(
			`reject:aspect ${imageAspect.toFixed(2)} vs footprint ${expected.toFixed(2)} (${Math.round(error * 100)}% off)`,
		);
	} else if (aspect === "flag") {
		reasons.push(
			`flag:aspect ${imageAspect.toFixed(2)} vs footprint ${expected.toFixed(2)} (${Math.round(error * 100)}% off)`,
		);
	}

	if (uniformity < 0.8) {
		reasons.push(
			`reject:background is not uniform (${Math.round(uniformity * 100)}% border match)`,
		);
	} else if (uniformity < 0.92) {
		reasons.push(
			`flag:background is uneven (${Math.round(uniformity * 100)}% border match)`,
		);
	}

	const rotation = skewDegrees(pixels, width, bounds);
	if (rotation !== null && rotation > ANALYZER_DEFAULTS.rotationPassDeg) {
		reasons.push(`reject:rotation/skew ${rotation.toFixed(1)}° exceeds 2°`);
	}

	const perspective = perspectiveError(pixels, width, bounds);
	if (perspective !== null) {
		if (
			perspective >
			(options.kind === "board"
				? ANALYZER_DEFAULTS.boardPerspectiveReject
				: 0.12)
		) {
			reasons.push(
				`reject:perspective distortion ${Math.round(perspective * 100)}% — re-source a top-down image`,
			);
		} else if (perspective > ANALYZER_DEFAULTS.perspectiveFlag) {
			reasons.push(
				`flag:possible perspective ${Math.round(perspective * 100)}%`,
			);
		}
	}

	const shadow = shadowRatio(pixels, width, height, bounds, background);
	if (shadow !== null && shadow > 0.15) {
		reasons.push(
			`flag:shadow signal (${Math.round(shadow * 100)}% darker ring pixels)`,
		);
	}

	if (options.kind === "board") {
		const coverage = (bounds.width * bounds.height) / (width * height);
		if (coverage < 0.25) {
			reasons.push(
				"flag:board image does not fill the frame — confirm it is top-down and empty on the contact sheet",
			);
		} else {
			reasons.push(
				"flag:board top-down/empty check requires the contact-sheet reviewer",
			);
		}
	}

	const rejected = reasons.some((reason) => reason.startsWith("reject:"));
	const flagged = reasons.some((reason) => reason.startsWith("flag:"));
	return {
		version: 1,
		kind: options.kind,
		footprintCm: { width: options.widthCm, height: options.heightCm },
		image: { width, height, longEdge, hasAlpha: metadata.hasAlpha ?? false },
		alpha: { transparentRatio },
		background: { color: background, uniformity },
		trim: bounds,
		whitespaceRatio: 1 - (bounds.width * bounds.height) / (width * height),
		aspect: { image: imageAspect, expected, error, verdict: aspect },
		rotationDeg: rotation,
		perspectiveError: perspective,
		shadowRatio: shadow,
		verdict: rejected ? "reject" : flagged ? "flag" : "accept",
		reasons,
	};
}
