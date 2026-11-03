import type {
	EffectType,
	ImageSource,
	Jack,
	JackEdge,
	JackKind,
	Power,
} from "../catalog/schema";
import type { ResolvedItem, ResolvedJack } from "../state/scene";
import { jackKindLabel } from "./customPedal";
import { cmToDisplay, type DisplayUnits } from "./geometry";

/**
 * The info panel's view model + formatters (P2-03). Pure, so the panel's
 * displayed values (units, power, jacks, graceful omission) are unit-tested
 * without a DOM. cm stays canonical; only `formatDimensions` touches a display
 * unit.
 */
export interface PartInfo {
	brand: string;
	name: string;
	category: "pedal" | "supply";
	/** Our effect taxonomy — the panel's "tags". */
	effectTypes: EffectType[];
	widthCm: number;
	heightCm: number;
	jacks: Jack[];
	power: Power | null;
	/**
	 * The catalog image (mock/static/url), or null for custom + unknown parts
	 * (which are text-only and render a drawing instead). Resolve it with
	 * `resolveImageUrl(image.source, image.value, "pedal", ASSET_RENDITIONS.specimen)`.
	 */
	image: { source: ImageSource; value: string } | null;
	/** True when the item is a user-defined part (adds the `CUSTOM` tag). */
	isCustom: boolean;
	/** True when `refId` resolved to neither a catalog item nor a custom part. */
	unknown: boolean;
}

/**
 * Flatten a resolved item (catalog / inline custom / unknown fallback) into the
 * panel's view model. `kind` is the placed item's category, used only for the
 * unknown-ref fallback (catalog + custom define their own).
 */
export function buildPartInfo(
	resolved: ResolvedItem,
	kind: "pedal" | "supply",
	/** The item's effective jacks (real, fallback or locally corrected). */
	jacks?: ResolvedJack[],
): PartInfo {
	if (resolved.definition) {
		const { definition } = resolved;
		return {
			brand: definition.brand,
			name: definition.name,
			category: definition.category,
			effectTypes: definition.effectTypes,
			widthCm: definition.widthCm,
			heightCm: definition.heightCm,
			jacks: jacks ?? definition.jacks ?? [],
			power: definition.power ?? null,
			image: { source: definition.imageSource, value: definition.image },
			isCustom: false,
			unknown: false,
		};
	}
	if (resolved.custom) {
		const { custom } = resolved;
		return {
			brand: custom.brand,
			name: custom.name,
			category: custom.category,
			effectTypes: custom.effectTypes,
			widthCm: custom.widthCm,
			heightCm: custom.heightCm,
			jacks: jacks ?? custom.jacks ?? [],
			power: custom.power ?? null,
			image: null,
			isCustom: true,
			unknown: false,
		};
	}
	return {
		brand: "",
		name: resolved.name,
		category: kind,
		effectTypes: [],
		widthCm: resolved.widthCm,
		heightCm: resolved.heightCm,
		jacks: jacks ?? [],
		power: null,
		image: null,
		isCustom: false,
		unknown: true,
	};
}

/** "7.3 × 13.02 cm" (or inches) — display only, storage stays cm. */
export function formatDimensions(
	widthCm: number,
	heightCm: number,
	units: DisplayUnits,
): string {
	return `${cmToDisplay(widthCm, units)} × ${cmToDisplay(heightCm, units)} ${units}`;
}

/** Kind label with a stable ordinal when the item has duplicate kinds. */
export function jackKindLabelAt(
	jacks: readonly { kind: JackKind }[],
	index: number,
): string {
	const kind = jacks[index]?.kind;
	if (!kind) return "";
	const same = jacks
		.map((jack, jackIndex) => (jack.kind === kind ? jackIndex : -1))
		.filter((jackIndex) => jackIndex >= 0);
	return same.length > 1
		? `${jackKindLabel(kind)} ${same.indexOf(index) + 1}`
		: jackKindLabel(kind);
}

/** "9 V · DC · 100 mA". */
export function formatPower(power: Power): string {
	return `${power.voltage} V · ${power.acDc} · ${power.currentMa} mA`;
}

/** Full edge names for the (read-only) jack rows — the editor uses T/R/B/L. */
export const JACK_EDGE_NAMES: Record<JackEdge, string> = {
	top: "Top",
	right: "Right",
	bottom: "Bottom",
	left: "Left",
};

/** Provenance marker for a jack row (F-33 “Proof Marks”). */
export type JackProvenance = "assumed" | "approximate" | "corrected" | null;

/** Which provenance marker a jack row should show (catalog data = null). */
export function jackProvenance(jack: ResolvedJack): JackProvenance {
	if (jack.corrected === true) return "corrected";
	if (jack.assumed === true) return "assumed";
	if (jack.approximate === true) return "approximate";
	return null;
}

/** "2.9 × 4.1 cm" — free x/y position on the pedal face (F-33). */
export function formatJackPosition(
	jack: ResolvedJack,
	widthCm: number,
	heightCm: number,
	units: DisplayUnits,
): string {
	if (jack.xNorm === undefined || jack.yNorm === undefined) return "";
	return `x ${cmToDisplay(jack.xNorm * widthCm, units)} · y ${cmToDisplay(jack.yNorm * heightCm, units)} ${units}`;
}

/** "I · Top · 0.30" — short kind, edge, position along the edge. */
export function formatJack(jack: Jack): string {
	const kind =
		jack.kind === "in"
			? "I"
			: jack.kind === "out"
				? "O"
				: jackKindLabel(jack.kind);
	const stereo = jack.stereo === true ? " · TRS" : "";
	const position =
		jack.pos === undefined
			? "auto"
			: `${jack.approximate === true ? "~" : ""}${jack.pos.toFixed(2)}`;
	return `${kind} · ${JACK_EDGE_NAMES[jack.edge]} · ${position}${stereo}`;
}
