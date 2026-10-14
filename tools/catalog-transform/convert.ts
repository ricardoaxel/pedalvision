import type { CatalogPedal, SourceTag } from "../../src/catalog/schema.ts";

/**
 * Generic converter: an external catalog JSON → our catalog schema
 * (design.md §Data model). We do NOT inherit external conventions — inches
 * become cm, name-keys become stable slugs, and flat colorway duplicates become
 * `variantOf` links.
 *
 * The external format is intentionally simple and invented (this repo ships no
 * third-party data): an object keyed by display name, whose values carry the
 * footprint in inches plus optional brand/image/effects. See the fixture in
 * `fixtures/external-catalog.json` and `catalog-transform/README.md`.
 */

export type ExternalEntry = {
	brand?: unknown;
	widthIn?: unknown;
	heightIn?: unknown;
	image?: unknown;
	effects?: unknown;
	category?: unknown;
};

export type ExternalCatalog = Record<string, ExternalEntry>;

export type ConvertOptions = {
	/** Provenance tag written to every converted item (ADR-003). */
	source: SourceTag;
	/** Receives human-readable warnings (duplicates, skipped entries). */
	warn?: (message: string) => void;
};

export type ConvertResult = {
	pedals: CatalogPedal[];
	warnings: string[];
};

const VARIANT_SUFFIX = /^(.*?)\s*\(([^)]+)\)\s*$/;

/** Slugify a display string: lowercase ASCII words joined by single hyphens. */
export function toSlug(value: string): string {
	return value
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.replace(/-{2,}/g, "-");
}

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

function toEffectTypes(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value.filter((item): item is string => typeof item === "string");
}

/**
 * Normalize to a safe `.png` filename (lowercase/hyphenated/ASCII) — the
 * catalog ships `image` straight into `assetUrl()`, which does not encode.
 */
function toImageFilename(value: unknown, fallbackId: string): string {
	const raw =
		typeof value === "string" && value.length > 0 ? value : `${fallbackId}.png`;
	const base = toSlug(raw.replace(/\.png$/i, ""));
	return `${base || fallbackId}.png`;
}

/**
 * Convert an external catalog into our schema. Deterministic: iterates keys in
 * insertion order and never uses randomness. Entries missing a positive
 * width/height are skipped with a warning; duplicate slugs are skipped with a
 * warning (first occurrence wins).
 */
export function convertExternalCatalog(
	input: ExternalCatalog,
	options: ConvertOptions,
): ConvertResult {
	const warnings: string[] = [];
	const warn = (message: string) => {
		warnings.push(message);
		options.warn?.(message);
	};

	const pedals: CatalogPedal[] = [];
	const seen = new Set<string>();

	for (const [displayName, entry] of Object.entries(input)) {
		if (!isPositiveNumber(entry.widthIn) || !isPositiveNumber(entry.heightIn)) {
			warn(`skipped "${displayName}": missing width/height`);
			continue;
		}

		const brand = typeof entry.brand === "string" ? entry.brand.trim() : "";
		if (!brand) {
			warn(`skipped "${displayName}": missing brand`);
			continue;
		}

		const variantMatch = displayName.match(VARIANT_SUFFIX);
		const baseName = variantMatch ? variantMatch[1].trim() : displayName.trim();
		const baseId = toSlug(`${brand} ${baseName}`);
		const variantSlug = variantMatch ? toSlug(variantMatch[2]) : "";
		const id = variantMatch ? `${baseId}-${variantSlug}` : baseId;

		// A slug that does not fit the schema would be written as invalid data.
		if (!baseId || (variantMatch && !variantSlug)) {
			warn(`skipped "${displayName}": name/brand does not yield a valid slug`);
			continue;
		}

		if (seen.has(id)) {
			warn(`skipped duplicate slug "${id}" (from "${displayName}")`);
			continue;
		}
		seen.add(id);

		const image = toImageFilename(entry.image, id);

		pedals.push({
			id,
			brand,
			name: displayName.trim(),
			widthCm: inchesToCm(entry.widthIn),
			heightCm: inchesToCm(entry.heightIn),
			image,
			effectTypes: toEffectTypes(entry.effects),
			category: entry.category === "supply" ? "supply" : "pedal",
			jacks: [],
			variantOf: variantMatch ? baseId : undefined,
			source: options.source,
		});
	}

	// Drop variants whose base was skipped — never ship a dangling reference.
	// Only non-variant entries can be a model base (a variant's own id is not a
	// valid base, even though it is in `seen`).
	const baseIds = new Set(
		pedals.filter((pedal) => !pedal.variantOf).map((pedal) => pedal.id),
	);
	const validPedals = pedals.filter((pedal) => {
		if (pedal.variantOf && !baseIds.has(pedal.variantOf)) {
			warn(
				`dropped "${pedal.id}": variant base "${pedal.variantOf}" is missing`,
			);
			return false;
		}
		return true;
	});

	return { pedals: validPedals, warnings };
}
