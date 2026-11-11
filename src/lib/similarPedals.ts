import type { CatalogPedal, EffectType } from "../catalog/schema";

/**
 * F-14 "Cross-Reference" — find catalogue alternatives to a placed pedal.
 *
 * Pure catalogue-in/data-out so the ranking is unit-tested without the DOM.
 * "Similar" means the same product category with at least one shared effect
 * type; the target itself is always excluded. Rank order:
 *
 * 1. number of shared effect types (desc)
 * 2. same brand (true first) — a first step towards the same family
 * 3. closest footprint, |Δwidth| + |Δheight| in cm (asc)
 * 4. name, then id (asc) — deterministic tie-break
 *
 * Only stored catalogue facts are used (effect types, brand, cm dimensions);
 * nothing is inferred from names, images or jack data.
 */

/** How many alternatives the info panel shows (owner-approved cap). */
export const SIMILAR_PEDALS_LIMIT = 4;

export interface SimilarPedal {
	id: string;
	brand: string;
	name: string;
	widthCm: number;
	heightCm: number;
	/** Effect types shared with the target, in the target's own order. */
	sharedEffectTypes: EffectType[];
}

function footprintDistance(a: CatalogPedal, b: CatalogPedal): number {
	return Math.abs(a.widthCm - b.widthCm) + Math.abs(a.heightCm - b.heightCm);
}

function compareNames(a: CatalogPedal, b: CatalogPedal): number {
	if (a.name !== b.name) return a.name < b.name ? -1 : 1;
	if (a.id === b.id) return 0;
	return a.id < b.id ? -1 : 1;
}

/**
 * Return up to `limit` catalogue pedals similar to `target` (default 4).
 * Empty when the target has no effect types or is not a pedal.
 */
export function similarPedals(
	target: CatalogPedal,
	pedals: readonly CatalogPedal[],
	limit: number = SIMILAR_PEDALS_LIMIT,
): SimilarPedal[] {
	if (limit <= 0) return [];
	if (target.category !== "pedal" || target.effectTypes.length === 0) return [];

	const candidates: { pedal: CatalogPedal; shared: EffectType[] }[] = [];
	for (const pedal of pedals) {
		if (pedal.id === target.id || pedal.category !== "pedal") continue;
		const shared = target.effectTypes.filter((type) =>
			pedal.effectTypes.includes(type),
		);
		if (shared.length === 0) continue;
		// `utility` is the catalogue's catch-all role, not a shared sound
		// property (the bulk planner overlay tags thousands of placeholders
		// with it). A candidate whose ONLY type is `utility` would otherwise
		// flood the list with unrelated devices.
		if (pedal.effectTypes.length === 1 && pedal.effectTypes[0] === "utility")
			continue;
		candidates.push({ pedal, shared });
	}

	candidates.sort((a, b) => {
		if (a.shared.length !== b.shared.length)
			return b.shared.length - a.shared.length;
		const sameBrandA = a.pedal.brand === target.brand ? 1 : 0;
		const sameBrandB = b.pedal.brand === target.brand ? 1 : 0;
		if (sameBrandA !== sameBrandB) return sameBrandB - sameBrandA;
		const distance =
			footprintDistance(a.pedal, target) - footprintDistance(b.pedal, target);
		if (distance !== 0) return distance;
		return compareNames(a.pedal, b.pedal);
	});

	return candidates.slice(0, limit).map(({ pedal, shared }) => ({
		id: pedal.id,
		brand: pedal.brand,
		name: pedal.name,
		widthCm: pedal.widthCm,
		heightCm: pedal.heightCm,
		sharedEffectTypes: shared,
	}));
}
