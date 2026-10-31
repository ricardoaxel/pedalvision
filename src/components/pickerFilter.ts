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
	brandCompact: string;
	nameCompact: string;
	effectsCompact: string;
	brandEnd: Uint8Array;
	nameEnd: Uint8Array;
	effectsEnd: Uint8Array;
	fullCompact: string;
	fullEnd: Uint8Array;
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
 * Separator-free form plus a per-character token-end mask. The mask lets the
 * trailing-digit guard reject `dd2` inside `dd 20` while still accepting
 * `fbm1` in `FBM-1 '59` (the next digit starts a NEW token).
 */
function compactField(value: string): { compact: string; ends: Uint8Array } {
	const compact = value.replace(/\s+/g, "");
	const ends = new Uint8Array(compact.length);
	let compactIndex = 0;
	for (let index = 0; index < value.length; index++) {
		if (value[index] === " ") continue;
		const next = value[index + 1];
		ends[compactIndex] = next === undefined || next === " " ? 1 : 0;
		compactIndex++;
	}
	return { compact, ends };
}

function indexItem<T extends { id: string; brand: string; name: string }>(
	item: T,
	extraText: string,
): IndexedItem<T> {
	const brandKey = normalizeSearch(item.brand);
	const nameKey = normalizeSearch(item.name);
	const effectsKey = normalizeSearch(extraText);
	const brand = compactField(brandKey);
	const name = compactField(nameKey);
	const effects = compactField(effectsKey);
	const full = compactField(`${brandKey} ${nameKey}`);
	return {
		item,
		idKey: normalizeSearch(item.id),
		brandKey,
		nameKey,
		effectsKey,
		brandCompact: brand.compact,
		nameCompact: name.compact,
		effectsCompact: effects.compact,
		brandEnd: brand.ends,
		nameEnd: name.ends,
		effectsEnd: effects.ends,
		fullCompact: full.compact,
		fullEnd: full.ends,
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

interface TermVariant {
	/** Normalized term (may contain internal spaces). */
	term: string;
	/** Separator-free form, so `b7kultra` matches `b7k ultra`. */
	compact: string;
	/** A trailing digit must not continue into a longer number (dd2 ≠ dd20). */
	endsWithDigit: boolean;
}

interface TermMatcher {
	variants: TermVariant[];
}

function toVariant(term: string): TermVariant {
	return {
		term,
		compact: term.replace(/\s+/g, ""),
		endsWithDigit: /\p{N}$/u.test(term),
	};
}

/** Compile each term (and its alias targets) once per filter change. */
function compileTerms(terms: string[]): TermMatcher[] {
	return terms.map((term) => ({
		variants: [term, ...aliasesFor(term)].map(toVariant),
	}));
}

/**
 * First separator-free occurrence that respects the trailing-digit rule.
 * `dd2` rejects `dd20` (same token continues with a digit) but accepts
 * `dd2`/`dd 2`/`dd2w` and `fbm1` in `FBM-1 '59` (the next digit is a new token).
 */
function compactMatch(
	field: string,
	ends: Uint8Array,
	variant: TermVariant,
): number {
	let from = 0;
	while (true) {
		const index = field.indexOf(variant.compact, from);
		if (index === -1) return -1;
		const end = index + variant.compact.length - 1;
		const next = field[end + 1];
		const continuesNumber =
			ends[end] === 0 && next !== undefined && /\p{N}/u.test(next);
		if (!(variant.endsWithDigit && continuesNumber)) return index;
		from = index + 1;
	}
}

interface FieldScores {
	exact: number;
	start: number;
	word: number;
	compact: number;
}

function fieldScore(
	field: string,
	compactField: string,
	fieldEnds: Uint8Array,
	variant: TermVariant,
	scores: FieldScores,
): number | null {
	const index = compactMatch(compactField, fieldEnds, variant);
	if (index === -1) return null;
	if (field === variant.term || compactField === variant.compact) {
		return scores.exact;
	}
	if (index === 0) return scores.start;
	if (variant.term.includes(" ")) return scores.compact;
	if (field.includes(` ${variant.term}`)) return scores.word;
	return scores.compact;
}

const NAME_SCORES: FieldScores = {
	exact: 60,
	start: 50,
	word: 30,
	compact: 20,
};
const BRAND_SCORES: FieldScores = {
	exact: 55,
	start: 25,
	word: 15,
	compact: 10,
};
const EFFECT_SCORES: FieldScores = {
	exact: 12,
	start: 10,
	word: 8,
	compact: 5,
};

/**
 * Best score for one term against an item: name exact 60 > brand exact 55 >
 * name start 50 > name word 30 > brand start 25 > name compact 20 > brand word
 * 15 > effect exact 12 > effect start 10 > effect word 8 > effect compact 5.
 * `null` means no match at all.
 */
function bestTermScore(
	record: IndexedItem<unknown>,
	matcher: TermMatcher,
): number | null {
	let best: number | null = null;
	for (const variant of matcher.variants) {
		const scores = [
			fieldScore(
				record.nameKey,
				record.nameCompact,
				record.nameEnd,
				variant,
				NAME_SCORES,
			),
			fieldScore(
				record.brandKey,
				record.brandCompact,
				record.brandEnd,
				variant,
				BRAND_SCORES,
			),
			fieldScore(
				record.effectsKey,
				record.effectsCompact,
				record.effectsEnd,
				variant,
				EFFECT_SCORES,
			),
		];
		for (const score of scores) {
			if (score !== null && (best === null || score > best)) best = score;
		}
		// Brand + model concatenations (`bossdd2`, `mxrphase90`) get a modest
		// score; the individual fields still outrank them when they match.
		if (compactMatch(record.fullCompact, record.fullEnd, variant) !== -1) {
			best = Math.max(best ?? 0, 18);
		}
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
		(a, b) =>
			b.score - a.score ||
			a.record.nameCompact.length - b.record.nameCompact.length ||
			byBrand(a.record, b.record),
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
