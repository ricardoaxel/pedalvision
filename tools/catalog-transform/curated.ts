import type { EffectType } from "../../src/catalog/schema.ts";
import { classifyEffects } from "./effects.ts";
import { baseSlug, toSlug } from "./slug.ts";

/**
 * Verified effect-type overrides (ADR-003 §Effect taxonomy).
 *
 * The external catalog carries no effect taxonomy and the name-keyword
 * classifier is intentionally conservative — creatively-named pedals (e.g.
 * "Julia", "385", "A/B Box") stay unclassified rather than guessed wrong. For
 * those we record a **verified** type set here, keyed by the base-model slug: a
 * colorway variant inherits its base's types.
 *
 * Provenance: manufacturer/vendor-verified facts gathered once; per ADR-003 no
 * source name or URL may appear in code, so the audit trail lives only in
 * `docs/decisions/003-catalog-data.md` (+ `docs/catalog-backfill.md`). Types are
 * OUR vocabulary (`EFFECT_TYPES` in `src/catalog/schema.ts`). A pedal with no
 * verified override falls back to the name-keyword classifier.
 */
export const CURATED_EFFECTS: Record<string, EffectType[]> = {
	// BOSS
	"boss-ac-2-acoustic-simulator": ["acoustic-sim"],
	"boss-ac-3-acoustic-simulator": ["acoustic-sim"],
	"boss-dc-2-dimension-c": ["chorus"],
	"boss-dc-3-digital-dimension": ["chorus"],
	"boss-eh-2-enhancer": ["utility"],
	"boss-es-5-effects-switching-system": ["controller", "utility"],
	"boss-es-8-effects-switching-system": ["controller", "utility"],
	"boss-ev-1-wl-wireless-midi-expression-pedal": ["controller"],
	"boss-ev-30-dual-expression-pedal": ["controller"],
	"boss-ev-5-expression-pedal": ["controller"],
	"boss-fbm-1-59-fender-bassman": ["amp-modeler"],
	"boss-fdr-1-fender-65-deluxe-reverb": ["amp-modeler", "reverb"],
	"boss-fv-100-guitar-volume": ["utility"],
	"boss-fv-30-foot-volume": ["utility"],
	"boss-fv-500-volume-pedal": ["utility"],
	"boss-gigmaster-5": ["mixer", "utility"],
	"boss-gigmaster-8": ["mixer", "utility"],
	"boss-gp-10-guitar-processor": [
		"amp-modeler",
		"cab-sim",
		"synth",
		"pitch",
		"delay",
		"reverb",
	],
	"boss-gp-20-amp-factory": [
		"amp-modeler",
		"cab-sim",
		"overdrive",
		"distortion",
		"delay",
		"reverb",
		"chorus",
	],
	"boss-gt-1-guitar-effects-processor": [
		"amp-modeler",
		"cab-sim",
		"overdrive",
		"distortion",
		"delay",
		"reverb",
		"chorus",
		"flanger",
		"phaser",
		"pitch",
	],
	"boss-gt-1000-guitar-effects-processor": [
		"amp-modeler",
		"cab-sim",
		"overdrive",
		"distortion",
		"delay",
		"reverb",
		"chorus",
		"flanger",
		"phaser",
		"pitch",
		"synth",
	],
	"boss-gt-1000core-guitar-effects-processor": [
		"amp-modeler",
		"cab-sim",
		"overdrive",
		"distortion",
		"delay",
		"reverb",
		"chorus",
		"flanger",
		"phaser",
		"pitch",
		"synth",
	],
	"boss-gt-8-guitar-effects-processor": [
		"amp-modeler",
		"cab-sim",
		"overdrive",
		"distortion",
		"delay",
		"reverb",
		"chorus",
		"flanger",
		"phaser",
		"pitch",
	],
	"boss-gx-1-guitar-effects-processor": [
		"amp-modeler",
		"cab-sim",
		"overdrive",
		"distortion",
		"delay",
		"reverb",
		"chorus",
		"flanger",
		"phaser",
		"pitch",
	],
	"boss-gx-10-guitar-effects-processor": [
		"amp-modeler",
		"cab-sim",
		"overdrive",
		"distortion",
		"delay",
		"reverb",
		"chorus",
		"flanger",
		"phaser",
		"pitch",
	],
	"boss-gx-100-guitar-effects-processor": [
		"amp-modeler",
		"cab-sim",
		"overdrive",
		"distortion",
		"delay",
		"reverb",
		"chorus",
		"flanger",
		"phaser",
		"pitch",
	],
	"boss-gx-1b-bass-effects-processor": [
		"amp-modeler",
		"cab-sim",
		"compressor",
		"overdrive",
		"distortion",
		"delay",
		"reverb",
		"chorus",
		"flanger",
		"phaser",
		"pitch",
	],
	"boss-ir-2-amp-cabinet": ["cab-sim", "amp-modeler"],
	"boss-ir-200-amp-ir-cabinet": ["amp-modeler", "cab-sim"],
	"boss-jb-2-angry-driver": ["overdrive", "distortion"],
	"boss-lm-2-limiter": ["compressor"],
	"boss-lmb-3-bass-limiter-enhancer": ["compressor", "utility"],
	"boss-ls-2-line-selector": ["utility", "ab-box"],
	"boss-md-200-modulation": [
		"chorus",
		"flanger",
		"phaser",
		"vibrato",
		"tremolo",
		"rotary",
		"wah",
		"filter",
	],
	"boss-md-500-modulation": [
		"chorus",
		"flanger",
		"phaser",
		"vibrato",
		"tremolo",
		"rotary",
		"filter",
		"ring-mod",
		"wah",
	],
	"boss-me-90-guitar-multiple-effects": [
		"amp-modeler",
		"cab-sim",
		"overdrive",
		"distortion",
		"compressor",
		"delay",
		"reverb",
		"chorus",
		"flanger",
		"phaser",
		"pitch",
		"wah",
		"tremolo",
	],
	"boss-me-90b-guitar-multiple-effects": [
		"amp-modeler",
		"cab-sim",
		"compressor",
		"overdrive",
		"distortion",
		"filter",
		"synth",
		"delay",
		"reverb",
		"chorus",
		"flanger",
		"phaser",
		"pitch",
		"wah",
	],
	"boss-mo-2-multi-overtone": ["octave", "pitch"],
	"boss-ms-3-multieffects-switcher": [
		"controller",
		"amp-modeler",
		"cab-sim",
		"overdrive",
		"distortion",
		"delay",
		"reverb",
		"chorus",
		"flanger",
		"phaser",
		"pitch",
	],
	"boss-mz-2-digital-metalizer": ["distortion", "delay", "chorus"],
	"boss-oc-20g-poly-octave": ["octave", "distortion"],
	"boss-od-2-turbo-overdrive": ["overdrive", "distortion"],
	"boss-od-20-drive-zone": ["overdrive", "distortion"],
	"boss-od-200-hybrid-drive": ["overdrive", "distortion", "boost", "fuzz"],
	"boss-od-2r-turbo-overdrive": ["overdrive", "distortion"],
	// Mirrors the research-record effectTypes; keep in sync (boss/boss-7).
	"boss-re-2-space-echo": ["delay", "reverb"],
	"boss-re-20-space-echo": ["delay", "reverb"],
	"boss-re-202-space-echo": ["delay", "reverb"],
	"boss-rt-2-rotary-ensemble": ["rotary"],
	"boss-rt-20-rotary": ["rotary"],
	"boss-sg-1-slow-gear": ["envelope"],
	"boss-sl-2-slicer": ["filter"],
	"boss-sl-20-slicer": ["filter"],
	"boss-sp-1-spectrum": ["eq"],
	"boss-st-2-power-stack": ["distortion"],

	// Electro-Harmonix
	"electro-harmonix-15watt-howitzer": ["preamp", "power-amp"],
	"electro-harmonix-22500-foot-controller": ["controller"],
	"electro-harmonix-44-magnum-power-amp": ["power-amp"],
	"electro-harmonix-5mm-power-amp": ["power-amp"],
	"electro-harmonix-8-step-program": ["sequencer", "controller"],
	"electro-harmonix-95000-performance-loop-laboratory": ["looper"],
	"electro-harmonix-analogizer": ["boost"],
	"electro-harmonix-attack-decay": ["envelope", "fuzz"],
	"electro-harmonix-b9-organ-machine": ["organ-sim"],
	"electro-harmonix-bad-stone": ["phaser"],

	// Walrus Audio
	"walrus-audio-385": ["overdrive"],
	"walrus-audio-385-mkii": ["overdrive"],
	"walrus-audio-arp-87": ["delay"],
	"walrus-audio-aetos": [],
	"walrus-audio-ages": ["overdrive"],
	"walrus-audio-badwater": ["preamp", "di", "compressor", "overdrive", "eq"],
	"walrus-audio-bellwether": ["delay", "chorus"],
	"walrus-audio-canvas-clock": ["controller", "utility"],
	"walrus-audio-canvas-line-isolator": ["di", "utility"],

	// Keeley
	"keeley-1962": ["overdrive"],
	"keeley-1962x": ["overdrive"],
	"keeley-30ms-double-tracker": ["delay", "chorus", "reverb"],
	"keeley-abbey-chamber-verb": ["reverb"],
	"keeley-angry-orange": ["distortion", "fuzz"],
	"keeley-aria": ["compressor", "overdrive"],
	"keeley-aurora": ["reverb"],
	"keeley-black-glass": ["fuzz"],
	"keeley-blacktop": ["fuzz"],
	"keeley-blues-disorder": ["overdrive", "distortion"],
	"keeley-bubble-tron": ["flanger", "phaser", "envelope", "filter"],
	"keeley-california-girls": ["octave", "chorus", "delay"],

	// EarthQuaker Devices
	"earthquaker-a-b-box": ["ab-box"],
	"earthquaker-acapulco-gold": ["distortion"],
	"earthquaker-afterneath": ["reverb"],
	"earthquaker-afterneath-v3": ["reverb"],
	"earthquaker-aqueduct": ["vibrato"],
	"earthquaker-arpanoid": ["pitch"],
	"earthquaker-arrows": ["boost", "preamp"],
	"earthquaker-arrows-v2": ["boost", "preamp"],
	"earthquaker-astral-destiny": ["reverb", "octave"],
	"earthquaker-aurelius": ["chorus", "vibrato", "rotary"],
	"earthquaker-avalanche-run": ["delay", "reverb"],
	"earthquaker-avalanche-run-v2": ["delay", "reverb"],

	// JHS
	"jhs-1966-series-bender": ["fuzz"],
	"jhs-1966-series-italy": ["fuzz"],

	// TC Electronic
	"tc-electronic-ampworx-550": ["preamp", "amp-modeler", "cab-sim"],
	"tc-electronic-ampworx-combo-deluxe-65": [
		"preamp",
		"amp-modeler",
		"cab-sim",
		"reverb",
	],
	"tc-electronic-ampworx-dc30": ["preamp", "amp-modeler", "cab-sim"],
	"tc-electronic-ampworx-dual-wreck": ["preamp", "amp-modeler", "cab-sim"],
	"tc-electronic-ampworx-jims-45": ["preamp", "amp-modeler", "cab-sim"],
	"tc-electronic-ampworx-jims-800": ["preamp", "amp-modeler", "cab-sim"],
	"tc-electronic-bodyrez-acoustic-pickup-enhancer": ["eq", "compressor"],
	"tc-electronic-bonafide-buffer": ["buffer"],

	// Mooer (micro preamps — amp-in-a-box)
	"mooer-001-gas-station": ["preamp", "cab-sim"],
	"mooer-002-uk-gold-900": ["preamp", "cab-sim"],
	"mooer-003-power-zone": ["preamp", "cab-sim"],
	"mooer-004-day-tripper": ["preamp", "cab-sim"],
	"mooer-005-brown-sound-3": ["preamp", "cab-sim"],
	"mooer-006-us-classic-deluxe": ["preamp", "cab-sim"],
	"mooer-007-regal-tone": ["preamp", "cab-sim"],
	"mooer-008-cali-mk3": ["preamp", "cab-sim"],
	"mooer-009-black-knight": ["preamp", "cab-sim"],
	"mooer-010-two-stones": ["preamp", "cab-sim"],
	"mooer-011-cali-dual": ["preamp", "cab-sim"],
	"mooer-012-us-gold-100": ["preamp", "cab-sim"],
	"mooer-013-matchbox": ["preamp", "cab-sim"],
	"mooer-014-taxidea-taxus": ["preamp", "cab-sim"],
	"mooer-015-brown-sound": ["preamp", "cab-sim"],
	"mooer-016-phoenix-digital": ["preamp", "cab-sim"],
	"mooer-017-cali-mkiv": ["preamp", "cab-sim"],
	"mooer-018-custom-100": ["preamp", "cab-sim"],

	// MXR
	"mxr-a-b-box": ["ab-box"],
	"mxr-bass-di": ["preamp", "di", "distortion"],
	"mxr-cae-buffer": ["buffer"],
	"mxr-cae-power-system": [],

	// Behringer (personal in-ear-monitor amp — a pedal/utility, NOT a supply)
	"behringer-powerplay-p1": ["utility"],

	// Joyo
	"joyo-d-seed": ["delay"],
	"joyo-jf-06-vintage-phase": ["phaser"],
	"joyo-jf-13-ac-tone": ["amp-modeler", "cab-sim"],
	"joyo-jf-14-american-sound": ["amp-modeler", "cab-sim"],
	"joyo-jf-15-california-sound": ["amp-modeler", "cab-sim"],
	"joyo-jf-16-british-sound": ["amp-modeler", "cab-sim"],

	// Meris (P5-03 batch — verified from official product pages/manuals)
	"meris-enzo": [
		"synth",
		"pitch",
		"filter",
		"ring-mod",
		"delay",
		"chorus",
		"compressor",
	],
	"meris-enzo-x": [
		"synth",
		"pitch",
		"filter",
		"ring-mod",
		"delay",
		"reverb",
		"chorus",
		"flanger",
		"phaser",
		"vibrato",
		"bitcrusher",
		"overdrive",
		"compressor",
		"sequencer",
		"tuner",
	],
	"meris-hedra": ["pitch", "delay"],
	"meris-lvx": [
		"delay",
		"looper",
		"pitch",
		"filter",
		"preamp",
		"bitcrusher",
		"tuner",
	],
	"meris-midi-i-o": ["utility"],
	"meris-mercury7": ["reverb"],
	"meris-mercuryx": ["reverb", "chorus", "vibrato", "tremolo", "tuner"],
	"meris-ottobit-jr": ["bitcrusher", "filter", "sequencer", "pitch"],
	"meris-ottobit-x": [
		"bitcrusher",
		"filter",
		"pitch",
		"ring-mod",
		"tremolo",
		"delay",
		"reverb",
		"looper",
		"sequencer",
		"preamp",
		"vibrato",
		"tuner",
	],
	"meris-polymoon": ["delay", "phaser", "flanger"],

	// Red Panda (P5-03 wave 1 — verified from official product pages/manuals)
	"red-panda-bitmap": ["bitcrusher", "distortion"],
	"red-panda-bitmap-2": ["bitcrusher", "distortion", "filter"],
	"red-panda-buffer": ["buffer", "utility"],
	"red-panda-context": ["reverb", "delay"],
	"red-panda-context-2": ["reverb", "delay", "tremolo"],
	"red-panda-mixer": ["mixer", "utility"],
	"red-panda-particle": ["delay", "pitch"],
	"red-panda-particle-v2": ["delay", "pitch"],
	"red-panda-rd-1-pitch-delay": ["delay", "pitch"],
	"red-panda-radius": ["ring-mod", "tremolo"],
	"red-panda-raster": ["delay", "pitch"],
	"red-panda-raster-2": ["delay", "pitch"],
	"red-panda-remote-4": ["controller", "utility"],
	"red-panda-tensor": ["pitch", "looper"],
};

/**
 * Devices verified to be power supplies by name alone won't match the generic
 * hint (e.g. "Aetos"), so record their base slugs here. Colorway variants
 * inherit their base.
 */
export const CURATED_SUPPLIES = new Set<string>(["walrus-audio-aetos"]);

/** Names that denote a power supply rather than an effect pedal. */
const SUPPLY_HINT =
	/\bpower\s*(supply|box|bank|system)\b|\bpsu\b|isolated power/i;

type DeviceInput = { brand: string; name: string; variantOf?: string };

/**
 * Inventory-id aliases for models whose official name slugifies differently from
 * the inventory id (the BOSS inventory lists the Gigcaster 5/8 as "Gigmaster").
 * The canonical id stays the inventory id; this only lets the verified override
 * resolve by the official name.
 */
const CURATED_ID_ALIASES: Record<string, string> = {
	"boss-gigcaster-5": "boss-gigmaster-5",
	"boss-gigcaster-8": "boss-gigmaster-8",
	// Inventory id says "guitar", but the official model name is Bass.
	"boss-me-90b-bass-multiple-effects": "boss-me-90b-guitar-multiple-effects",
	"boss-ms-3-multi-effects-switcher": "boss-ms-3-multieffects-switcher",
};

const primaryKey = (input: DeviceInput): string =>
	CURATED_ID_ALIASES[input.variantOf ?? baseSlug(input.brand, input.name)] ??
	input.variantOf ??
	baseSlug(input.brand, input.name);

/** The pre-P5-01 slug (a trailing "+" collapsed into the previous word). */
function legacyKey(input: DeviceInput): string {
	if (input.variantOf) return input.variantOf.replace(/-plus$/, "");
	const baseName = input.name.replace(/\s*\([^)]+\)\s*$/, "").trim();
	return toSlug(`${input.brand} ${baseName}`).replace(/-plus$/, "");
}

/**
 * Curated keys were authored before "+" became a meaningful slug token. Prefer
 * the current key; fall back to the legacy key only for a "+" model that has no
 * current key. New research uses the current (plus-preserving) slug.
 */
const baseKey = (input: DeviceInput): string => {
	const primary = primaryKey(input);
	if (CURATED_EFFECTS[primary] || CURATED_SUPPLIES.has(primary)) return primary;
	if (!input.name.includes("+")) return primary;
	const legacy = legacyKey(input);
	if (CURATED_EFFECTS[legacy] || CURATED_SUPPLIES.has(legacy)) return legacy;
	return primary;
};

/**
 * Resolve a pedal's effect types: a verified override for its base model wins,
 * otherwise fall back to the name-keyword classifier.
 */
export function deriveEffectTypes(input: DeviceInput): EffectType[] {
	const curated = CURATED_EFFECTS[baseKey(input)];
	if (curated) return curated;
	// Classify the BASE model name: a colorway/edition suffix like "(Metal)" must
	// not give a variant different effect types than its base.
	const baseName = input.name.replace(/\s*\([^)]+\)\s*$/, "").trim();
	return classifyEffects(baseName || input.name);
}

/** Resolve a device's category (`pedal` vs `supply`) by verified override or name. */
export function deriveCategory(input: DeviceInput): "pedal" | "supply" {
	if (CURATED_SUPPLIES.has(baseKey(input))) return "supply";
	return SUPPLY_HINT.test(input.name) ? "supply" : "pedal";
}
