import type { z } from "zod";
import type {
	CatalogBoard,
	CatalogPedal,
	SourceTag,
} from "../../src/catalog/schema.ts";
import { deriveCategory, deriveEffectTypes } from "./curated.ts";
import { toSlug, VARIANT_SUFFIX } from "./slug.ts";

/**
 * Generic converter: an external catalog JSON → our catalog schema
 * (design.md §Data model). We do NOT inherit external conventions or field
 * names — inches become cm, brand+name become stable slugs, and flat colorway
 * duplicates become `variantOf` links. Images are always mocked names
 * (`<id>.png`); no third-party image asset is ever referenced (ADR-003).
 *
 * External format (documented generically; see the fixture and README): an
 * array of rows `{ Brand, Name, Width, Height }`, dimensions in **inches**.
 */

export type ExternalRow = {
	Brand?: unknown;
	Name?: unknown;
	Width?: unknown;
	Height?: unknown;
	Image?: unknown;
};

export type ConvertOptions = {
	/** Provenance tag written to every converted item (ADR-003). */
	source: SourceTag;
	/** Receives human-readable warnings (duplicates, skipped entries). */
	warn?: (message: string) => void;
};

export type ConvertResult<T> = {
	items: T[];
	warnings: string[];
};

function round2(value: number): number {
	return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Inches → cm (2 decimals). The single conversion factor used for catalog geometry. */
export function inchesToCm(inches: number): number {
	return round2(inches * 2.54);
}

function isPositiveNumber(value: unknown): value is number {
	return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function asTrimmedString(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}

function makeWarn(options: ConvertOptions, warnings: string[]) {
	return (message: string) => {
		warnings.push(message);
		options.warn?.(message);
	};
}

/**
 * A colorway shares its base model's footprint — a variant must not change the
 * planned occupied size (true-scale). Normalizes every variant to its base's
 * `widthCm`/`heightCm` **in place**. Idempotent, so it is safe to re-run after a
 * curation merge (a curated base footprint must propagate to its variants).
 */
export function normalizeVariantFootprints(items: CatalogPedal[]): void {
	const dimsById = new Map(
		items.map((p) => [p.id, { widthCm: p.widthCm, heightCm: p.heightCm }]),
	);
	for (const item of items) {
		if (!item.variantOf) continue;
		const base = dimsById.get(item.variantOf);
		if (base) {
			item.widthCm = base.widthCm;
			item.heightCm = base.heightCm;
		}
	}
}

/**
 * Convert external pedal rows into our schema. Deterministic (input order only,
 * no randomness): entries missing brand/dimensions are skipped with a warning;
 * duplicate slugs are skipped with a warning (first occurrence wins); variants
 * whose base is absent are dropped.
 */
export function convertPedals(
	rows: ExternalRow[],
	options: ConvertOptions,
): ConvertResult<CatalogPedal> {
	const warnings: string[] = [];
	const warn = makeWarn(options, warnings);

	const pedals: CatalogPedal[] = [];
	const seen = new Set<string>();

	for (const row of rows) {
		if (!row || typeof row !== "object") {
			warn("skipped a null/non-object row");
			continue;
		}
		const brand = asTrimmedString(row.Brand);
		const displayName = asTrimmedString(row.Name);
		if (!brand || !displayName) {
			warn(`skipped "${displayName || "<unnamed>"}": missing brand/name`);
			continue;
		}
		if (!isPositiveNumber(row.Width) || !isPositiveNumber(row.Height)) {
			warn(`skipped "${brand} ${displayName}": missing width/height`);
			continue;
		}

		const variantMatch = displayName.match(VARIANT_SUFFIX);
		const baseName = variantMatch ? variantMatch[1].trim() : displayName;
		const baseId = toSlug(`${brand} ${baseName}`);
		const variantSlug = variantMatch ? toSlug(variantMatch[2]) : "";
		const id = variantMatch ? `${baseId}-${variantSlug}` : baseId;

		if (!baseId || (variantMatch && !variantSlug)) {
			warn(`skipped "${brand} ${displayName}": does not yield a valid slug`);
			continue;
		}
		if (seen.has(id)) {
			warn(`skipped duplicate slug "${id}" (from "${brand} ${displayName}")`);
			continue;
		}
		seen.add(id);

		pedals.push({
			id,
			brand,
			name: displayName,
			widthCm: inchesToCm(row.Width),
			heightCm: inchesToCm(row.Height),
			image: `${id}.png`,
			imageSource: "mock",
			effectTypes: deriveEffectTypes({
				brand,
				name: displayName,
				variantOf: variantMatch ? baseId : undefined,
			}),
			category: deriveCategory({
				brand,
				name: displayName,
				variantOf: variantMatch ? baseId : undefined,
			}),
			variantOf: variantMatch ? baseId : undefined,
			source: options.source,
		});
	}

	// Drop variants whose base was skipped — never ship a dangling reference.
	// Only non-variant entries can be a model base.
	const baseIds = new Set(
		pedals.filter((pedal) => !pedal.variantOf).map((pedal) => pedal.id),
	);
	const items = pedals.filter((pedal) => {
		if (pedal.variantOf && !baseIds.has(pedal.variantOf)) {
			warn(
				`dropped "${pedal.id}": variant base "${pedal.variantOf}" is missing`,
			);
			return false;
		}
		return true;
	});

	normalizeVariantFootprints(items);

	return { items, warnings };
}

/**
 * Curation fields that a re-import must NOT discard. `effectTypes`/`category`
 * are derived in-code (curated.ts), but these live only in the committed JSON
 * (sources = provenance links; power/jacks = verified specs; image/imageSource =
 * cleared asset state), so re-running `import` over an existing catalog would
 * otherwise wipe them.
 */
const CURATION_KEYS = [
	"widthCm", // corrected footprints must survive a re-import (true-scale)
	"heightCm",
	"sources",
	"source", // rights tag — keep a cleared item cleared
	"power",
	"jacks",
	"image",
	"imageSource",
	"links", // v2 affiliate links (N5)
] as const;

function pickCuration<T>(prev: T): Partial<T> {
	const out: Partial<T> = {};
	for (const key of CURATION_KEYS) {
		const value = (prev as Record<string, unknown>)[key];
		if (value !== undefined) (out as Record<string, unknown>)[key] = value;
	}
	return out;
}

/**
 * Merge curation from an existing catalog into freshly converted items, matched
 * by stable id. New items keep converter defaults; removed ids simply drop out.
 */
/**
 * Validate a raw existing catalog and merge its curation onto freshly converted
 * items. The existing file is schema-validated first: a row missing/miscased
 * `id` (or otherwise invalid) would silently fail to match and lose its
 * curation, so it must fail loudly instead.
 */
export function mergeExisting<T extends { id: string }>(
	next: T[],
	existingRaw: unknown,
	schema: z.ZodType<T[]>,
): { items: T[]; dropped: T[] } {
	const parsed = schema.safeParse(existingRaw);
	if (!parsed.success) {
		throw new Error(
			`existing catalog is invalid — ${
				parsed.error.issues[0]?.message ?? "bad data"
			}`,
		);
	}
	const nextIds = new Set(next.map((item) => item.id));
	// Existing ids absent from the new selection would be written out entirely
	// (with their curation) — surface them so the caller can require an explicit
	// opt-in rather than dropping silently.
	const dropped = parsed.data.filter((item) => !nextIds.has(item.id));
	return { items: preserveCuration(next, parsed.data), dropped };
}

export function preserveCuration<T extends { id: string }>(
	next: T[],
	existing: T[],
): T[] {
	// A duplicate id in the existing file would silently keep only the last row
	// (dropping the earlier one's curation), so reject it before merging.
	const byId = new Map<string, T>();
	for (const item of existing) {
		if (byId.has(item.id)) {
			throw new Error(`existing catalog: duplicate id "${item.id}"`);
		}
		byId.set(item.id, item);
	}
	return next.map((item) => {
		const prev = byId.get(item.id);
		return prev ? { ...item, ...pickCuration(prev) } : item;
	});
}

/** Convert external board rows into our schema. Deterministic. */
export function convertBoards(
	rows: ExternalRow[],
	options: ConvertOptions,
): ConvertResult<CatalogBoard> {
	const warnings: string[] = [];
	const warn = makeWarn(options, warnings);

	const boards: CatalogBoard[] = [];
	const seen = new Set<string>();

	for (const row of rows) {
		if (!row || typeof row !== "object") {
			warn("skipped a null/non-object row");
			continue;
		}
		const brand = asTrimmedString(row.Brand);
		const name = asTrimmedString(row.Name);
		if (!brand || !name) {
			warn(`skipped "${name || "<unnamed>"}": missing brand/name`);
			continue;
		}
		if (!isPositiveNumber(row.Width) || !isPositiveNumber(row.Height)) {
			warn(`skipped "${brand} ${name}": missing width/height`);
			continue;
		}

		const id = toSlug(`${brand} ${name}`);
		if (!id) {
			warn(`skipped "${brand} ${name}": does not yield a valid slug`);
			continue;
		}
		if (seen.has(id)) {
			warn(`skipped duplicate slug "${id}" (from "${brand} ${name}")`);
			continue;
		}
		seen.add(id);

		boards.push({
			id,
			brand,
			name,
			widthCm: inchesToCm(row.Width),
			heightCm: inchesToCm(row.Height),
			image: `${id}.png`,
			imageSource: "mock",
			source: options.source,
		});
	}

	return { items: boards, warnings };
}
