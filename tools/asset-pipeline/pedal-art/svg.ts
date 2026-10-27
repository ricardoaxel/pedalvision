import {
	ART_PALETTE,
	BODY_MAX_CHROMA,
	clampChroma,
	contrastRatio,
	pickInk,
	shade,
} from "./color.ts";
import { applyCase, glyphFont, layoutText, textHeightPx } from "./glyphs.ts";
import {
	boxInsideRoundedRect,
	type PedalArtControl,
	type PedalArtSpec,
} from "./spec.ts";

/**
 * Pure spec → SVG renderer for "Catalog Specimen" pedal art.
 *
 * One orthographic top-down view: base silhouette, flat side ring, sampled body
 * fill, up to two solid dead-flat bands, flat hardware primitives, typeset text
 * as outlines. No gradients, filters, shadows, reflections, perspective,
 * screens/glows, logos or reference pixels. The app draws its own name chip and
 * jack ticks on top.
 */

export type BuildPedalArtOptions = {
	/** Long-edge pixel size. 800 = master, 350 = picker thumb. */
	longEdge?: number;
};

export type PedalArtSvg = {
	svg: string;
	width: number;
	height: number;
	longEdge: number;
	pxPerCm: number;
	bodyFill: string;
	sideFill: string;
	ink: string;
	inkContrast: number;
};

const CONTROL_ORDER: Record<PedalArtControl["kind"], number> = {
	treadle: 0,
	display: 1,
	button: 2,
	toggle: 3,
	knob: 4,
	led: 5,
	footswitch: 6,
};

const FINISH_FILL: Record<string, string> = {
	black: "#23282D",
	metal: ART_PALETTE.metalHi,
	cream: "#E7E4DE",
	white: ART_PALETTE.printLight,
};

function fmt(value: number): string {
	const rounded = Math.round(value * 1000) / 1000;
	return Object.is(rounded, -0) ? "0" : String(rounded);
}

function circle(
	cx: number,
	cy: number,
	r: number,
	fill: string,
	stroke?: string,
	strokeWidth?: number,
): string {
	const strokeAttrs = stroke
		? ` stroke="${stroke}" stroke-width="${fmt(strokeWidth ?? 1)}"`
		: "";
	return `<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(r)}" fill="${fill}"${strokeAttrs}/>`;
}

function rect(
	x: number,
	y: number,
	width: number,
	height: number,
	radius: number,
	fill: string,
	stroke?: string,
	strokeWidth?: number,
): string {
	const strokeAttrs = stroke
		? ` stroke="${stroke}" stroke-width="${fmt(strokeWidth ?? 1)}"`
		: "";
	return `<rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(width)}" height="${fmt(height)}" rx="${fmt(radius)}" fill="${fill}"${strokeAttrs}/>`;
}

function controlHalfSize(
	control: PedalArtControl,
	pxPerCm: number,
): { halfWidth: number; halfHeight: number } {
	if (control.kind === "display" || control.kind === "treadle") {
		return {
			halfWidth: (control.widthCm * pxPerCm) / 2,
			halfHeight: (control.heightCm * pxPerCm) / 2,
		};
	}
	if (control.kind === "toggle") {
		return {
			halfWidth: control.leverCm * 0.8 * pxPerCm,
			halfHeight: control.leverCm * 0.65 * pxPerCm,
		};
	}
	const radius = (control.diameterCm * pxPerCm) / 2;
	return { halfWidth: radius, halfHeight: radius };
}

function renderTextRun(
	value: string,
	centerX: number,
	centerY: number,
	sizeMm: number,
	trackingEm: number,
	weight: "medium" | "semibold",
	caseMode: "upper" | "title" | "as-is",
	ink: string,
	pxPerCm: number,
): { markup: string; height: number; width: number } {
	const sizePx = (sizeMm / 10) * pxPerCm;
	const font = glyphFont(weight);
	const run = layoutText(font, applyCase(value, caseMode), sizePx, trackingEm);
	const scale = sizePx / font.upm;
	const baseline = centerY + ((run.maxY + run.minY) / 2 / font.upm) * sizePx;
	const startX = centerX - run.widthPx / 2;
	const paths = run.glyphs
		.map(
			(glyph) =>
				`<path d="${glyph.path}" transform="translate(${fmt(startX + glyph.xPx)} ${fmt(baseline)}) scale(${fmt(scale)} ${fmt(-scale)})" fill="${ink}"/>`,
		)
		.join("");
	return {
		markup: paths,
		height: textHeightPx(font, run, sizePx),
		width: run.widthPx,
	};
}

function renderControlLabel(
	control: PedalArtControl,
	cx: number,
	cy: number,
	pxPerCm: number,
	ink: string,
	inkMeets: boolean,
	topFace: {
		x: number;
		y: number;
		width: number;
		height: number;
		radius: number;
	},
): string {
	if (!control.label || !inkMeets) return "";
	const { halfWidth, halfHeight } = controlHalfSize(control, pxPerCm);
	const sizeMm = 1.8;
	const tracking = 0.04;
	const font = glyphFont("medium");
	const sizePx = (sizeMm / 10) * pxPerCm;
	const run = layoutText(
		font,
		applyCase(control.label, "upper"),
		sizePx,
		tracking,
	);
	const textHeight = textHeightPx(font, run, sizePx);
	const gap = Math.max(1.5, 0.08 * pxPerCm);
	let textCenterX = cx;
	let textCenterY = cy;

	switch (control.labelPlacement) {
		case "above":
			textCenterY = cy - halfHeight - gap - textHeight / 2;
			break;
		case "below":
			textCenterY = cy + halfHeight + gap + textHeight / 2;
			break;
		case "left":
			textCenterX = cx - halfWidth - gap - run.widthPx / 2;
			break;
		case "right":
			textCenterX = cx + halfWidth + gap + run.widthPx / 2;
			break;
	}

	if (
		!boxInsideRoundedRect(
			topFace.x,
			topFace.y,
			topFace.width,
			topFace.height,
			topFace.radius,
			textCenterX,
			textCenterY,
			run.widthPx / 2,
			textHeight / 2,
		)
	) {
		return "";
	}

	const rendered = renderTextRun(
		control.label,
		textCenterX,
		textCenterY,
		sizeMm,
		tracking,
		"medium",
		"upper",
		ink,
		pxPerCm,
	);
	return rendered.markup;
}

function renderControl(
	control: PedalArtControl,
	pxPerCm: number,
	width: number,
	height: number,
	hairline: number,
	knobFinish: string,
	footswitchFinish: string,
): string {
	const cx = control.u * width;
	const cy = control.v * height;
	const parts: string[] = [];

	switch (control.kind) {
		case "knob": {
			const radius = (control.diameterCm * pxPerCm) / 2;
			const capFill = FINISH_FILL[knobFinish] ?? FINISH_FILL.black;
			const pointerColor =
				knobFinish === "black" ? ART_PALETTE.metalHi : ART_PALETTE.hardwareInk;
			const pointerLength = radius * 0.5;
			const radians = ((control.rotationDeg - 90) * Math.PI) / 180;
			const pointerX = cx + Math.cos(radians) * pointerLength;
			const pointerY = cy + Math.sin(radians) * pointerLength;
			// Narrow rim: the cap owns the knob, the skirt is a hairline edge.
			parts.push(
				circle(
					cx,
					cy,
					radius,
					ART_PALETTE.metal,
					ART_PALETTE.hardwareInk,
					hairline,
				),
				circle(
					cx,
					cy,
					radius * 0.9,
					capFill,
					ART_PALETTE.hardwareInk,
					hairline,
				),
				`<line x1="${fmt(cx)}" y1="${fmt(cy)}" x2="${fmt(pointerX)}" y2="${fmt(pointerY)}" stroke="${pointerColor}" stroke-width="${fmt(hairline * 1.5)}" stroke-linecap="round"/>`,
				circle(cx, cy, radius * 0.08, pointerColor),
			);
			break;
		}
		case "footswitch": {
			const radius = (control.diameterCm * pxPerCm) / 2;
			const capFill =
				footswitchFinish === "black" ? FINISH_FILL.black : ART_PALETTE.metal;
			// Muted chrome: the switch must not out-read the knobs.
			parts.push(
				circle(
					cx,
					cy,
					radius,
					ART_PALETTE.metalLo,
					ART_PALETTE.hardwareInk,
					hairline,
				),
				circle(cx, cy, radius * 0.9, ART_PALETTE.metalLo),
				circle(
					cx,
					cy,
					radius * 0.72,
					capFill,
					ART_PALETTE.hardwareInk,
					hairline,
				),
			);
			break;
		}
		case "led": {
			const radius = (control.diameterCm * pxPerCm) / 2;
			parts.push(
				circle(
					cx,
					cy,
					radius * 1.18,
					ART_PALETTE.ledHousing,
					ART_PALETTE.hardwareInk,
					hairline,
				),
				circle(cx, cy, radius, control.color, ART_PALETTE.printDark, hairline),
			);
			break;
		}
		case "toggle": {
			const baseWidth = control.leverCm * 1.5 * pxPerCm;
			const baseHeight = control.leverCm * 0.8 * pxPerCm;
			const leverWidth = control.leverCm * 0.28 * pxPerCm;
			const leverHeight = control.leverCm * 0.95 * pxPerCm;
			parts.push(
				rect(
					cx - baseWidth / 2,
					cy - baseHeight / 2,
					baseWidth,
					baseHeight,
					baseHeight / 2,
					ART_PALETTE.metalLo,
					ART_PALETTE.hardwareInk,
					hairline,
				),
				`<g transform="rotate(${fmt(control.angleDeg)} ${fmt(cx)} ${fmt(cy)})">`,
				rect(
					cx - leverWidth / 2,
					cy - leverHeight / 2,
					leverWidth,
					leverHeight,
					leverWidth / 2,
					ART_PALETTE.metalHi,
					ART_PALETTE.hardwareInk,
					hairline,
				),
				"</g>",
			);
			break;
		}
		case "button": {
			const radius = (control.diameterCm * pxPerCm) / 2;
			parts.push(
				circle(
					cx,
					cy,
					radius,
					ART_PALETTE.metalLo,
					ART_PALETTE.hardwareInk,
					hairline,
				),
				circle(
					cx,
					cy,
					radius * 0.7,
					ART_PALETTE.metalHi,
					ART_PALETTE.hardwareInk,
					hairline,
				),
			);
			break;
		}
		case "display": {
			const displayWidth = control.widthCm * pxPerCm;
			const displayHeight = control.heightCm * pxPerCm;
			const radius = Math.min(displayWidth, displayHeight) * 0.08;
			parts.push(
				rect(
					cx - displayWidth / 2,
					cy - displayHeight / 2,
					displayWidth,
					displayHeight,
					radius,
					ART_PALETTE.display,
					ART_PALETTE.displayBorder,
					hairline,
				),
			);
			const inset = Math.max(1, 0.15 * pxPerCm);
			parts.push(
				rect(
					cx - displayWidth / 2 + inset,
					cy - displayHeight / 2 + inset,
					displayWidth - inset * 2,
					displayHeight - inset * 2,
					Math.max(0, radius - inset),
					"none",
					ART_PALETTE.hardwareInk,
					hairline,
				),
			);
			break;
		}
		case "treadle": {
			const treadleWidth = control.widthCm * pxPerCm;
			const treadleHeight = control.heightCm * pxPerCm;
			const radius = Math.min(treadleWidth, treadleHeight) * 0.08;
			parts.push(
				rect(
					cx - treadleWidth / 2,
					cy - treadleHeight / 2,
					treadleWidth,
					treadleHeight,
					radius,
					shade(ART_PALETTE.metalLo, 1.05),
					ART_PALETTE.hardwareInk,
					hairline,
				),
			);
			const inset = Math.max(2, 0.3 * pxPerCm);
			parts.push(
				`<line x1="${fmt(cx - treadleWidth / 2 + inset)}" y1="${fmt(cy)}" x2="${fmt(cx + treadleWidth / 2 - inset)}" y2="${fmt(cy)}" stroke="${ART_PALETTE.hardwareInk}" stroke-width="${fmt(hairline)}"/>`,
			);
			break;
		}
	}

	return parts.join("");
}

/**
 * Build the SVG for one spec. `longEdge` 350 uses hairline strokes so the thumb
 * reads like the 800 master; every other metric is true cm at both sizes.
 */
export function buildPedalArtSvg(
	spec: PedalArtSpec,
	options: BuildPedalArtOptions = {},
): PedalArtSvg {
	const longEdge = options.longEdge ?? 800;
	if (!Number.isInteger(longEdge) || longEdge < 100 || longEdge > 2000) {
		throw new Error("longEdge must be an integer between 100 and 2000");
	}

	const maxCm = Math.max(spec.widthCm, spec.heightCm);
	const pxPerCm = longEdge / maxCm;
	let width = Math.round(spec.widthCm * pxPerCm);
	let height = Math.round(spec.heightCm * pxPerCm);
	if (spec.widthCm === maxCm) width = longEdge;
	if (spec.heightCm === maxCm) height = longEdge;

	const cutline = longEdge <= 400 ? 1 : 2;
	const hairline = longEdge <= 400 ? 0.5 : 1;
	const bodyFill = clampChroma(spec.body.fill, BODY_MAX_CHROMA);
	const sideFill = shade(bodyFill, 0.88);
	const inkChoice =
		spec.ink === "auto"
			? pickInk(bodyFill)
			: {
					hex: spec.ink,
					contrast: contrastRatio(bodyFill, spec.ink),
					meets: contrastRatio(bodyFill, spec.ink) >= 4.5,
					largeMeets: contrastRatio(bodyFill, spec.ink) >= 3,
				};

	const sidePx = spec.body.sideCm * pxPerCm;
	const baseRadius = Math.min(
		(spec.body.radiusCm + spec.body.sideCm) * pxPerCm,
		0.18 * Math.min(width, height),
	);
	const topRadius = Math.max(
		0,
		Math.min(
			spec.body.radiusCm * pxPerCm,
			0.18 * Math.min(width, height) - sidePx,
		),
	);

	const parts: string[] = [
		`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
		`<title>${spec.id} — Catalog Specimen flat pedal art</title>`,
		`<defs><clipPath id="topFace"><rect x="${fmt(sidePx)}" y="${fmt(sidePx)}" width="${fmt(width - sidePx * 2)}" height="${fmt(height - sidePx * 2)}" rx="${fmt(topRadius)}"/></clipPath></defs>`,
		`<rect x="${fmt(Math.min(1, width / 2))}" y="${fmt(Math.min(1, height / 2))}" width="${fmt(width - 2 * Math.min(1, width / 2))}" height="${fmt(height - 2 * Math.min(1, height / 2))}" rx="${fmt(Math.max(0, baseRadius - 1))}" fill="${sideFill}"/>`,
		`<rect x="${fmt(sidePx)}" y="${fmt(sidePx)}" width="${fmt(width - sidePx * 2)}" height="${fmt(height - sidePx * 2)}" rx="${fmt(topRadius)}" fill="${bodyFill}"/>`,
		`<rect x="${fmt(Math.min(1, width / 2))}" y="${fmt(Math.min(1, height / 2))}" width="${fmt(width - 2 * Math.min(1, width / 2))}" height="${fmt(height - 2 * Math.min(1, height / 2))}" rx="${fmt(Math.max(0, baseRadius - 1))}" fill="none" stroke="${ART_PALETTE.cutline}" stroke-width="${fmt(cutline)}"/>`,
		'<g clip-path="url(#topFace)">',
	];

	for (const band of spec.body.bands) {
		const bandWidth = band.wCm * pxPerCm;
		const bandHeight = band.hCm * pxPerCm;
		const bandFill = clampChroma(
			band.fill,
			band.role === "field" ? BODY_MAX_CHROMA : 0.14,
		);
		const bandStroke =
			band.edge === "hairline" ? shade(bodyFill, 0.72) : undefined;
		parts.push(
			rect(
				band.u * width - bandWidth / 2,
				band.v * height - bandHeight / 2,
				bandWidth,
				bandHeight,
				band.rCm * pxPerCm,
				bandFill,
				bandStroke,
				hairline,
			),
		);
	}

	const controls = spec.controls
		.filter(
			(control) =>
				longEdge > 400 || (control.kind !== "led" && control.kind !== "button"),
		)
		.sort(
			(a, b) =>
				CONTROL_ORDER[a.kind] - CONTROL_ORDER[b.kind] ||
				a.v - b.v ||
				a.u - b.u ||
				a.kind.localeCompare(b.kind),
		);
	for (const control of controls) {
		parts.push(
			renderControl(
				control,
				pxPerCm,
				width,
				height,
				hairline,
				spec.body.knobFinish,
				spec.body.footswitchFinish,
			),
		);
	}

	for (const text of spec.text) {
		const allowed =
			text.role === "free" ? inkChoice.meets : inkChoice.largeMeets;
		if (!allowed) continue;
		const rendered = renderTextRun(
			text.value,
			text.u * width,
			text.v * height,
			text.sizeMm,
			text.trackingEm,
			text.weight,
			text.case,
			inkChoice.hex,
			pxPerCm,
		);
		parts.push(rendered.markup);
	}

	// The 350 picker thumb carries the item name in its row; tiny legends become
	// smudges there. Keep brand/model (larger) and omit control legends.
	if (longEdge > 400) {
		for (const control of controls) {
			parts.push(
				renderControlLabel(
					control,
					control.u * width,
					control.v * height,
					pxPerCm,
					inkChoice.hex,
					inkChoice.meets,
					{
						x: sidePx,
						y: sidePx,
						width: width - sidePx * 2,
						height: height - sidePx * 2,
						radius: topRadius,
					},
				),
			);
		}
	}

	parts.push("</g>", "</svg>");
	return {
		svg: parts.join(""),
		width,
		height,
		longEdge,
		pxPerCm,
		bodyFill,
		sideFill,
		ink: inkChoice.hex,
		inkContrast: inkChoice.contrast,
	};
}
