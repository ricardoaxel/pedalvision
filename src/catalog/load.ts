import type { ZodError } from "zod";
import boardsJson from "./data/boards.json";
import pedalsJson from "./data/pedals.json";
import {
	type Catalog,
	type CatalogBoard,
	CatalogBoardSchema,
	type CatalogPedal,
	CatalogPedalSchema,
} from "./schema";

/**
 * Catalog loader. The JSON ships in the app bundle (static import) and is
 * zod-validated here, so bad catalog data fails fast instead of rendering
 * garbage. The committed catalog seed (P0-05) is what a fresh clone — and CI —
 * runs against; the dataset-derived placeholder is only ever a local overlay.
 */

function firstError(label: string, error: ZodError): string {
	const issue = error.issues[0];
	if (!issue) return `${label}: invalid catalog data`;
	const path = issue.path.length > 0 ? issue.path.join(".") : "<root>";
	return `${label}: invalid catalog data at ${path} — ${issue.message}`;
}

function assertUniqueIds(label: string, ids: string[]): void {
	const seen = new Set<string>();
	for (const id of ids) {
		if (seen.has(id)) throw new Error(`${label}: duplicate id "${id}"`);
		seen.add(id);
	}
}

/** Validate a raw pedals array; throws on the first bad entry. */
export function parsePedals(input: unknown): CatalogPedal[] {
	const result = CatalogPedalSchema.array().safeParse(input);
	if (!result.success) throw new Error(firstError("pedals.json", result.error));
	assertUniqueIds(
		"pedals.json",
		result.data.map((p) => p.id),
	);

	// variantOf must resolve to an existing pedal (and not itself), or the
	// catalog would ship a dangling colorway reference.
	const ids = new Set(result.data.map((p) => p.id));
	for (const pedal of result.data) {
		if (pedal.variantOf === pedal.id) {
			throw new Error(`pedals.json: "${pedal.id}" cannot be its own variantOf`);
		}
		if (pedal.variantOf && !ids.has(pedal.variantOf)) {
			throw new Error(
				`pedals.json: "${pedal.id}" references missing variantOf "${pedal.variantOf}"`,
			);
		}
	}
	return result.data;
}

/** Validate a raw boards array; throws on the first bad entry. */
export function parseBoards(input: unknown): CatalogBoard[] {
	const result = CatalogBoardSchema.array().safeParse(input);
	if (!result.success) throw new Error(firstError("boards.json", result.error));
	assertUniqueIds(
		"boards.json",
		result.data.map((b) => b.id),
	);
	return result.data;
}

/** Validate a raw catalog; throws on the first bad entry. */
export function parseCatalog(pedals: unknown, boards: unknown): Catalog {
	return { pedals: parsePedals(pedals), boards: parseBoards(boards) };
}

/** The shipped catalog, validated at module load (fail fast). */
export const catalog: Catalog = parseCatalog(pedalsJson, boardsJson);
