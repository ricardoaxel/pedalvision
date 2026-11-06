import { beforeEach, describe, expect, it } from "vitest";
import { useReadOnly } from "./readOnly";
import { useScene } from "./scene";

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

describe("organization colors (F-16)", () => {
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
		expect(useScene.getState().items[0]?.color).toBeUndefined();

		useScene.getState().setItemColor(itemUid, "#b5544d");
		expect(useScene.getState().items[0]?.color).toBe("#b5544d");

		// Same value is a no-op (same array reference → no history/autosave churn).
		const unchanged = useScene.getState().items;
		useScene.getState().setItemColor(itemUid, "#b5544d");
		expect(useScene.getState().items).toBe(unchanged);

		// A missing item is a no-op too.
		useScene.getState().setItemColor("missing", "#568a66");
		expect(useScene.getState().items).toBe(unchanged);

		// Default clears the optional field entirely.
		useScene.getState().setItemColor(itemUid, null);
		expect(useScene.getState().items[0]?.color).toBeUndefined();

		// The mutator trims; the UI normalizes to a 6-digit hex.
		useScene.getState().setItemColor(itemUid, "  #568a66  ");
		expect(useScene.getState().items[0]?.color).toBe("#568a66");

		// Read-only previews never mutate.
		useReadOnly.setState({ readOnly: true });
		useScene.getState().setItemColor(itemUid, "#a96a38");
		expect(useScene.getState().items[0]?.color).toBe("#568a66");
	});

	it("sets, clears and ignores no-ops for a placed board", () => {
		const boardUid = required(
			useScene
				.getState()
				.addCustomBoard(
					{ widthCm: 60, heightCm: 40, texture: "matte" },
					{ x: 0, y: 0 },
				),
		);
		expect(useScene.getState().boards[0]?.color).toBeUndefined();

		useScene.getState().setBoardColor(boardUid, "#587db8");
		expect(useScene.getState().boards[0]?.color).toBe("#587db8");

		const unchanged = useScene.getState().boards;
		useScene.getState().setBoardColor(boardUid, "#587db8");
		expect(useScene.getState().boards).toBe(unchanged);
		useScene.getState().setBoardColor("missing", "#568a66");
		expect(useScene.getState().boards).toBe(unchanged);

		useScene.getState().setBoardColor(boardUid, null);
		expect(useScene.getState().boards[0]?.color).toBeUndefined();

		// The texture is independent of the color and is never touched.
		useScene.getState().setBoardColor(boardUid, "#8a74bd");
		expect(useScene.getState().boards[0]?.texture).toBe("matte");

		useReadOnly.setState({ readOnly: true });
		useScene.getState().setBoardColor(boardUid, "#a96a38");
		expect(useScene.getState().boards[0]?.color).toBe("#8a74bd");
	});

	it("keeps colors through duplicate (the duplicate is a separate marker)", () => {
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
		useScene.getState().setItemColor(itemUid, "#568a66");
		const copyUid = required(useScene.getState().duplicateItem(itemUid));
		const copy = useScene.getState().items.find((item) => item.uid === copyUid);
		expect(copy?.color).toBe("#568a66");
	});
});
