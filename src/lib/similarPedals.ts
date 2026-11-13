import type { CatalogPedal } from "../catalog/schema";
import {
	capabilitiesOf,
	categoryFallbackLabel,
	circuitById,
	circuitOf,
	delayRoleRank,
	familyOf,
	isBassModel,
	isFinishOnly,
	isMultiProcessor,
	pluralEffect,
	type SimilarCapability,
	sharedCapability,
	subtypeLabel,
	subtypeOf,
} from "./similarModel";

/**
 * F-14 "Similar" — sound-alike groups for a selected catalogue pedal.
 *
 * Replaces the old flat "shares ≥1 effect type" ranker. Evidence tiers:
 *   - a cross-brand circuit/algorithm match (Tube Screamer-style, BBD analog
 *     delay, …) or a same delay/reverb subtype (digital delay, hall reverb, …),
 *   - the maker's own family/lineage (DD-5, DD-6, DD-7, DD-8, …).
 *
 * The cross-brand group is shown first (that is the owner's question: "what
 * else can I buy that sounds like this?"), with the family as a compact
 * register underneath. The last-resort category tier is limited to single-
 * effect role categories (octave, pitch, modulation, compression); drives/fuzz
 * and unknown delay/reverb subtypes stay hidden rather than becoming noise.
 */

export type SimilarTier = "circuit" | "subtype" | "category" | "family";

export interface SimilarItem {
	id: string;
	brand: string;
	name: string;
	/** Compact register label for a family member (e.g. "DD-5"). */
	shortLabel: string;
	widthCm: number;
	heightCm: number;
	/** Most useful shared role/feature, if any (stereo, tap, …). */
	capability: SimilarCapability | null;
}

export interface SimilarGroup {
	tier: SimilarTier;
	/** Cross group: the shared circuit/subtype. Family: "Also from <brand>". */
	label: string;
	items: SimilarItem[];
}

/** How many of the maker's own family members the register shows. */
export const SIMILAR_FAMILY_LIMIT = 5;
/** How many cross-brand sound-alikes the section shows. */
export const SIMILAR_CROSS_LIMIT = 3;

function item(
	candidate: CatalogPedal,
	target: CatalogPedal,
	shortLabel = candidate.name,
): SimilarItem {
	return {
		id: candidate.id,
		brand: candidate.brand,
		name: candidate.name,
		shortLabel,
		widthCm: candidate.widthCm,
		heightCm: candidate.heightCm,
		capability: sharedCapability(target, candidate),
	};
}

function footprintDistance(a: CatalogPedal, b: CatalogPedal): number {
	return Math.abs(a.widthCm - b.widthCm) + Math.abs(a.heightCm - b.heightCm);
}

function compareNames(a: CatalogPedal, b: CatalogPedal): number {
	if (a.name !== b.name) return a.name < b.name ? -1 : 1;
	if (a.id === b.id) return 0;
	return a.id < b.id ? -1 : 1;
}

function sharedCapabilityCount(a: CatalogPedal, b: CatalogPedal): number {
	const target = capabilitiesOf(a);
	const candidate = capabilitiesOf(b);
	let count = 0;
	for (const capability of target) {
		if (candidate.has(capability)) count += 1;
	}
	return count;
}

function currentScore(pedal: CatalogPedal): number {
	return pedal.status === "current" ? 1 : 0;
}

/**
 * Collapse finish/revision variants of the same family to one row. The family
 * register already shows the target's own family, so a cross tier should never
 * spend three slots on Carbon Copy Mini/Bright/Deluxe.
 */
function collapseFamilyDuplicates(candidates: CatalogPedal[]): CatalogPedal[] {
	const byFamily = new Map<string, { pedal: CatalogPedal; order: number }>();
	const kept: CatalogPedal[] = [];
	for (const pedal of candidates) {
		const family = familyOf(pedal);
		if (!family) {
			kept.push(pedal);
			continue;
		}
		const current = byFamily.get(family.key);
		if (!current || family.order < current.order) {
			byFamily.set(family.key, { pedal, order: family.order });
		}
	}
	for (const { pedal } of byFamily.values()) kept.push(pedal);
	return kept;
}

function eligibleCandidate(
	target: CatalogPedal,
	candidate: CatalogPedal,
): boolean {
	if (candidate.id === target.id) return false;
	if (candidate.category !== "pedal") return false;
	if (isFinishOnly(candidate)) return false;
	// A guitar target never gets a bass model (and vice versa).
	if (isBassModel(target) !== isBassModel(candidate)) return false;
	return true;
}

function familyGroup(
	target: CatalogPedal,
	pedals: readonly CatalogPedal[],
): SimilarGroup | null {
	const targetFamily = familyOf(target);
	if (!targetFamily) return null;
	const members: { pedal: CatalogPedal; order: number; short: string }[] = [];
	for (const candidate of pedals) {
		if (!eligibleCandidate(target, candidate)) continue;
		if (
			!candidate.effectTypes.some((type) => target.effectTypes.includes(type))
		)
			continue;
		const family = familyOf(candidate);
		if (!family || family.key !== targetFamily.key) continue;
		members.push({
			pedal: candidate,
			order: family.order,
			short: family.shortLabel,
		});
	}
	// Successors/replacements first, then predecessors, so DD-3T/DD-5 come
	// before DD-2 on a DD-3. Lineage order is the point of a register.
	members.sort((a, b) => {
		const aAfter = a.order > targetFamily.order ? 0 : 1;
		const bAfter = b.order > targetFamily.order ? 0 : 1;
		if (aAfter !== bAfter) return aAfter - bAfter;
		// Successors: nearest first (ascending). Predecessors: nearest first
		// (descending), so a cap trims the farthest lineage member, not DD-7.
		const lineage = aAfter === 0 ? a.order - b.order : b.order - a.order;
		return (
			lineage ||
			currentScore(b.pedal) - currentScore(a.pedal) ||
			compareNames(a.pedal, b.pedal)
		);
	});
	const items = members
		.slice(0, SIMILAR_FAMILY_LIMIT)
		.map((member) => item(member.pedal, target, member.short));
	if (items.length === 0) return null;
	return { tier: "family", label: `Also from ${target.brand}`, items };
}

function circuitGroup(
	target: CatalogPedal,
	pedals: readonly CatalogPedal[],
	targetFamilyKey: string | null,
): SimilarGroup | null {
	const targetCircuit = circuitOf(target);
	if (!targetCircuit) return null;
	const def = circuitById(targetCircuit.key);
	if (!def) return null;
	const ids = new Set([...def.core, ...(def.adjacent ?? [])]);
	const targetCircuitIds = new Set(def.core);
	const candidates: CatalogPedal[] = [];
	for (const candidate of pedals) {
		if (!ids.has(candidate.id)) continue;
		if (!eligibleCandidate(target, candidate)) continue;
		if (candidate.effectTypes[0] !== target.effectTypes[0]) continue;
		const family = familyOf(candidate);
		if (targetFamilyKey && family?.key === targetFamilyKey) continue;
		if (isMultiProcessor(candidate) && !isMultiProcessor(target)) continue;
		candidates.push(candidate);
	}
	const collapsed = collapseFamilyDuplicates(candidates);
	collapsed.sort((a, b) => {
		const aCore = targetCircuitIds.has(a.id) ? 1 : 0;
		const bCore = targetCircuitIds.has(b.id) ? 1 : 0;
		if (aCore !== bCore) return bCore - aCore;
		const capabilityDelta =
			sharedCapabilityCount(target, b) - sharedCapabilityCount(target, a);
		if (capabilityDelta !== 0) return capabilityDelta;
		const currentDelta = currentScore(b) - currentScore(a);
		if (currentDelta !== 0) return currentDelta;
		const distance =
			footprintDistance(a, target) - footprintDistance(b, target);
		if (distance !== 0) return distance;
		return compareNames(a, b);
	});
	const items = collapsed
		.slice(0, SIMILAR_CROSS_LIMIT)
		.map((candidate) => item(candidate, target));
	if (items.length === 0) return null;
	return { tier: "circuit", label: def.label, items };
}

function subtypeGroup(
	target: CatalogPedal,
	pedals: readonly CatalogPedal[],
	targetFamilyKey: string | null,
): SimilarGroup | null {
	const subtype = subtypeOf(target);
	if (!subtype) return null;
	const primary = target.effectTypes[0];
	const candidates: CatalogPedal[] = [];
	for (const candidate of pedals) {
		if (!eligibleCandidate(target, candidate)) continue;
		if (candidate.effectTypes[0] !== primary) continue;
		// The family register covers the target's own brand; this tier is the
		// "other brands" answer.
		if (candidate.brand === target.brand) continue;
		const family = familyOf(candidate);
		if (targetFamilyKey && family?.key === targetFamilyKey) continue;
		if (subtypeOf(candidate) !== subtype) continue;
		if (isMultiProcessor(candidate)) continue;
		candidates.push(candidate);
	}
	const collapsed = collapseFamilyDuplicates(candidates);
	collapsed.sort((a, b) => {
		// Plain delays before pitch/granular tools that merely share the tag.
		const roleDelta = delayRoleRank(a) - delayRoleRank(b);
		if (roleDelta !== 0) return roleDelta;
		// Prefer the same format (compact stays compact).
		const aCompact = capabilitiesOf(a).has("Compact") ? 0 : 1;
		const bCompact = capabilitiesOf(b).has("Compact") ? 0 : 1;
		if (aCompact !== bCompact) return aCompact - bCompact;
		const capabilityDelta =
			sharedCapabilityCount(target, b) - sharedCapabilityCount(target, a);
		if (capabilityDelta !== 0) return capabilityDelta;
		const currentDelta = currentScore(b) - currentScore(a);
		if (currentDelta !== 0) return currentDelta;
		const distance =
			footprintDistance(a, target) - footprintDistance(b, target);
		if (distance !== 0) return distance;
		return compareNames(a, b);
	});
	const items = collapsed
		.slice(0, SIMILAR_CROSS_LIMIT)
		.map((candidate) => item(candidate, target));
	if (items.length === 0) return null;
	return {
		tier: "subtype",
		label: `Other ${subtypeLabel(subtype)}`,
		items,
	};
}

/**
 * Last-resort broad-effect tier: same single effect, other brands, only for
 * categories where the effect itself is the role (octave, pitch, delay,
 * reverb, modulation, compression). Drives/fuzz never reach this tier, and
 * hybrids (2+ effect types) must have circuit/subtype/family evidence.
 */
function categoryGroup(
	target: CatalogPedal,
	pedals: readonly CatalogPedal[],
): SimilarGroup | null {
	if (target.effectTypes.length !== 1) return null;
	const primary = target.effectTypes[0];
	const label = categoryFallbackLabel(primary);
	if (!label) return null;
	const candidates: CatalogPedal[] = [];
	for (const candidate of pedals) {
		if (!eligibleCandidate(target, candidate)) continue;
		if (candidate.effectTypes.length !== 1) continue;
		if (candidate.effectTypes[0] !== primary) continue;
		// The family register covers the target's own brand; this tier is the
		// "other brands" answer.
		if (candidate.brand === target.brand) continue;
		if (isMultiProcessor(candidate)) continue;
		candidates.push(candidate);
	}
	const collapsed = collapseFamilyDuplicates(candidates);
	collapsed.sort((a, b) => {
		const capabilityDelta =
			sharedCapabilityCount(target, b) - sharedCapabilityCount(target, a);
		if (capabilityDelta !== 0) return capabilityDelta;
		const currentDelta = currentScore(b) - currentScore(a);
		if (currentDelta !== 0) return currentDelta;
		const distance =
			footprintDistance(a, target) - footprintDistance(b, target);
		if (distance !== 0) return distance;
		return compareNames(a, b);
	});
	const items = collapsed
		.slice(0, SIMILAR_CROSS_LIMIT)
		.map((candidate) => item(candidate, target));
	if (items.length === 0) return null;
	return { tier: "category", label, items };
}

/**
 * Return the ordered groups for a target (cross-brand sound-alikes first, then
 * the maker's family). Empty when the target is a utility/planner placeholder
 * or there is no evidence in any of the four tiers (circuit → subtype →
 * category → family).
 */
export function similarPedalGroups(
	target: CatalogPedal,
	pedals: readonly CatalogPedal[],
): SimilarGroup[] {
	if (target.category !== "pedal" || target.effectTypes.length === 0) return [];
	if (target.effectTypes.length === 1 && target.effectTypes[0] === "utility")
		return [];
	const targetFamily = familyOf(target);
	const targetFamilyKey = targetFamily?.key ?? null;

	const cross =
		circuitGroup(target, pedals, targetFamilyKey) ??
		subtypeGroup(target, pedals, targetFamilyKey) ??
		categoryGroup(target, pedals);
	const family = familyGroup(target, pedals);
	const groups: SimilarGroup[] = [];
	if (cross) groups.push(cross);
	if (family) groups.push(family);
	return groups;
}

/** The broad browse target for the section footer ("delays", "reverbs", …). */
export function browseAllLabel(target: CatalogPedal): string | null {
	const primary = target.effectTypes[0];
	if (!primary || primary === "utility") return null;
	const noun =
		primary === "octave"
			? "octave pedals"
			: primary === "pitch"
				? "pitch pedals"
				: pluralEffect(primary);
	return `Browse all ${noun}`;
}
