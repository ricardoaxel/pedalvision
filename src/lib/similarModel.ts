import type { CatalogPedal, EffectType } from "../catalog/schema";

/**
 * F-14 "Sound-alike" knowledge for the Similar section.
 *
 * The old rule (share any effect type) was too coarse: every delay matched every
 * other delay. This model is **family-first and evidence-tiered**:
 *
 *   1. a maker's own lineage (DD-3 → DD-3T/DD-5/DD-6/DD-7/DD-8),
 *   2. a shared circuit/algorithm family across brands (Tube Screamer, Big Muff,
 *      BBD analog delay, tape echo, …),
 *   3. the same delay/reverb subtype when no circuit evidence exists
 *      (digital delay, analog delay, hall/plate/spring reverb, …).
 *
 * A broad "it is also an overdrive" match is deliberately **not** a tier.
 *
 * Everything here is a small, reviewed, feature-lane map. It never edits catalog
 * data and never infers from images. Facts come from the runtime notes or the
 * cited official/reputable sources; an unknown model is left unknown rather than
 * guessed. A unit test asserts every mapped id exists in the curated catalog.
 */

export type SimilarCapability =
	| "Stereo"
	| "Tap tempo"
	| "Multi-mode"
	| "MIDI"
	| "Compact";

export interface FamilyInfo {
	key: string;
	order: number;
	shortLabel: string;
}

interface FamilyRule {
	brand: string;
	/** Matched against the model name (without the brand). */
	pattern: RegExp;
	key: string;
	order: (name: string) => number;
	short: (name: string) => string;
	/** Finish-only variants that must never appear in the family. */
	skip?: RegExp;
}

const codeShort = (name: string): string => name.split(" ")[0] ?? name;
const byCode =
	(map: Record<string, number>) =>
	(name: string): number =>
		map[name.split(" ")[0] ?? ""] ?? 99;

/** Finish/colourway markers — never a sound-alike, never a family member. */
const FINISH_ONLY =
	/\((?:Black|White|Raw|Pastel[^)]*|Nat\. Parks|Kamakura|Nautical|Obsidian|Platinum|Mint|Purple[^)]*|Signalis|Ler)\)|Anniversary/i;

export const FAMILY_RULES: FamilyRule[] = [
	{
		brand: "BOSS",
		pattern: /^DD-(2|3|3T|5|6|7|8)\b/,
		key: "boss-dd-compact",
		order: byCode({
			"DD-2": 1,
			"DD-3": 2,
			"DD-3T": 3,
			"DD-5": 4,
			"DD-6": 5,
			"DD-7": 6,
			"DD-8": 7,
		}),
		short: codeShort,
	},
	{
		brand: "BOSS",
		pattern: /^DD-(20|200|500)\b/,
		key: "boss-dd-large",
		order: byCode({ "DD-20": 1, "DD-200": 2, "DD-500": 3 }),
		short: codeShort,
	},
	{
		brand: "BOSS",
		pattern: /^DM-(2|2W|3)\b/,
		key: "boss-dm-compact",
		order: byCode({ "DM-2": 1, "DM-2W": 2, "DM-3": 3 }),
		short: codeShort,
	},
	{
		brand: "BOSS",
		pattern: /^RV-(2|3|5|6)\b/,
		key: "boss-rv-compact",
		order: byCode({ "RV-2": 1, "RV-3": 2, "RV-5": 3, "RV-6": 4 }),
		short: codeShort,
	},
	{
		brand: "BOSS",
		pattern: /^RV-(200|500)\b/,
		key: "boss-rv-large",
		order: byCode({ "RV-200": 1, "RV-500": 2 }),
		short: codeShort,
	},
	{
		brand: "BOSS",
		pattern: /^RE-(2|20|202)\b/,
		key: "boss-re",
		order: byCode({ "RE-2": 1, "RE-20": 2, "RE-202": 3 }),
		short: codeShort,
	},
	{
		brand: "BOSS",
		pattern: /^SDE-(3|3000D|3000EVH)\b/,
		key: "boss-sde",
		order: byCode({ "SDE-3": 1, "SDE-3000D": 2, "SDE-3000EVH": 3 }),
		short: codeShort,
	},
	{
		brand: "BOSS",
		pattern: /^CE-(1|2|2W|3|5)\b/,
		key: "boss-ce",
		order: byCode({ "CE-1": 1, "CE-2": 2, "CE-2W": 3, "CE-3": 4, "CE-5": 5 }),
		short: codeShort,
	},
	{
		brand: "BOSS",
		pattern: /^BF-(2|3)\b/,
		key: "boss-bf",
		order: byCode({ "BF-2": 1, "BF-3": 2 }),
		short: codeShort,
	},
	{
		brand: "BOSS",
		pattern: /^PH-(1|2|3)\b/,
		key: "boss-ph",
		order: byCode({ "PH-1": 1, "PH-2": 2, "PH-3": 3 }),
		short: codeShort,
	},
	{
		brand: "BOSS",
		pattern: /^(TR-2|PN-2)\b/,
		key: "boss-trem",
		order: byCode({ "TR-2": 1, "PN-2": 2 }),
		short: codeShort,
	},
	{
		brand: "BOSS",
		pattern: /^SD-1(W|-4A)?\b/,
		key: "boss-sd1",
		order: byCode({ "SD-1": 1, "SD-1W": 2, "SD-1-4A": 3 }),
		short: codeShort,
	},
	{
		brand: "BOSS",
		pattern: /^DS-1(-4A|-WH|-W|-X)?\b/,
		key: "boss-ds1",
		order: byCode({
			"DS-1": 1,
			"DS-1-4A": 2,
			"DS-1-WH": 3,
			"DS-1W": 4,
			"DS-1X": 5,
		}),
		short: codeShort,
	},
	{
		brand: "BOSS",
		pattern: /^BD-2W?\b/,
		key: "boss-bd2",
		order: byCode({ "BD-2": 1, "BD-2W": 2 }),
		short: codeShort,
	},
	{
		brand: "BOSS",
		pattern: /^OD-(1X?|2|3)\b/,
		key: "boss-od",
		order: byCode({ "OD-1": 1, "OD-1X": 2, "OD-2": 3, "OD-3": 4 }),
		short: codeShort,
	},
	{
		brand: "BOSS",
		pattern: /^FZ-(1W|2|3|5)\b/,
		key: "boss-fz",
		order: byCode({ "FZ-1W": 1, "FZ-2": 2, "FZ-3": 3, "FZ-5": 4 }),
		short: codeShort,
	},
	{
		brand: "BOSS",
		pattern: /^MT-2(-3A|W)?\b/,
		key: "boss-mt2",
		order: byCode({ "MT-2": 1, "MT-2-3A": 2, "MT-2W": 3 }),
		short: codeShort,
	},
	{
		brand: "BOSS",
		pattern: /^(VB-2W?|DC-2W?)\b/,
		key: "boss-vb-dc",
		order: byCode({ "VB-2": 1, "VB-2W": 2, "DC-2": 3, "DC-2W": 4 }),
		short: codeShort,
	},
	{
		brand: "MXR",
		pattern: /^Carbon Copy\b/,
		key: "mxr-carbon-copy",
		order: (name) =>
			name.includes("Deluxe")
				? 4
				: name.includes("Mini")
					? 2
					: name.includes("Bright")
						? 3
						: 1,
		short: (name) => name.replace(/^Carbon Copy\s*/, "") || "Original",
		skip: /10th Anniversary/i,
	},
	{
		brand: "Meris",
		pattern: /^Mercury(7|X)\b/,
		key: "meris-mercury",
		order: (name) => (name.includes("MercuryX") ? 2 : 1),
		short: (name) => name,
	},
	{
		brand: "Red Panda",
		pattern: /^Context\b/,
		key: "red-panda-context",
		order: (name) => (name.includes("2") ? 2 : 1),
		short: (name) => name,
	},
	{
		brand: "Red Panda",
		pattern: /^Raster\b/,
		key: "red-panda-raster",
		order: (name) => (name.includes("2") ? 2 : 1),
		short: (name) => name,
	},
	{
		brand: "Red Panda",
		pattern: /^Particle\b/,
		key: "red-panda-particle",
		order: (name) => (name.includes("V2") ? 2 : 1),
		short: (name) => name,
	},
	{
		brand: "EarthQuaker",
		pattern: /^Afterneath\b/,
		key: "eqd-afterneath",
		order: (name) => (name.includes("V3") ? 2 : 1),
		short: (name) => name,
	},
	{
		brand: "EarthQuaker",
		pattern: /^Avalanche Run\b/,
		key: "eqd-avalanche-run",
		order: (name) => (name.includes("V2") ? 2 : 1),
		short: (name) => name,
	},
	{
		brand: "Keeley",
		pattern: /^1962x?\b/,
		key: "keeley-1962",
		order: (name) => (name.includes("1962x") ? 2 : 1),
		short: (name) => name,
	},
	{
		brand: "Electro-Harmonix",
		pattern: /^Bass Big Muff\b/,
		key: "ehx-bass-big-muff",
		order: (name) => (name.includes("2") ? 2 : 1),
		short: (name) => name,
	},
	{
		brand: "TC Electronic",
		pattern: /^Alter Ego\b/,
		key: "tc-alter-ego",
		order: (name) => (name.includes("x4") ? 2 : 1),
		short: (name) => (name.includes("x4") ? "X4" : "v2"),
	},
];

export interface CircuitInfo {
	key: string;
	label: string;
	strength: "core" | "adjacent";
}

interface CircuitDef {
	key: string;
	label: string;
	core: string[];
	adjacent?: string[];
}

/**
 * Curated circuit/algorithm families. Only models with a recorded or
 * well-documented relationship are listed; a clone is never guessed.
 * Sources: BOSS/Ibanez/JHS/EHX/MXR official pages + the pedal-domain research
 * in the F-14 task notes.
 */
export const CIRCUITS: CircuitDef[] = [
	{
		key: "tube-screamer",
		label: "Screamer-style overdrive",
		core: ["jhs-808", "jhs-3-series-screamer"],
		adjacent: [
			"boss-sd-1-super-overdrive",
			"boss-sd-1w-super-overdrive-waza-craft",
			"boss-sd-1-4a-anniversary-super-overdrive",
		],
	},
	{
		key: "bluesbreaker",
		label: "Bluesbreaker-style",
		core: ["keeley-1962", "keeley-1962x", "keeley-blues-disorder"],
	},
	{
		key: "bbd-delay",
		label: "BBD analog delay",
		core: [
			"mxr-carbon-copy",
			"mxr-carbon-copy-mini",
			"mxr-carbon-copy-bright",
			"mxr-carbon-copy-deluxe",
			"boss-dm-2-delay",
			"boss-dm-2w-delay-waza-craft",
			"boss-dm-3-delay",
			"tc-electronic-bucket-brigade-analog-delay",
			"mooer-ana-echo",
			"walrus-audio-bellwether",
		],
	},
	{
		key: "bbd-chorus",
		label: "BBD chorus",
		core: [
			"boss-ce-1-chorus-ensemble",
			"boss-ce-2-chorus",
			"boss-ce-2w-chorus-waza-craft",
			"behringer-cc300-chorus-space-c",
			"tc-electronic-3rd-dimension-chorus",
			"tc-electronic-afterglow-chorus",
		],
	},
];

/** Explicit delay/reverb subtype for models whose notes are empty or ambiguous. */
export const SUBTYPE_OVERRIDES: Record<string, string> = {
	"mxr-carbon-copy": "analog",
	"mxr-carbon-copy-mini": "analog",
	"mxr-carbon-copy-bright": "analog",
	"mxr-carbon-copy-deluxe": "analog",
	"boss-dm-2-delay": "analog",
	"boss-dm-2w-delay-waza-craft": "analog",
	"boss-dm-3-delay": "analog",
	"walrus-audio-arp-87": "digital",
	"boss-dd-2-digital-delay": "digital",
	"boss-dd-3-digital-delay": "digital",
	"boss-dd-3t-digital-delay": "digital",
	"boss-dd-5-digital-delay": "digital",
	"boss-dd-6-digital-delay": "digital",
	"boss-dd-7-digital-delay": "digital",
	"boss-dd-8-digital-delay": "digital",
	"boss-dd-200-digital-delay": "digital",
	"boss-dd-500-digital-delay": "digital",
	"boss-sde-3-dual-digital-delay": "digital",
	"boss-sde-3000d-dual-digital-delay": "digital",
	"boss-sde-3000evh-dual-digital-delay": "digital",
	"tc-electronic-2290-p-dynamic-digital-delay": "digital",
	"tc-electronic-alter-ego-v2-vintage-echo": "digital",
	"tc-electronic-alter-ego-x4-vintage-echo": "digital",
	"behringer-dd600-digital-delay": "digital",
	"joyo-jf-08-digital-delay": "digital",
	"joyo-d-seed": "digital",
	"meris-mercury7": "multi",
	"meris-mercuryx": "multi",
	"red-panda-context": "multi",
	"red-panda-context-2": "multi",
	"earthquaker-afterneath": "ambient",
	"earthquaker-afterneath-v3": "ambient",
	"jhs-3-series-hall-reverb": "hall",
};

const SUBTYPE_LABELS: Record<string, string> = {
	digital: "digital delays",
	analog: "analog delays",
	tape: "tape delays",
	spring: "spring reverbs",
	plate: "plate reverbs",
	hall: "hall reverbs",
	room: "room reverbs",
	chamber: "chamber reverbs",
	ambient: "ambient reverbs",
	multi: "multi-mode reverbs",
};

const CAPABILITY_PRIORITY: SimilarCapability[] = [
	"Tap tempo",
	"Stereo",
	"Multi-mode",
	"MIDI",
	"Compact",
];

const BASS_NAME = /\bBass\b/;
const MULTI_PROCESSOR_TYPES = new Set([
	"amp-modeler",
	"cab-sim",
	"synth",
	"controller",
	"sequencer",
]);

/** Every catalog id referenced by a curated circuit or subtype map. */
export function mappedCatalogIds(): string[] {
	const ids = new Set<string>();
	for (const def of CIRCUITS) {
		for (const id of def.core) ids.add(id);
		for (const id of def.adjacent ?? []) ids.add(id);
	}
	for (const id of Object.keys(SUBTYPE_OVERRIDES)) ids.add(id);
	return [...ids];
}

export function familyOf(pedal: CatalogPedal): FamilyInfo | null {
	for (const rule of FAMILY_RULES) {
		if (rule.brand !== pedal.brand || !rule.pattern.test(pedal.name)) continue;
		if (rule.skip?.test(pedal.name)) return null;
		return {
			key: rule.key,
			order: rule.order(pedal.name),
			shortLabel: rule.short(pedal.name),
		};
	}
	return null;
}

export function circuitOf(pedal: CatalogPedal): CircuitInfo | null {
	for (const def of CIRCUITS) {
		if (def.core.includes(pedal.id))
			return { key: def.key, label: def.label, strength: "core" };
		if (def.adjacent?.includes(pedal.id))
			return { key: def.key, label: def.label, strength: "adjacent" };
	}
	return null;
}

export function circuitById(key: string): CircuitDef | undefined {
	return CIRCUITS.find((def) => def.key === key);
}

/** Finish-only variants must never be suggested (they are the same pedal). */
export function isFinishOnly(pedal: CatalogPedal): boolean {
	return FINISH_ONLY.test(pedal.name);
}

export function isBassModel(pedal: CatalogPedal): boolean {
	return pedal.usage === "bass" || BASS_NAME.test(pedal.name);
}

export function isMultiProcessor(pedal: CatalogPedal): boolean {
	return (
		pedal.effectTypes.length >= 4 ||
		pedal.effectTypes.some((type) => MULTI_PROCESSOR_TYPES.has(type))
	);
}

/** Delay/reverb subtype from curated tags, then scoped notes keywords. */
export function subtypeOf(pedal: CatalogPedal): string | null {
	const primary = pedal.effectTypes[0];
	if (primary !== "delay" && primary !== "reverb") return null;
	const override = SUBTYPE_OVERRIDES[pedal.id];
	if (override) return override;

	const notes = (pedal.notes ?? "").toLowerCase();
	if (primary === "reverb") {
		if (/algorithms?|modes?|multi/.test(notes)) return "multi";
		if (/shimmer|ambient/.test(notes)) return "ambient";
		if (/spring/.test(notes)) return "spring";
		if (/plate/.test(notes)) return "plate";
		if (/hall/.test(notes)) return "hall";
		if (/chamber/.test(notes)) return "chamber";
		if (/room/.test(notes)) return "room";
		return null;
	}
	if (/tape|space echo/.test(notes)) return "tape";
	if (/bucket brigade|bbd|analog/.test(notes)) return "analog";
	if (/digital|24-bit|dsp|algorithms?|modes?/.test(notes)) return "digital";
	return null;
}

export function subtypeLabel(subtype: string): string {
	return SUBTYPE_LABELS[subtype] ?? "similar pedals";
}

export function capabilitiesOf(pedal: CatalogPedal): Set<SimilarCapability> {
	const found = new Set<SimilarCapability>();
	const notes = (pedal.notes ?? "").toLowerCase();
	if (pedal.stereo === true) found.add("Stereo");
	if (/tap tempo/.test(notes)) found.add("Tap tempo");
	if (/algorithms?|modes?|multi/.test(notes)) found.add("Multi-mode");
	if (/midi/.test(notes)) found.add("MIDI");
	if (pedal.widthCm <= 9.5 && pedal.heightCm <= 13.5) found.add("Compact");
	return found;
}

/** The most useful shared capability, or null when none is shared. */
export function sharedCapability(
	target: CatalogPedal,
	candidate: CatalogPedal,
): SimilarCapability | null {
	const a = capabilitiesOf(target);
	const b = capabilitiesOf(candidate);
	return CAPABILITY_PRIORITY.find((cap) => a.has(cap) && b.has(cap)) ?? null;
}

/**
 * Effects that share the delay tag but are really pitch/granular tools. They are
 * valid catalogue entries, just bad "sounds like this" suggestions for a plain
 * digital delay, so they sort after the core delays.
 */
const DEPRIORITIZED_DELAYS = new Set([
	"red-panda-particle",
	"red-panda-particle-v2",
	"red-panda-raster",
	"red-panda-raster-2",
	"red-panda-rd-1-pitch-delay",
	"meris-polymoon",
]);

export function delayRoleRank(pedal: CatalogPedal): number {
	return DEPRIORITIZED_DELAYS.has(pedal.id) ? 2 : 0;
}

/** A display label for a primary effect ("delay" → "delays"). */
export function pluralEffect(type: EffectType): string {
	const label = type === "eq" ? "EQ" : type;
	const lower = label.toLowerCase();
	if (lower === "fuzz") return "fuzzes";
	if (lower === "chorus") return "choruses";
	if (lower === "eq") return "EQs";
	return `${lower}s`;
}
