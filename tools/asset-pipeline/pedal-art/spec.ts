import { z } from "zod";
import {
	HTTP_URL,
	ID_PATTERN,
	JACK_EDGES,
	JACK_KINDS,
} from "../../../src/catalog/schema.ts";
import {
	BODY_MAX_CHROMA,
	hexToOklch,
	isHex,
	PRINT_MAX_CHROMA,
} from "./color.ts";

/**
 * Per-item flat-pedal-art spec ("Catalog Specimen").
 *
 * The model authors this JSON from an official/authorized/user reference; the
 * renderer draws a deterministic SVG. No reference pixels, no freehand SVG, no
 * planner pixels. Geometry is cm / normalized coordinates; the renderer owns
 * the fixed palette, typography, primitives and QA constants.
 *
 * See `docs/catalog/pedal-art.md`.
 */

export const PEDAL_ART_STYLE = "catalog-specimen/1" as const;

export const PEDAL_ART_FAMILIES = [
	"compact",
	"standard",
	"double",
	"expression",
	"switcher",
	"footswitch",
	"volume",
	"multi-fx",
	"desktop-rack",
] as const;
export type PedalArtFamily = (typeof PEDAL_ART_FAMILIES)[number];

export const PEDAL_ART_CONTROL_KINDS = [
	"knob",
	"footswitch",
	"led",
	"toggle",
	"button",
	"display",
	"treadle",
] as const;

export const PEDAL_ART_FINISHES = ["black", "metal", "cream", "white"] as const;
export const PEDAL_ART_LABEL_PLACEMENTS = [
	"above",
	"below",
	"left",
	"right",
] as const;

const Hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "must be a #RRGGBB colour");
const Printable = z
	.string()
	.regex(/^[\x20-\x7E]+$/, "must be printable ASCII")
	.min(1);

const UnitPosition = z.number().min(0.05).max(0.95);

const controlBase = {
	u: UnitPosition,
	v: z.number().min(0.05).max(0.95),
	/** Optional printed legend. Omitted below the 4.5:1 ink floor. */
	label: Printable.max(14).optional(),
	labelPlacement: z.enum(PEDAL_ART_LABEL_PLACEMENTS).default("above"),
};

export const KnobSchema = z
	.object({
		kind: z.literal("knob"),
		diameterCm: z.number().min(0.8).max(4),
		/** Pointer angle; 0 = up. */
		rotationDeg: z.number().min(-180).max(360).default(0),
		...controlBase,
	})
	.strict();

export const FootswitchSchema = z
	.object({
		kind: z.literal("footswitch"),
		diameterCm: z.number().min(1).max(3),
		...controlBase,
	})
	.strict();

export const LedSchema = z
	.object({
		kind: z.literal("led"),
		diameterCm: z.number().min(0.2).max(1.2),
		color: Hex.default("#B03A2E"),
		...controlBase,
	})
	.strict();

export const ToggleSchema = z
	.object({
		kind: z.literal("toggle"),
		leverCm: z.number().min(0.4).max(2),
		angleDeg: z.number().min(-60).max(60).default(0),
		...controlBase,
	})
	.strict();

export const ButtonSchema = z
	.object({
		kind: z.literal("button"),
		diameterCm: z.number().min(0.3).max(1.4),
		...controlBase,
	})
	.strict();

export const DisplaySchema = z
	.object({
		kind: z.literal("display"),
		widthCm: z.number().min(1).max(20),
		heightCm: z.number().min(0.6).max(10),
		...controlBase,
	})
	.strict();

export const TreadleSchema = z
	.object({
		kind: z.literal("treadle"),
		widthCm: z.number().min(3).max(16),
		heightCm: z.number().min(6).max(28),
		...controlBase,
	})
	.strict();

export const PedalArtControlSchema = z.discriminatedUnion("kind", [
	KnobSchema,
	FootswitchSchema,
	LedSchema,
	ToggleSchema,
	ButtonSchema,
	DisplaySchema,
	TreadleSchema,
]);

export const PedalArtBandSchema = z
	.object({
		u: UnitPosition,
		v: z.number().min(0.05).max(0.95),
		wCm: z.number().positive().max(40),
		hCm: z.number().positive().max(40),
		fill: Hex,
		rCm: z.number().nonnegative().max(3).default(0),
		/** `field` = a body-value tread pad; `print` = a flat print band. */
		role: z.enum(["print", "field"]).default("print"),
		/** A low-contrast tread field gets one hairline edge, never a black fill. */
		edge: z.enum(["none", "hairline"]).default("none"),
	})
	.strict();

export const PedalArtTextSchema = z
	.object({
		role: z.enum(["brand", "model", "free"]),
		value: Printable.max(28),
		u: UnitPosition,
		v: z.number().min(0.03).max(0.84),
		sizeMm: z.number().min(1.6).max(12),
		case: z.enum(["upper", "title", "as-is"]).default("upper"),
		trackingEm: z.number().min(-0.05).max(0.2).default(0.02),
		weight: z.enum(["medium", "semibold"]).default("semibold"),
	})
	.strict();

export const PedalArtJackSchema = z
	.object({
		kind: z.enum(JACK_KINDS),
		edge: z.enum(JACK_EDGES),
		pos: z.number().min(0).max(1).optional(),
		/**
		 * Metadata only. v1 clips the art to the enclosure so the app's
		 * true-scale stretch stays correct; any protrusion is rejected.
		 */
		protrusionCm: z.number().min(0).max(1.2).default(0),
	})
	.strict();

export const PedalArtSpecSchema = z
	.object({
		id: z.string().regex(ID_PATTERN, "id must be a lowercase-hyphenated slug"),
		family: z.enum(PEDAL_ART_FAMILIES),
		widthCm: z.number().min(2).max(60),
		heightCm: z.number().min(2).max(60),
		/** Official/authorized reference URL. Never a planner source. */
		sourceRef: HTTP_URL.optional(),
		style: z.literal(PEDAL_ART_STYLE),
		body: z
			.object({
				/** Sampled median top-face colour; clamped to 0.18 chroma. */
				fill: Hex,
				radiusCm: z.number().nonnegative().max(3).default(0.35),
				sideCm: z.number().nonnegative().max(0.6).default(0.3),
				knobFinish: z.enum(PEDAL_ART_FINISHES).default("black"),
				footswitchFinish: z.enum(PEDAL_ART_FINISHES).default("metal"),
				bands: z.array(PedalArtBandSchema).max(2).default([]),
			})
			.strict(),
		ink: z.union([z.literal("auto"), Hex]).default("auto"),
		controls: z.array(PedalArtControlSchema).max(32).default([]),
		text: z.array(PedalArtTextSchema).max(6).default([]),
		jacks: z.array(PedalArtJackSchema).max(20).default([]),
		note: Printable.max(240).optional(),
	})
	.strict()
	.superRefine((spec, ctx) => {
		const { widthCm, heightCm } = spec;
		const issue = (path: Array<string | number>, message: string) =>
			ctx.addIssue({ code: "custom", message, path });

		if (!isHex(spec.body.fill)) {
			issue(["body", "fill"], "body fill must be a #RRGGBB colour");
		} else if (hexToOklch(spec.body.fill).c > BODY_MAX_CHROMA + 0.0001) {
			issue(
				["body", "fill"],
				`body fill chroma must be ≤ ${BODY_MAX_CHROMA} (clamp the sampled colour)`,
			);
		}

		if (spec.body.radiusCm > 0.18 * Math.min(widthCm, heightCm)) {
			issue(["body", "radiusCm"], "radiusCm must be ≤ 0.18 × the shorter side");
		}
		if (spec.body.sideCm >= Math.min(widthCm, heightCm) / 2) {
			issue(["body", "sideCm"], "sideCm leaves no top face");
		}

		for (const [index, band] of spec.body.bands.entries()) {
			const maxChroma =
				band.role === "field" ? BODY_MAX_CHROMA : PRINT_MAX_CHROMA;
			if (hexToOklch(band.fill).c > maxChroma + 0.0001) {
				issue(
					["body", "bands", index, "fill"],
					`band fill chroma must be ≤ ${maxChroma}`,
				);
			}
			const x = band.u * widthCm;
			const y = band.v * heightCm;
			if (
				x - band.wCm / 2 < 0 ||
				x + band.wCm / 2 > widthCm ||
				y - band.hCm / 2 < 0 ||
				y + band.hCm / 2 > heightCm
			) {
				issue(["body", "bands", index], "band extends outside the body");
			}
		}

		if (spec.ink !== "auto" && hexToOklch(spec.ink).c > PRINT_MAX_CHROMA) {
			issue(["ink"], `print ink chroma must be ≤ ${PRINT_MAX_CHROMA}`);
		}

		if (spec.sourceRef && /pedalplayground/i.test(spec.sourceRef)) {
			issue(["sourceRef"], "planner references are never allowed");
		}

		for (const [index, control] of spec.controls.entries()) {
			const x = control.u * widthCm;
			const y = control.v * heightCm;
			const halfWidth =
				control.kind === "display" || control.kind === "treadle"
					? control.widthCm / 2
					: control.kind === "toggle"
						? control.leverCm * 0.8
						: control.diameterCm / 2;
			const halfHeight =
				control.kind === "display" || control.kind === "treadle"
					? control.heightCm / 2
					: control.kind === "toggle"
						? control.leverCm * 0.65
						: control.diameterCm / 2;
			if (
				x - halfWidth < 0.15 ||
				x + halfWidth > widthCm - 0.15 ||
				y - halfHeight < 0.15 ||
				y + halfHeight > heightCm - 0.15
			) {
				issue(
					["controls", index],
					"control extends outside the enclosure (0.15 cm min inset)",
				);
			}
		}

		for (const [index, text] of spec.text.entries()) {
			const minimum = text.role === "free" ? 1.8 : 2;
			if (text.sizeMm < minimum) {
				issue(
					["text", index, "sizeMm"],
					`${text.role} text must be ≥ ${minimum} mm`,
				);
			}
		}

		for (const [index, jack] of spec.jacks.entries()) {
			if (jack.protrusionCm !== 0) {
				issue(
					["jacks", index, "protrusionCm"],
					"v1 clips to the enclosure; use protrusionCm 0 and let the app draw ticks",
				);
			}
		}
	});

export type PedalArtSpec = z.infer<typeof PedalArtSpecSchema>;
export type PedalArtControl = z.infer<typeof PedalArtControlSchema>;
export type PedalArtText = z.infer<typeof PedalArtTextSchema>;

export function parsePedalArtSpec(value: unknown): PedalArtSpec {
	const parsed = PedalArtSpecSchema.safeParse(value);
	if (!parsed.success) {
		const issue = parsed.error.issues[0];
		const path = issue?.path.length ? `${issue.path.join(".")}: ` : "";
		throw new Error(`${path}${issue?.message ?? "invalid pedal-art spec"}`);
	}
	return parsed.data;
}
