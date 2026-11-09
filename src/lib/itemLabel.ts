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
