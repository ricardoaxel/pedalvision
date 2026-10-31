/**
 * Search aliases for the catalog picker (F-38).
 *
 * Deliberately tiny and data-only — no catalog/schema change. Keys and targets
 * are already normalized (lowercase, punctuation folded to spaces) so the
 * matcher can look them up without re-normalizing. Model shorthand such as
 * `dd2`/`bd2`/`ts9` is handled by normalization itself (the catalog name holds
 * the model token), so it is not listed here.
 */
export const SEARCH_ALIASES: Readonly<Record<string, readonly string[]>> = {
	ehx: ["electro harmonix"],
	eqd: ["earthquaker"],
	tc: ["tc electronic"],
};

/** Alias targets for a normalized query term (empty when none). */
export function aliasesFor(term: string): readonly string[] {
	return SEARCH_ALIASES[term] ?? [];
}
