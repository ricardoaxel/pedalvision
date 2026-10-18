import type {
	EffectType,
	Jack,
	JackEdge,
	JackKind,
	Power,
} from "../catalog/schema";
import type { CustomPedal, CustomPedalDefinition } from "../state/scene";
import { cmToDisplay, type DisplayUnits, displayToCm } from "./geometry";

/**
 * Custom-pedal creator logic (F7/P2-02) — pure, so units handling and draft
 * validation are unit-tested independently of the DOM. The draft holds the raw
 * form strings; canonical cm is one step away (`parseDimensionToCm`). Storage is
 * always cm: switching units re-derives the displayed number from the cm parsed
 * out of the *current* input, so a displayed value can't silently compound a
 * conversion. Note the displayed values are rounded to 2 decimals (`cmToDisplay`)
 * — a conversion is exact only when the value has an exact 2-dp representation
 * in both units (e.g. 2.5 in ⇄ 6.35 cm); inexact values are stored at display
 * precision, which is sub-millimetre.
 */

/** Largest accepted footprint edge (cm) — a sanity bound, not a product limit. */
export const MAX_DIMENSION_CM = 100;

/** One jack row as edited in the form (numeric `pos`, not a string). */
export interface JackDraft {
	id: string;
	kind: JackKind;
	edge: JackEdge;
	/** Position along the edge, 0..1. */
	pos: number;
}

/** The creator form's raw state (dimensions are display-unit strings). */
export interface CustomPedalDraft {
	category: "pedal" | "supply";
	brand: string;
	name: string;
	width: string;
	depth: string;
	/**
	 * Canonical cm parsed from `width`/`depth` on the last edit (null when the
	 * string is empty/invalid). Submitting uses these, so switching units (whose
	 * display is only 2-decimal) never silently changes the stored size.
	 */
	widthCm: number | null;
	depthCm: number | null;
	units: DisplayUnits;
	effectTypes: EffectType[];
	jacks: JackDraft[];
	powerEnabled: boolean;
	voltage: string;
	acDc: "DC" | "AC";
	currentMa: string;
}

/** Field-keyed validation messages (empty when valid). */
export interface CustomPedalErrors {
	name?: string;
	width?: string;
	depth?: string;
	voltage?: string;
	currentMa?: string;
}

export type CustomPedalValidation =
	| { ok: true; value: CustomPedalDefinition; errors: CustomPedalErrors }
	| { ok: false; errors: CustomPedalErrors };

function clamp01(value: number): number {
	return Math.min(1, Math.max(0, value));
}

/** Parse a display-unit dimension string to canonical cm, or null if invalid. */
export function parseDimensionToCm(
	input: string,
	units: DisplayUnits,
): number | null {
	const normalized = input.trim().replace(",", ".");
	if (normalized === "") return null;
	const value = Number(normalized);
	if (!Number.isFinite(value) || value <= 0) return null;
	return displayToCm(value, units);
}

/** Format canonical cm in the active display unit (2-decimal, trimmed). */
export function formatDimension(cm: number, units: DisplayUnits): string {
	return String(cmToDisplay(cm, units));
}

/** A fresh draft (units seeded from the caller; dimensions empty). */
export function emptyCustomPedalDraft(
	units: DisplayUnits = "cm",
): CustomPedalDraft {
	return {
		category: "pedal",
		brand: "",
		name: "",
		width: "",
		depth: "",
		widthCm: null,
		depthCm: null,
		units,
		effectTypes: [],
		jacks: [],
		powerEnabled: false,
		voltage: "9",
		acDc: "DC",
		currentMa: "100",
	};
}

/**
 * Seed a draft from an existing custom part (P2-02 edit), so the creator modal
 * reopens pre-filled. Jacks get fresh row ids; the definition itself keeps its
 * `refId` (assigned by the store). The canonical cm is seeded exactly, so an
 * untouched "Save changes" is bit-identical even if the display rounds.
 */
export function draftFromCustomPedal(
	custom: CustomPedal,
	units: DisplayUnits = "cm",
): CustomPedalDraft {
	return {
		category: custom.category,
		brand: custom.brand,
		name: custom.name,
		width: formatDimension(custom.widthCm, units),
		depth: formatDimension(custom.heightCm, units),
		widthCm: custom.widthCm,
		depthCm: custom.heightCm,
		units,
		effectTypes: [...custom.effectTypes],
		jacks: (custom.jacks ?? []).map((jack) => ({
			id: crypto.randomUUID(),
			kind: jack.kind,
			edge: jack.edge,
			pos: jack.pos,
		})),
		powerEnabled: custom.power !== undefined,
		voltage: custom.power ? String(custom.power.voltage) : "9",
		acDc: custom.power?.acDc ?? "DC",
		currentMa: custom.power ? String(custom.power.currentMa) : "100",
	};
}

/**
 * Switch the draft's display unit. The display is re-derived from the canonical
 * cm (`widthCm`/`depthCm`) when present — so switching units never changes the
 * stored size — and falls back to parsing the current string for a draft built
 * without canonical values. An invalid dimension is kept verbatim.
 */
export function changeDraftUnits(
	draft: CustomPedalDraft,
	units: DisplayUnits,
): CustomPedalDraft {
	if (draft.units === units) return draft;
	const convert = (
		canonical: number | null,
		raw: string,
		from: DisplayUnits,
	): string => {
		const cm = canonical ?? parseDimensionToCm(raw, from);
		return cm === null ? raw : formatDimension(cm, units);
	};
	return {
		...draft,
		units,
		width: convert(draft.widthCm, draft.width, draft.units),
		depth: convert(draft.depthCm, draft.depth, draft.units),
	};
}

/**
 * Validate a draft and, when valid, produce the placeable definition. A supply
 * always requires power (it is its primary spec); a pedal's power is optional.
 * Dimensions prefer the canonical cm (exact) and fall back to parsing the
 * display string.
 */
export function validateCustomPedalDraft(
	draft: CustomPedalDraft,
): CustomPedalValidation {
	const errors: CustomPedalErrors = {};

	const name = draft.name.trim();
	if (name === "") errors.name = "Name is required.";

	const widthCm = draft.widthCm ?? parseDimensionToCm(draft.width, draft.units);
	if (widthCm === null) errors.width = "Enter a positive width.";
	else if (widthCm > MAX_DIMENSION_CM)
		errors.width = `Keep it under ${MAX_DIMENSION_CM} cm.`;

	const heightCm =
		draft.depthCm ?? parseDimensionToCm(draft.depth, draft.units);
	if (heightCm === null) errors.depth = "Enter a positive depth.";
	else if (heightCm > MAX_DIMENSION_CM)
		errors.depth = `Keep it under ${MAX_DIMENSION_CM} cm.`;

	let power: Power | undefined;
	if (draft.powerEnabled || draft.category === "supply") {
		const voltage = Number(draft.voltage.trim().replace(",", "."));
		const currentMa = Number(draft.currentMa.trim().replace(",", "."));
		const voltageOk = Number.isFinite(voltage) && voltage > 0;
		const currentOk = Number.isFinite(currentMa) && currentMa >= 0;
		if (!voltageOk) errors.voltage = "Enter a positive voltage.";
		if (!currentOk) errors.currentMa = "Enter a current ≥ 0.";
		if (voltageOk && currentOk)
			power = { voltage, acDc: draft.acDc, currentMa };
	}

	if (Object.keys(errors).length > 0) return { ok: false, errors };
	// widthCm/heightCm are non-null once their errors are absent.
	if (widthCm === null || heightCm === null) return { ok: false, errors };

	const jacks: Jack[] = draft.jacks.map((jack) => ({
		kind: jack.kind,
		edge: jack.edge,
		pos: clamp01(jack.pos),
	}));

	return {
		ok: true,
		errors,
		value: {
			brand: draft.brand.trim(),
			name,
			widthCm,
			heightCm,
			category: draft.category,
			effectTypes: draft.effectTypes,
			jacks: jacks.length > 0 ? jacks : undefined,
			power,
		},
	};
}

/** Human label for a jack kind ("exp-in" → "Exp In", "midi" → "MIDI"). */
const JACK_KIND_LABELS: Record<JackKind, string> = {
	in: "In",
	out: "Out",
	exp: "Exp",
	"exp-in": "Exp In",
	"exp-out": "Exp Out",
	send: "Send",
	return: "Return",
	midi: "MIDI",
	ctrl: "Ctrl",
	power: "Power",
};

/** Human label for a jack kind in the select + the drawing legend. */
export function jackKindLabel(kind: JackKind): string {
	return JACK_KIND_LABELS[kind];
}

/** Short label for a jack edge (the T/R/B/L control). */
export const JACK_EDGE_LABELS: Record<JackEdge, string> = {
	top: "T",
	right: "R",
	bottom: "B",
	left: "L",
};
