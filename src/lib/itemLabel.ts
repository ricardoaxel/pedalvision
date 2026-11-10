import { ITEM_LABEL } from "../styles/theme";

/**
 * F-12 "Bench Notation": whether the second (user-label) line fits.
 *
 * The height is measured in the renderer's own label unit — real on-screen px
 * on the canvas (where chip metrics are screen-constant) and printed
 * label-px in PNG/PDF (where `labelUnit` keeps text physically constant). The
 * threshold is the same, so a part large enough for two lines in one renderer
 * is large enough in the other.
 */
export function showItemLabelNote(heightInLabelUnits: number): boolean {
	return heightInLabelUnits >= ITEM_LABEL.twoLineMinScreenHeightPx;
}

export interface ItemChipLines {
	/** Resolved catalog/custom name — always the first line. */
	text: string;
	/** The user label when it fits, else undefined. */
	note: string | undefined;
	twoLine: boolean;
}

/**
 * F-12 chip content shared by the canvas and the PNG/PDF renderer. The caller
 * supplies the height in its own label unit, so both renderers make the same
 * "does the note fit" decision without duplicating the rule.
 */
export function resolveItemChip(
	name: string,
	label: string | undefined,
	heightInLabelUnits: number,
): ItemChipLines {
	const trimmed = label?.trim() || undefined;
	const twoLine = Boolean(trimmed) && showItemLabelNote(heightInLabelUnits);
	return { text: name, note: twoLine ? trimmed : undefined, twoLine };
}
