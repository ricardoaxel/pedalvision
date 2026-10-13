import { z } from "zod";

/**
 * Catalog schema (design.md §Data model). Source-agnostic: external catalog
 * formats are converted into this shape by `tools/catalog-transform`.
 *
 * Geometry is always stored in cm. Images are filenames under
 * `public/pedal-assets/{pedals,boards}/{800,350}/` (see ADR-002 / P0-04) — never
 * URLs. Provenance is the `source` tag (ADR-003); no external names/URLs ever
 * live in catalog data, code, commits, filenames, or shipped assets.
 */

/** Stable slug ids: lowercase ASCII words joined by single hyphens. */
export const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Image filenames must be lowercase/hyphenated/ASCII `.png`. `assetUrl()` does
 * not URL-encode (src/lib/cdn.ts), so the catalog is the guarantee that only
 * safe filenames ever reach it (see ADR-003 / P0-04 README).
 */
export const IMAGE_PATTERN = /^[a-z0-9][a-z0-9-]*\.png$/;

/** Provenance tags — ADR-003. Kept as an enum so the launch gate is machine-checkable. */
export const SOURCE_TAGS = [
	"licensed",
	"brand-assets",
	"community",
	"own",
	"placeholder",
	"synthetic",
] as const;

export const JackSchema = z.object({
	kind: z.enum(["in", "out", "exp", "power"]),
	edge: z.enum(["top", "right", "bottom", "left"]),
	/** Position along the edge, 0..1 (0.5 = centered). */
	pos: z.number().min(0).max(1),
});

export const PowerSchema = z.object({
	voltage: z.number().positive(),
	acDc: z.enum(["DC", "AC"]),
	currentMa: z.number().nonnegative(),
});

export const CatalogPedalSchema = z.object({
	id: z.string().regex(ID_PATTERN, "id must be a lowercase-hyphenated slug"),
	brand: z.string().min(1),
	name: z.string().min(1),
	widthCm: z.number().positive(),
	heightCm: z.number().positive(),
	image: z.string().regex(IMAGE_PATTERN, "image must be a safe .png filename"),
	effectTypes: z.array(z.string()),
	category: z.enum(["pedal", "supply"]),
	jacks: z.array(JackSchema).optional(),
	power: PowerSchema.optional(),
	variantOf: z.string().regex(ID_PATTERN).optional(),
	source: z.enum(SOURCE_TAGS),
	links: z.array(z.object({ label: z.string(), url: z.url() })).optional(),
});

export const CatalogBoardSchema = z.object({
	id: z.string().regex(ID_PATTERN, "id must be a lowercase-hyphenated slug"),
	brand: z.string().min(1),
	name: z.string().min(1),
	widthCm: z.number().positive(),
	heightCm: z.number().positive(),
	image: z.string().regex(IMAGE_PATTERN, "image must be a safe .png filename"),
	source: z.enum(SOURCE_TAGS),
});

export const CatalogSchema = z.object({
	pedals: z.array(CatalogPedalSchema),
	boards: z.array(CatalogBoardSchema),
});

export type Jack = z.infer<typeof JackSchema>;
export type Power = z.infer<typeof PowerSchema>;
export type CatalogPedal = z.infer<typeof CatalogPedalSchema>;
export type CatalogBoard = z.infer<typeof CatalogBoardSchema>;
export type Catalog = z.infer<typeof CatalogSchema>;
export type SourceTag = (typeof SOURCE_TAGS)[number];
