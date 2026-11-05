import { CABLE_INK, type CableInkId } from "../styles/theme";

/**
 * The fixed cable palette (Q-05 "Patch Ink"). One table read by the action-bar
 * UI and its tests; the canvas uses the stored hex directly. The values are
 * theme-invariant because `Cable.color` is persisted as a hex string and the
 * PDF always prints on white paper — see `theme.ts` / `tokens.css`.
 */
export interface CableInkOption {
	id: CableInkId;
	label: string;
	/** The stored `Cable.color` value. */
	value: string;
}

export const CABLE_INK_OPTIONS: readonly CableInkOption[] = [
	{
		id: "red",
		label: "Red",
		value: CABLE_INK.red,
	},
	{
		id: "orange",
		label: "Orange",
		value: CABLE_INK.orange,
	},
	{
		id: "green",
		label: "Green",
		value: CABLE_INK.green,
	},
	{
		id: "blue",
		label: "Blue",
		value: CABLE_INK.blue,
	},
	{
		id: "violet",
		label: "Violet",
		value: CABLE_INK.violet,
	},
	{
		id: "magenta",
		label: "Magenta",
		value: CABLE_INK.magenta,
	},
] as const;

/** Match a stored cable color against the fixed palette (case-insensitive). */
export function cableInkOption(
	color: string | null | undefined,
): CableInkOption | undefined {
	if (!color) return undefined;
	const normalized = color.trim().toLowerCase();
	return CABLE_INK_OPTIONS.find(
		(option) => option.value.toLowerCase() === normalized,
	);
}
