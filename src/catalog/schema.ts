import { z } from "zod";

/**
 * Catalog schema (design.md §Data model). Source-agnostic: external catalog
 * formats are converted into this shape by `tools/catalog-transform`.
 *
 * Geometry is always stored in cm. How an image is provided is the `imageSource`
 * field: `mock`/`static` resolve to a filename under
 * `public/pedal-assets/{pedals,boards}/{800,350}/` (ADR-002 / P0-04); `url` is
 * the deferred same-origin/CDN path. Rights provenance is the separate `source`
 * tag (ADR-003); no external names/URLs ever live in catalog data, code,
 * commits, filenames, or shipped assets.
 *
 * This is OUR model, not a rename of any external one (ADR-003 §Schema
 * originality): cm-native geometry, slug ids, a referential variant graph, a
 * provenance enum, a device `category`, and our own effect taxonomy
 * (`EFFECT_TYPES`) with no counterpart in the source data.
 */

/** Stable slug ids: lowercase ASCII words joined by single hyphens. */
export const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Image filenames must be lowercase/hyphenated/ASCII `.png`. `assetUrl()` does
 * not URL-encode (src/lib/cdn.ts), so the catalog is the guarantee that only
 * safe filenames ever reach it (see ADR-003 / P0-04 README).
 */
export const IMAGE_PATTERN = /^[a-z0-9][a-z0-9-]*\.png$/;

/**
 * How a catalog image is provided — orthogonal to `source` (which is rights
 * provenance). It tells the loader/renderer how to resolve `image`:
 *  - `mock`   — a procedurally generated placeholder drawn by
 *    `tools/catalog-transform` (no external file); the seed today.
 *  - `static` — a committed file under `public/pedal-assets/` (ADR-002 v1);
 *    `image` is a safe filename (`IMAGE_PATTERN`).
 *  - `url`    — an absolute, same-origin/CORS-clean URL (deferred R2/CDN path,
 *    ADR-002); `image` is a URL.
 */
export const IMAGE_SOURCES = ["mock", "static", "url"] as const;

/** http(s) URLs only — rejects `javascript:`, `data:`, `ftp:`, `mailto:`, … */
export const HTTP_URL = z.url({ protocol: /^https?$/ });

function validImage(imageSource: ImageSource, image: string): boolean {
	return imageSource === "url"
		? HTTP_URL.safeParse(image).success
		: IMAGE_PATTERN.test(image);
}

function checkImage(
	imageSource: ImageSource,
	image: string,
	ctx: z.RefinementCtx,
): void {
	if (validImage(imageSource, image)) return;
	ctx.addIssue({
		code: "custom",
		path: ["image"],
		message:
			imageSource === "url"
				? "image must be a URL when imageSource is 'url'"
				: "image must be a safe .png filename when imageSource is 'mock' or 'static'",
	});
}

/**
 * Per-item provenance — a source link a fact/image was verified against
 * (owner decision, 2026-10-14; ADR-003 §Per-item sources). Manufacturer/
 * authorized sources are preferred; reputable retailer/community corroboration
 * is permitted (ADR-003 source hierarchy). `kind` = what the link backs:
 * `info` (specs/effect type/date) or `image`. The external aggregate is never
 * referenced.
 */
export const SourceRefSchema = z.object({
	url: HTTP_URL,
	/** What the link backs: `info` (specs/effect type/date) and/or `image`. */
	kind: z.array(z.enum(["info", "image"])).min(1),
});

/** Provenance tags — ADR-003. Kept as an enum so the launch gate is machine-checkable. */
export const SOURCE_TAGS = [
	"licensed",
	"brand-assets",
	"community",
	"own",
	"placeholder",
	"synthetic",
] as const;

/**
 * Our effect-type taxonomy (ADR-003 §Schema originality). A pedal may have
 * several types. The first group are sound effects; the second are non-effect
 * roles/utilities (a device can be a buffer, a DI, a controller, …). Validated
 * as an enum so catalog data can never drift outside our own vocabulary.
 */
export const EFFECT_TYPES = [
	// sound effects
	"tuner",
	"looper",
	"octave",
	"pitch",
	"synth",
	"fuzz",
	"distortion",
	"overdrive",
	"boost",
	"compressor",
	"eq",
	"wah",
	"tremolo",
	"vibrato",
	"chorus",
	"flanger",
	"phaser",
	"delay",
	"reverb",
	"gate",
	"ring-mod",
	"bitcrusher",
	"envelope",
	"filter",
	"rotary",
	// non-effect roles / utilities
	"preamp",
	"amp-modeler",
	"cab-sim",
	"acoustic-sim",
	"organ-sim",
	"power-amp",
	"buffer",
	"di",
	"ab-box",
	"mixer",
	"controller",
	"sequencer",
	"attenuator",
	"utility",
] as const;

/**
 * Jack-kind vocabulary (F7/P4-01) — the anchors a cable attaches to and the
 * kinds the custom creator offers. Widened in P2-02 from the original
 * `in|out|exp|power`: real pedals also carry expression split as `exp-in`/
 * `exp-out`, an effects-loop pair (`send`/`return`), and control
 * (`midi`/`ctrl`). `pos` is the position ALONG the chosen `edge` (0..1).
 */
export const JACK_KINDS = [
	"in",
	"out",
	"exp",
	"exp-in",
	"exp-out",
	"send",
	"return",
	"midi",
	"ctrl",
	"power",
] as const;

/** Jack edges (F7/P4-01) — which side of the footprint a jack sits on. */
export const JACK_EDGES = ["top", "right", "bottom", "left"] as const;

export const JackSchema = z.object({
	kind: z.enum(JACK_KINDS),
	edge: z.enum(JACK_EDGES),
	/** Position along the edge, 0..1 (0.5 = centered). */
	pos: z.number().min(0).max(1),
});

export const PowerSchema = z.object({
	voltage: z.number().positive(),
	acDc: z.enum(["DC", "AC"]),
	currentMa: z.number().nonnegative(),
});

export const CatalogPedalSchema = z
	.object({
		id: z.string().regex(ID_PATTERN, "id must be a lowercase-hyphenated slug"),
		brand: z.string().min(1),
		name: z.string().min(1),
		widthCm: z.number().positive(),
		heightCm: z.number().positive(),
		image: z.string().min(1, "image is required"),
		imageSource: z.enum(IMAGE_SOURCES),
		effectTypes: z.array(z.enum(EFFECT_TYPES)),
		category: z.enum(["pedal", "supply"]),
		jacks: z.array(JackSchema).optional(),
		power: PowerSchema.optional(),
		variantOf: z.string().regex(ID_PATTERN).optional(),
		source: z.enum(SOURCE_TAGS),
		sources: z.array(SourceRefSchema).optional(),
		links: z.array(z.object({ label: z.string(), url: HTTP_URL })).optional(),
	})
	.superRefine((pedal, ctx) => checkImage(pedal.imageSource, pedal.image, ctx));

export const CatalogBoardSchema = z
	.object({
		id: z.string().regex(ID_PATTERN, "id must be a lowercase-hyphenated slug"),
		brand: z.string().min(1),
		name: z.string().min(1),
		widthCm: z.number().positive(),
		heightCm: z.number().positive(),
		image: z.string().min(1, "image is required"),
		imageSource: z.enum(IMAGE_SOURCES),
		source: z.enum(SOURCE_TAGS),
		sources: z.array(SourceRefSchema).optional(),
	})
	.superRefine((board, ctx) => checkImage(board.imageSource, board.image, ctx));

export const CatalogSchema = z.object({
	pedals: z.array(CatalogPedalSchema),
	boards: z.array(CatalogBoardSchema),
});

export type SourceRef = z.infer<typeof SourceRefSchema>;
export type Jack = z.infer<typeof JackSchema>;
export type JackKind = (typeof JACK_KINDS)[number];
export type JackEdge = (typeof JACK_EDGES)[number];
export type Power = z.infer<typeof PowerSchema>;
export type CatalogPedal = z.infer<typeof CatalogPedalSchema>;
export type CatalogBoard = z.infer<typeof CatalogBoardSchema>;
export type Catalog = z.infer<typeof CatalogSchema>;
export type SourceTag = (typeof SOURCE_TAGS)[number];
export type EffectType = (typeof EFFECT_TYPES)[number];
export type ImageSource = (typeof IMAGE_SOURCES)[number];
