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

	return { items, warnings };
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
			source: options.source,
		});
	}

	return { items: boards, warnings };
}
