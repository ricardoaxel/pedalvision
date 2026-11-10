import { describe, expect, it } from "vitest";
import { ITEM_LABEL } from "../styles/theme";
import { resolveItemChip, showItemLabelNote } from "./itemLabel";

describe("showItemLabelNote (F-12)", () => {
	it("requires the two-line threshold in the renderer's label unit", () => {
		expect(showItemLabelNote(ITEM_LABEL.twoLineMinScreenHeightPx - 0.01)).toBe(
			false,
		);
		expect(showItemLabelNote(ITEM_LABEL.twoLineMinScreenHeightPx)).toBe(true);
		expect(showItemLabelNote(ITEM_LABEL.twoLineMinScreenHeightPx + 50)).toBe(
			true,
		);
	});

	it("matches the shipped threshold", () => {
		expect(ITEM_LABEL.twoLineMinScreenHeightPx).toBe(58);
	});
});

describe("resolveItemChip (F-12)", () => {
	it("adds the note only when a label exists and the part is tall enough", () => {
		expect(resolveItemChip("Note Unit", "always on", 120)).toEqual({
			text: "Note Unit",
			note: "always on",
			twoLine: true,
		});
		expect(resolveItemChip("Note Unit", "always on", 40)).toEqual({
			text: "Note Unit",
			note: undefined,
			twoLine: false,
		});
		expect(resolveItemChip("Note Unit", undefined, 120)).toEqual({
			text: "Note Unit",
			note: undefined,
			twoLine: false,
		});
		expect(resolveItemChip("Note Unit", "   ", 120)).toEqual({
			text: "Note Unit",
			note: undefined,
			twoLine: false,
		});
	});
});
