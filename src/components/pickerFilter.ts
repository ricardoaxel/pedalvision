import type { CatalogBoard, CatalogPedal, EffectType } from "../catalog/schema";
import { aliasesFor } from "../lib/searchAliases";

/**
 * Picker filter logic (P2-01, search overhaul F-38) — pure, so search +
 * brand/effect matching + sorting is unit-tested independently of the DOM.
 *
 * Pedals and boards share the text query (matched against brand, name, effect
 * labels and a tiny alias layer) and a single brand; pedals additionally filter
 * by effect type. An empty query / no selected brand / no selected effect type
 * means "no constraint on that axis".
 */
export type PickerSort = "relevance" | "brand" | "name";

export interface PedalFilter {
	query: string;
	/** Exact brand match, or null for "all brands". */
	brand: string | null;
	/** Matches an item sharing ANY selected effect type (OR). */
	effectTypes: EffectType[];
	/** Deterministic order; defaults to relevance. */
	sort?: PickerSort;
}

export interface BoardFilter {
	query: string;
	brand: string | null;
	/** Deterministic order; defaults to relevance. */
	sort?: PickerSort;
}

/** One catalog item flattened into normalized search/sort keys. */
interface IndexedItem<T> {
	item: T;
	idKey: string;
	brandKey: string;
	nameKey: string;
	effectsKey: string;
}

export interface SearchIndex<T> {
	records: IndexedItem<T>[];
}

/** NFKD, strip diacritics, lowercase, fold `&`, punctuation → space. */
export function normalizeSearch(value: string): string {
	return value
		.normalize("NFKD")
		.replace(/\p{M}/gu, "")
		.toLowerCase()
		.replace(/&/g, " and ")
		.replace(/[^\p{L}\p{N}]+/gu, " ")
		.trim()
		.replace(/\s+/g, " ");
}

/**
 * Split the RAW query on whitespace first, then normalize each chunk, so
 * `DD-2` stays one term (`dd 2`) instead of becoming `dd` + `2`.
 */
export function queryTerms(query: string): string[] {
	return query
		.trim()
		.split(/\s+/)
		.map((chunk) => normalizeSearch(chunk))
		.filter((term) => term.length > 0);
}

/**
 * Boundary-aware term pattern. Alphanumeric runs become separator-tolerant
 * groups: `dd2` and `dd-2` both build `\bdd\s*2\b`, which matches `DD-2`,
 * `dd2` and `DD 2`, but not `DD-20` (`2\b` cannot match before `0`).
 */
function termPattern(term: string): RegExp | null {
	const groups = term.match(/[\p{L}]+|\p{N}+/gu);
	if (!groups || groups.length === 0) return null;
	const source = groups
		.map((group) => group.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
		.join("\\s*");
	return new RegExp(`\\b${source}\\b`, "i");
}

function indexItem<T extends { id: string; brand: string; name: string }>(
	item: T,
	extraText: string,
): IndexedItem<T> {
	return {
		item,
		idKey: normalizeSearch(item.id),
		brandKey: normalizeSearch(item.brand),
		nameKey: normalizeSearch(item.name),
		effectsKey: normalizeSearch(extraText),
	};
}

/** Build the pedal search index once per catalog version. Supplies excluded. */
export function buildPedalIndex(
	pedals: CatalogPedal[],
): SearchIndex<CatalogPedal> {
	const records: IndexedItem<CatalogPedal>[] = [];
	for (const pedal of pedals) {
		if (pedal.category !== "pedal") continue;
		records.push(
			indexItem(pedal, pedal.effectTypes.map(effectLabel).join(" ")),
		);
	}
	return { records };
}

/** Build the board search index once per catalog version. */
export function buildBoardIndex(
	boards: CatalogBoard[],
): SearchIndex<CatalogBoard> {
	return { records: boards.map((board) => indexItem(board, "")) };
}

interface TermMatcher {
	patterns: RegExp[];
}

/** Compile each term (and its alias targets) once per filter change. */
function compileTerms(terms: string[]): TermMatcher[] {
	return terms.map((term) => ({
		patterns: [term, ...aliasesFor(term)]
			.map((variant) => termPattern(variant))
			.filter((pattern): pattern is RegExp => pattern !== null),
	}));
}

/**
 * Best score for one term against an item: name start > name inside > brand >
 * effect/alias. `null` means the term does not match at all.
 */
function bestTermScore(
	record: IndexedItem<unknown>,
	matcher: TermMatcher,
): number | null {
	let best: number | null = null;
	for (const pattern of matcher.patterns) {
		const nameMatch = pattern.exec(record.nameKey);
		const score = nameMatch
			? nameMatch.index === 0
				? 50
				: 30
			: pattern.test(record.brandKey)
				? 20
				: pattern.test(record.effectsKey)
					? 10
					: null;
		if (score !== null && (best === null || score > best)) best = score;
	}
	return best;
}

/** Sum of per-term scores; `null` when any term fails (AND semantics). */
function scoreRecord(
	record: IndexedItem<unknown>,
	matchers: TermMatcher[],
): number | null {
	let total = 0;
	for (const matcher of matchers) {
		const score = bestTermScore(record, matcher);
		if (score === null) return null;
		total += score;
	}
	return total;
}

function compareKeys(a: string, b: string): number {
	if (a < b) return -1;
	if (a > b) return 1;
	return 0;
}

function byBrand<T>(a: IndexedItem<T>, b: IndexedItem<T>): number {
	return (
		compareKeys(a.brandKey, b.brandKey) ||
		compareKeys(a.nameKey, b.nameKey) ||
		compareKeys(a.idKey, b.idKey)
	);
}

function byName<T>(a: IndexedItem<T>, b: IndexedItem<T>): number {
	return (
		compareKeys(a.nameKey, b.nameKey) ||
		compareKeys(a.brandKey, b.brandKey) ||
		compareKeys(a.idKey, b.idKey)
	);
}

interface Scored<T> {
	record: IndexedItem<T>;
	score: number;
}

function sortScored<T>(
	scored: Scored<T>[],
	sort: PickerSort,
	hasQuery: boolean,
): Scored<T>[] {
	if (sort === "brand")
		return scored.sort((a, b) => byBrand(a.record, b.record));
	if (sort === "name") return scored.sort((a, b) => byName(a.record, b.record));
	// Relevance has no signal without a query: keep catalog order (curated
	// first) so the resting picker is unchanged.
	if (!hasQuery) return scored;
	return scored.sort(
		(a, b) => b.score - a.score || byBrand(a.record, b.record),
	);
}

function matchingScored<T>(
	records: IndexedItem<T>[],
	matchers: TermMatcher[],
	keep: (record: IndexedItem<T>) => boolean,
): Scored<T>[] {
	const scored: Scored<T>[] = [];
	for (const record of records) {
		if (!keep(record)) continue;
		const score = scoreRecord(record, matchers);
		if (score === null) continue;
		scored.push({ record, score });
	}
	return scored;
}

/**
 * Filter a prebuilt pedal index. A non-empty query that normalizes to no terms
 * (e.g. `!!!`) matches nothing, mirroring the old substring behaviour.
 */
export function filterPedalIndex(
	index: SearchIndex<CatalogPedal>,
	filter: PedalFilter,
): CatalogPedal[] {
	const terms = queryTerms(filter.query);
	if (filter.query.trim().length > 0 && terms.length === 0) return [];
	const scored = matchingScored(
		index.records,
		compileTerms(terms),
		(record) => {
			const pedal = record.item;
			if (filter.brand && pedal.brand !== filter.brand) return false;
			if (
				filter.effectTypes.length > 0 &&
				!pedal.effectTypes.some((type) => filter.effectTypes.includes(type))
			) {
				return false;
			}
			return true;
		},
	);
	return sortScored(scored, filter.sort ?? "relevance", terms.length > 0).map(
		(entry) => entry.record.item,
	);
}

/** Filter a prebuilt board index (same query + brand + sort rules). */
export function filterBoardIndex(
	index: SearchIndex<CatalogBoard>,
	filter: BoardFilter,
): CatalogBoard[] {
	const terms = queryTerms(filter.query);
	if (filter.query.trim().length > 0 && terms.length === 0) return [];
	const scored = matchingScored(
		index.records,
		compileTerms(terms),
		(record) => {
			const board = record.item;
			return !filter.brand || board.brand === filter.brand;
		},
	);
	return sortScored(scored, filter.sort ?? "relevance", terms.length > 0).map(
		(entry) => entry.record.item,
	);
}

/** Convenience wrapper for small callers/tests; the picker reuses the index. */
export function filterPedals(
	pedals: CatalogPedal[],
	filter: PedalFilter,
): CatalogPedal[] {
	return filterPedalIndex(buildPedalIndex(pedals), filter);
}

/** Convenience wrapper for small callers/tests; the picker reuses the index. */
export function filterBoards(
	boards: CatalogBoard[],
	filter: BoardFilter,
): CatalogBoard[] {
	return filterBoardIndex(buildBoardIndex(boards), filter);
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
