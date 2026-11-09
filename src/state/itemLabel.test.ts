import { beforeEach, describe, expect, it } from "vitest";
import { useReadOnly } from "./readOnly";
import { ITEM_LABEL_MAX_LENGTH, normalizeItemLabel, useScene } from "./scene";

function required<T>(value: T | null): T {
	if (value === null) throw new Error("expected a value");
	return value;
}

function reset(): void {
	useScene.setState({
		boards: [],
		items: [],
		customPedals: [],
		endpoints: [],
		cables: [],
	});
	useReadOnly.setState({ readOnly: false });
}

beforeEach(reset);

describe("normalizeItemLabel (F-12)", () => {
	it("trims, collapses whitespace and maps empty to undefined", () => {
		expect(normalizeItemLabel("  always   on  ")).toBe("always on");
		expect(normalizeItemLabel("\n dirt\t1 ")).toBe("dirt 1");
		expect(normalizeItemLabel("")).toBeUndefined();
		expect(normalizeItemLabel("   ")).toBeUndefined();
		expect(normalizeItemLabel(null)).toBeUndefined();
		expect(normalizeItemLabel(undefined)).toBeUndefined();
	});

	it("caps at the shared 40-character limit", () => {
		const long = "x".repeat(ITEM_LABEL_MAX_LENGTH + 25);
		expect(normalizeItemLabel(long)).toHaveLength(ITEM_LABEL_MAX_LENGTH);
	});
});

describe("item labels (F-12)", () => {
	it("sets, clears and ignores no-ops for a placed item", () => {
		const refId = required(
			useScene.getState().addCustomPedal({
				brand: "Acme",
				name: "Marked",
				widthCm: 7,
				heightCm: 12,
				category: "pedal",
				effectTypes: [],
			}),
		);
		const itemUid = required(
			useScene.getState().addItem(refId, "pedal", null, { x: 0, y: 0 }),
		);
		expect(useScene.getState().items[0]?.label).toBeUndefined();

		useScene.getState().setItemLabel(itemUid, "always on");
		expect(useScene.getState().items[0]?.label).toBe("always on");

		// Same value is a no-op (same array reference → no history/autosave churn).
		const unchanged = useScene.getState().items;
		useScene.getState().setItemLabel(itemUid, "always on");
		expect(useScene.getState().items).toBe(unchanged);

		// A missing item is a no-op too.
		useScene.getState().setItemLabel("missing", "dirt");
		expect(useScene.getState().items).toBe(unchanged);

		// Whitespace is trimmed and collapsed.
		useScene.getState().setItemLabel(itemUid, "  dirt   1 ");
		expect(useScene.getState().items[0]?.label).toBe("dirt 1");

		// An empty/whitespace value clears the optional field entirely.
		useScene.getState().setItemLabel(itemUid, "   ");
		expect(useScene.getState().items[0]?.label).toBeUndefined();

		useScene.getState().setItemLabel(itemUid, "lead");
		expect(useScene.getState().items[0]?.label).toBe("lead");
		useScene.getState().setItemLabel(itemUid, null);
		expect(useScene.getState().items[0]?.label).toBeUndefined();

		// Read-only previews never mutate.
		useScene.getState().setItemLabel(itemUid, "rhythm");
		useReadOnly.setState({ readOnly: true });
		useScene.getState().setItemLabel(itemUid, "ambient");
		expect(useScene.getState().items[0]?.label).toBe("rhythm");
	});

	it("keeps the label through duplicate and leaves the board name alone", () => {
		const refId = required(
			useScene.getState().addCustomPedal({
				brand: "Acme",
				name: "Marked",
				widthCm: 7,
				heightCm: 12,
				category: "pedal",
				effectTypes: [],
			}),
		);
		const itemUid = required(
			useScene.getState().addItem(refId, "pedal", null, { x: 0, y: 0 }),
		);
		useScene.getState().setItemLabel(itemUid, "always on");
		const copyUid = required(useScene.getState().duplicateItem(itemUid));
		const copy = useScene.getState().items.find((item) => item.uid === copyUid);
		expect(copy?.label).toBe("always on");

		const boardUid = required(
			useScene
				.getState()
				.addCustomBoard(
					{ widthCm: 60, heightCm: 40, texture: "matte" },
					{ x: 0, y: 0 },
				),
		);
		expect(useScene.getState().boards[0]?.uid).toBe(boardUid);
		expect(useScene.getState().boards[0]?.name).toBeUndefined();
	});
});
