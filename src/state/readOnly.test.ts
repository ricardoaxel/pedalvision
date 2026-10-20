import { beforeEach, describe, expect, it } from "vitest";
import { useReadOnly } from "./readOnly";
import { useScene } from "./scene";

const CUSTOM = {
	brand: "Acme",
	name: "My Fuzz",
	widthCm: 6,
	heightCm: 12,
	category: "pedal" as const,
	effectTypes: ["fuzz" as const],
};

function reset() {
	useScene.setState({ boards: [], items: [], customPedals: [] });
	useReadOnly.setState({ readOnly: false, attempt: null, cue: null });
}

describe("read-only share mode (P3-03)", () => {
	beforeEach(reset);

	it("refuses every scene mutation while read-only", () => {
		const uid = useScene.getState().addBoard("boss-bcb-1000", { x: 0, y: 0 });
		if (!uid) throw new Error("board not added");
		const itemUid = useScene
			.getState()
			.addItem("boss-bd-2-blues-driver", "pedal", uid, { x: 1, y: 2 });
		if (!itemUid) throw new Error("item not added");
		const customRef = useScene.getState().addCustomPedal(CUSTOM);
		if (!customRef) throw new Error("custom not added");
		const before = {
			boards: useScene.getState().boards,
			items: useScene.getState().items,
			customPedals: useScene.getState().customPedals,
		};

		useReadOnly.setState({ readOnly: true });
		expect(
			useScene.getState().addBoard("boss-bcb-1000", { x: 9, y: 9 }),
		).toBeNull();
		expect(
			useScene.getState().addItem("boss-bd-2-blues-driver", "pedal", null, {
				x: 9,
				y: 9,
			}),
		).toBeNull();
		expect(useScene.getState().duplicateItem(itemUid)).toBeNull();
		expect(useScene.getState().addCustomPedal(CUSTOM)).toBeNull();
		expect(
			useScene.getState().addCustomBoard(
				{
					widthCm: 40,
					heightCm: 20,
					texture: "matte",
				},
				{ x: 0, y: 0 },
			),
		).toBeNull();

		useScene.getState().removeItem(itemUid);
		useScene.getState().reorder(itemUid, "front");
		useScene.getState().rotateItem(itemUid, 90);
		useScene.getState().transformItem(itemUid, 5, 5, 90);
		useScene.getState().dropItem(itemUid, { x: 30, y: 30 }, 90);
		useScene.getState().removeBoard(uid);
		useScene.getState().moveBoard(uid, 50, 50);
		useScene.getState().rotateBoard(uid, 45);
		useScene.getState().updateCustomBoard(uid, {
			widthCm: 10,
			heightCm: 10,
			texture: "wood",
		});
		useScene.getState().updateCustomPedal(customRef, {
			...CUSTOM,
			name: "Changed",
		});

		expect(useScene.getState().boards).toEqual(before.boards);
		expect(useScene.getState().items).toEqual(before.items);
		expect(useScene.getState().customPedals).toEqual(before.customPedals);
	});

	it("only turns a mismatched drag attempt into the edit cue", () => {
		const attempt = {
			uid: "i-1",
			kind: "item" as const,
			startClient: { x: 10, y: 10 },
		};
		// Not read-only: an ordinary drag never creates the cue.
		useReadOnly.getState().beginAttempt(attempt);
		expect(useReadOnly.getState().attempt).toBeNull();
		// Read-only: a pointer-down is pending until the drag threshold is met.
		useReadOnly.setState({ readOnly: true });
		useReadOnly.getState().beginAttempt(attempt);
		expect(useReadOnly.getState().attempt).toEqual(attempt);
		useReadOnly.getState().showCue();
		expect(useReadOnly.getState().attempt).toBeNull();
		expect(useReadOnly.getState().cue).toMatchObject({
			uid: "i-1",
			kind: "item",
		});
		// Leaving read-only clears any pending cue.
		useReadOnly.getState().setReadOnly(false);
		expect(useReadOnly.getState().cue).toBeNull();
	});

	it("restores mutation after leaving read-only", () => {
		useReadOnly.setState({ readOnly: true });
		expect(
			useScene.getState().addBoard("boss-bcb-1000", { x: 0, y: 0 }),
		).toBeNull();
		useReadOnly.setState({ readOnly: false });
		expect(
			useScene.getState().addBoard("boss-bcb-1000", { x: 0, y: 0 }),
		).toBeTruthy();
	});
});
