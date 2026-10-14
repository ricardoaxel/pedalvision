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
 */

export type SelectOptions = {
	brandLimit: number;
	topBrandCap: number;
	perBrandCap: number;
	supplyLimit: number;
};

export const DEFAULT_SELECT: SelectOptions = {
	brandLimit: 10,
	topBrandCap: 40,
	perBrandCap: 18,
	supplyLimit: 5,
};

function byName<T extends { name: string; id: string }>(a: T, b: T): number {
	return a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
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
		.sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
		.slice(0, opts.brandLimit);

	const chosen: CatalogPedal[] = [];
	brands.forEach(([, items], index) => {
		const cap = index === 0 ? opts.topBrandCap : opts.perBrandCap;
		chosen.push(...[...items].sort(byName).slice(0, cap));
	});

	// Never ship a dangling colorway: a variant is kept only if its base made
	// the slice (the cap can otherwise split a base from its variant).
	const selectedIds = new Set(chosen.map((pedal) => pedal.id));
	const kept = chosen.filter(
		(pedal) => !pedal.variantOf || selectedIds.has(pedal.variantOf),
	);

	// Top up power supplies so the picker/loose-item paths are exercised.
	const keptIds = new Set(kept.map((pedal) => pedal.id));
	const supplies = pedals
		.filter((pedal) => pedal.category === "supply" && !keptIds.has(pedal.id))
		.sort((a, b) => a.brand.localeCompare(b.brand) || byName(a, b))
		.slice(0, opts.supplyLimit);

	return [...kept, ...supplies];
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
		.sort((a, b) => a[0].localeCompare(b[0]))
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
