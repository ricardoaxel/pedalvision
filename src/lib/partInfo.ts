import type { EffectType, Jack, JackEdge, Power } from "../catalog/schema";
import type { ResolvedItem } from "../state/scene";
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
			jacks: definition.jacks ?? [],
			power: definition.power ?? null,
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
			jacks: custom.jacks ?? [],
			power: custom.power ?? null,
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
		jacks: [],
		power: null,
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

/** "In · Top · 0.30" — kind, edge, position along the edge. */
export function formatJack(jack: Jack): string {
	return `${jackKindLabel(jack.kind)} · ${JACK_EDGE_NAMES[jack.edge]} · ${jack.pos.toFixed(2)}`;
}
