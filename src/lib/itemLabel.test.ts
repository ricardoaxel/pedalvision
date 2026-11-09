import { describe, expect, it } from "vitest";
import { ITEM_LABEL } from "../styles/theme";
import { showItemLabelNote } from "./itemLabel";

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
