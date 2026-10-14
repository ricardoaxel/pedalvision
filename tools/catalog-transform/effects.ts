/**
 * Effect classification (P0-05 follow-up).
 *
 * The external catalog carries no effect taxonomy — only brand/name/dimensions —
 * so we derive `effectTypes` from the product name with a deterministic keyword
 * heuristic, exactly like the supply heuristic in `convert.ts`. It is
 * intentionally conservative and best-effort: creatively-named pedals (e.g.
 * "Julia", "Morning Glory") stay unclassified rather than guessed wrong. A
 * proper effect taxonomy is a later data task.
 *
 * Deterministic: fixed ordered rules, no randomness/locale.
 */

/** Ordered rules — first matches win per type; a name may match several types. */
export const EFFECT_RULES: { type: string; pattern: RegExp }[] = [
	{ type: "tuner", pattern: /\btuner\b|\btu-?\d/i },
	{ type: "looper", pattern: /\blooper\b|\bloop station\b/i },
	{ type: "octave", pattern: /\boctave\b|\boctaver\b|\boc-?\d/i },
	{ type: "pitch", pattern: /\bpitch\b|\bharmonist\b|\bharmoniz/i },
	{ type: "synth", pattern: /\bsynth(esizer)?\b/i },
	{ type: "fuzz", pattern: /\bfuzz\b|\bfz-?\d|\bmuff\b/i },
	{
		type: "distortion",
		pattern: /\bdistortion\b|\bdist\b|\bmetal\b|\bds-?\d|\bhm-?\d|\bmt-?\d/i,
	},
	{
		type: "overdrive",
		pattern:
			/\boverdrive\b|\bdrive\b|\bdriver\b|\bscreamer\b|\bod-?\d|\bbd-?\d/i,
	},
	{ type: "boost", pattern: /\bboost(er)?\b|\bpreamp\b/i },
	{
		type: "compressor",
		pattern: /\bcompress(or|ion)?\b|\bsustain(er)?\b|\bcs-?\d/i,
	},
	{ type: "eq", pattern: /\bequaliz|\bgraphic eq\b|\beq\b|\bge-?\d/i },
	{ type: "wah", pattern: /\bwah\b|\benvelope\b|\bauto ?-?wah\b/i },
	{ type: "tremolo", pattern: /\btremolo\b|\btrem\b|\btr-?\d/i },
	{ type: "vibrato", pattern: /\bvibrato\b/i },
	{ type: "chorus", pattern: /\bchorus\b|\bch-?\d/i },
	{ type: "flanger", pattern: /\bflanger\b|\bflange\b|\bbf-?\d/i },
	{ type: "phaser", pattern: /\bphaser\b|\bphase shifter\b|\bph-?\d/i },
	{ type: "delay", pattern: /\bdelay\b|\becho\b|\bdd-?\d/i },
	{
		type: "reverb",
		pattern: /\breverb\b|\bhall\b|\bspring\b|\bplate\b|\bshimmer\b|\brv-?\d/i,
	},
	{ type: "gate", pattern: /\bnoise gate\b|\bns-?\d|\bnf-?\d/i },
	{ type: "ring-mod", pattern: /\bring ?mod/i },
	{ type: "bitcrusher", pattern: /\bbit ?crush/i },
];

/** Return the effect types whose keyword appears in `name` (order-stable, unique). */
export function classifyEffects(name: string): string[] {
	const types: string[] = [];
	for (const rule of EFFECT_RULES) {
		if (rule.pattern.test(name) && !types.includes(rule.type)) {
			types.push(rule.type);
		}
	}
	return types;
}
