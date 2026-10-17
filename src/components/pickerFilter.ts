import type { CatalogBoard, CatalogPedal, EffectType } from "../catalog/schema";

/**
 * Picker filter logic (P2-01) — pure, so search + brand/effect matching is
 * unit-tested independently of the DOM.
 *
 * Pedals and boards share the text query (matched against "brand name") and a
 * single brand; pedals additionally filter by effect type. An empty query / no
 * selected brand / no selected effect type means "no constraint on that axis".
 */
export interface PedalFilter {
	query: string;
	/** Exact brand match, or null for "all brands". */
	brand: string | null;
	/** Matches an item sharing ANY selected effect type (OR). */
	effectTypes: EffectType[];
}

export interface BoardFilter {
	query: string;
	brand: string | null;
}

function normalize(value: string): string {
	return value.trim().toLowerCase();
}

function matchesQuery(brand: string, name: string, query: string): boolean {
	const q = normalize(query);
	return q.length === 0 || `${brand} ${name}`.toLowerCase().includes(q);
}

/** Catalog pedals (category "pedal" only — supplies are P2-02) matching `filter`. */
export function filterPedals(
	pedals: CatalogPedal[],
	filter: PedalFilter,
): CatalogPedal[] {
	return pedals.filter((pedal) => {
		if (pedal.category !== "pedal") return false;
		if (filter.brand && pedal.brand !== filter.brand) return false;
		if (
			filter.effectTypes.length > 0 &&
			!pedal.effectTypes.some((type) => filter.effectTypes.includes(type))
		) {
			return false;
		}
		return matchesQuery(pedal.brand, pedal.name, filter.query);
	});
}

/** Catalog boards matching the shared query + brand filter. */
export function filterBoards(
	boards: CatalogBoard[],
	filter: BoardFilter,
): CatalogBoard[] {
	return boards.filter(
		(board) =>
			(!filter.brand || board.brand === filter.brand) &&
			matchesQuery(board.brand, board.name, filter.query),
	);
}

/** The distinct brands present in `items`, sorted for a stable filter menu. */
export function brandsOf(items: { brand: string }[]): string[] {
	return [...new Set(items.map((item) => item.brand))].sort((a, b) =>
		a.localeCompare(b),
	);
}

/**
 * The brands offered in the Pedals tab's filter menu. Supplies are excluded
 * (they are a different tab/task), so a supply-only brand must not appear.
 */
export function pedalBrands(pedals: CatalogPedal[]): string[] {
	return brandsOf(pedals.filter((pedal) => pedal.category === "pedal"));
}

/** Toggle one effect type in/out of the selected set (order preserved). */
export function toggleEffectType(
	selected: EffectType[],
	type: EffectType,
): EffectType[] {
	return selected.includes(type)
		? selected.filter((candidate) => candidate !== type)
		: [...selected, type];
}

/** Acronyms that must not be title-cased by {@link effectLabel}. */
const EFFECT_ACRONYMS: Partial<Record<EffectType, string>> = {
	eq: "EQ",
	di: "DI",
	"ab-box": "A/B Box",
	"amp-modeler": "Amp Modeler",
	"cab-sim": "Cab Sim",
	"acoustic-sim": "Acoustic Sim",
	"organ-sim": "Organ Sim",
	"ring-mod": "Ring Mod",
};

/** Human label for an effect-type chip ("ab-box" → "A/B Box", "eq" → "EQ"). */
export function effectLabel(type: EffectType): string {
	const acronym = EFFECT_ACRONYMS[type];
	if (acronym) return acronym;
	return type
		.split("-")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
}
