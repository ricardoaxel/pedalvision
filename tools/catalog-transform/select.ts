import type { CatalogBoard, CatalogPedal } from "../../src/catalog/schema.ts";

/**
 * Deterministic subset selection for the committed seed. The seed is a slice of
 * the full catalog (kept small so the repo and CI stay lean); the rest is
 * backfilled later (see README / the task's follow-up note).
 *
 * Rule: rank brands by pedal count (desc, then name), keep the top `brandLimit`
 * brands; the single largest brand contributes up to `topBrandCap` pedals (so it
 * is visibly the biggest group), every other kept brand up to `perBrandCap`.
 * Within a brand, items are sorted by name so the slice is stable. A few power
 * supplies are topped up (any brand) so the picker/loose-item paths have data.
 *
 * Ordering uses codepoint comparison (not `localeCompare`) so the result does
 * not depend on the runtime locale — the slice must be identical everywhere.
 */

export type SelectOptions = {
	brandLimit: number;
	topBrandCap: number;
	perBrandCap: number;
	supplyLimit: number;
	/** Ids always kept regardless of the caps (e.g. the verified override set). */
	keepIds?: string[];
};

export const DEFAULT_SELECT: SelectOptions = {
	brandLimit: 10,
	topBrandCap: 40,
	perBrandCap: 18,
	supplyLimit: 5,
};

function compare(a: string, b: string): number {
	return a < b ? -1 : a > b ? 1 : 0;
}

function byName<T extends { name: string; id: string }>(a: T, b: T): number {
	return compare(a.name, b.name) || compare(a.id, b.id);
}

/** Keep a variant only if its base is also present (never ship a dangling link). */
function dropDangling(pedals: CatalogPedal[]): CatalogPedal[] {
	const ids = new Set(pedals.map((pedal) => pedal.id));
	return pedals.filter((pedal) => !pedal.variantOf || ids.has(pedal.variantOf));
}

export function selectPedals(
	pedals: CatalogPedal[],
	options: Partial<SelectOptions> = {},
): CatalogPedal[] {
	const opts = { ...DEFAULT_SELECT, ...options };

	const byBrand = new Map<string, CatalogPedal[]>();
	for (const pedal of pedals) {
		const list = byBrand.get(pedal.brand);
		if (list) list.push(pedal);
		else byBrand.set(pedal.brand, [pedal]);
	}

	const brands = [...byBrand.entries()]
		.sort((a, b) => b[1].length - a[1].length || compare(a[0], b[0]))
		.slice(0, opts.brandLimit);

	const chosen: CatalogPedal[] = [];
	brands.forEach(([, items], index) => {
		const cap = index === 0 ? opts.topBrandCap : opts.perBrandCap;
		chosen.push(...[...items].sort(byName).slice(0, cap));
	});

	// Top up power supplies so the picker/loose-item paths are exercised.
	const chosenIds = new Set(chosen.map((pedal) => pedal.id));
	const supplies = pedals
		.filter((pedal) => pedal.category === "supply" && !chosenIds.has(pedal.id))
		.sort((a, b) => compare(a.brand, b.brand) || byName(a, b))
		.slice(0, opts.supplyLimit);

	// Always keep the verified override set (and any other pinned ids) so the
	// seed reproduces the curated models even when they fall outside the caps.
	const pinned = new Set(opts.keepIds ?? []);
	const keptIds = new Set([...chosen, ...supplies].map((pedal) => pedal.id));
	const extras = pedals.filter(
		(pedal) => pinned.has(pedal.id) && !keptIds.has(pedal.id),
	);

	return dropDangling([...chosen, ...supplies, ...extras]);
}

/**
 * Pick `limit` boards spread across brands (round-robin, one per brand at a
 * time) rather than clustered in one brand. Deterministic.
 */
export function selectBoards(
	boards: CatalogBoard[],
	limit: number,
): CatalogBoard[] {
	const byBrand = new Map<string, CatalogBoard[]>();
	for (const board of boards) {
		const list = byBrand.get(board.brand);
		if (list) list.push(board);
		else byBrand.set(board.brand, [board]);
	}

	const groups = [...byBrand.entries()]
		.sort((a, b) => compare(a[0], b[0]))
		.map(([, items]) => [...items].sort(byName));

	const chosen: CatalogBoard[] = [];
	for (let round = 0; chosen.length < limit; round++) {
		let added = false;
		for (const group of groups) {
			if (chosen.length >= limit) break;
			const item = group[round];
			if (item) {
				chosen.push(item);
				added = true;
			}
		}
		if (!added) break;
	}
	return chosen;
}
