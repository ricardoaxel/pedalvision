import { beforeEach, describe, expect, it } from "vitest";
import { buildAnchorIndex } from "../lib/jackAnchor";
import { clearHistory, flushHistory, undo, useHistory } from "./history";
import { useReadOnly } from "./readOnly";
import {
	baseItemJacks,
	resolveItemJacks,
	useScene,
	usesFallbackJacks,
} from "./scene";

function required<T>(value: T | null): T {
	if (value === null) throw new Error("expected a value");
	return value;
}

const CHOKA = "tc-electronic-choka-tremolo";
const BARE = "boss-ac-2-acoustic-simulator";

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

function addItem(refId = CHOKA, x = 0): string {
	return required(
		useScene.getState().addItem(refId, "pedal", null, { x, y: 0 }),
	);
}

describe("local jack/IO corrections (F-33)", () => {
	it("moves one jack without changing the base or another placed copy", () => {
		const first = addItem(CHOKA, 0);
		const second = addItem(CHOKA, 20);
		const result = useScene
			.getState()
			.setJackOverride(first, 1, { edge: "bottom", pos: 0.25 });
		expect(result.ok).toBe(true);

		const items = useScene.getState().items;
		const firstItem = items.find((item) => item.uid === first);
		const secondItem = items.find((item) => item.uid === second);
		if (!firstItem || !secondItem) throw new Error("missing item");

		expect(firstItem.jackOverrides).toEqual([
			{ jack: 1, edge: "bottom", pos: 0.25 },
		]);
		expect(secondItem.jackOverrides).toBeUndefined();
		expect(baseItemJacks(firstItem)[1]).toMatchObject({
			kind: "out",
			edge: "top",
			pos: 0.2,
		});
		expect(resolveItemJacks(firstItem)[1]).toMatchObject({
			kind: "out",
			edge: "bottom",
			pos: 0.25,
			corrected: true,
		});
		expect(resolveItemJacks(secondItem)[1]).toMatchObject({
			kind: "out",
			edge: "top",
			pos: 0.2,
		});
	});

	it("corrects one fallback jack while the other stays assumed", () => {
		const uid = addItem(BARE);
		const item = useScene.getState().items.find((entry) => entry.uid === uid);
		if (!item) throw new Error("missing item");
		expect(usesFallbackJacks(item)).toBe(true);
		expect(resolveItemJacks(item)[0]?.assumed).toBe(true);

		const result = useScene
			.getState()
			.setJackOverride(uid, 0, { edge: "top", pos: 0.3 });
		expect(result.ok).toBe(true);
		const corrected = useScene
			.getState()
			.items.find((entry) => entry.uid === uid);
		if (!corrected) throw new Error("missing corrected item");
		expect(resolveItemJacks(corrected)[0]).toMatchObject({
			edge: "top",
			pos: 0.3,
			corrected: true,
			assumed: false,
		});
		expect(resolveItemJacks(corrected)[1]?.assumed).toBe(true);
		expect(usesFallbackJacks(corrected)).toBe(true);
	});

	it("refuses a kind change that would invalidate an attached cable", () => {
		const a = addItem(CHOKA, 0);
		const b = addItem(CHOKA, 20);
		const cableUid = required(
			useScene
				.getState()
				.addCable({ itemUid: a, jack: "1" }, { itemUid: b, jack: "0" }),
		);
		const before = useScene.getState().items;

		const result = useScene.getState().setJackOverride(a, 1, { kind: "in" });
		expect(result.ok).toBe(false);
		expect(result.reason).toContain("invalid");
		expect(useScene.getState().items).toBe(before);
		expect(useScene.getState().cables[0]?.uid).toBe(cableUid);
	});

	it("allows a move and re-anchors the same cable", () => {
		const a = addItem(CHOKA, 0);
		const b = addItem(CHOKA, 20);
		required(
			useScene
				.getState()
				.addCable({ itemUid: a, jack: "1" }, { itemUid: b, jack: "0" }),
		);
		const beforeItem = useScene.getState().items.find((item) => item.uid === a);
		const oldAnchor = beforeItem
			? resolveItemJacks(beforeItem)[1]?.pos
			: undefined;
		const result = useScene
			.getState()
			.setJackOverride(a, 1, { edge: "right", pos: 0.75 });
		expect(result.ok).toBe(true);
		const item = useScene.getState().items.find((entry) => entry.uid === a);
		if (!item) throw new Error("missing item");
		expect(resolveItemJacks(item)[1]).toMatchObject({
			edge: "right",
			pos: 0.75,
		});
		expect(useScene.getState().cables).toHaveLength(1);
		expect(oldAnchor).not.toBe(0.75);
	});

	it("refuses TRS → mono while two cables use the socket", () => {
		const a = addItem(CHOKA, 0);
		const b = addItem(CHOKA, 20);
		const c = addItem(CHOKA, 40);
		expect(useScene.getState().setJackOverride(a, 1, { stereo: true }).ok).toBe(
			true,
		);
		required(
			useScene
				.getState()
				.addCable({ itemUid: a, jack: "1" }, { itemUid: b, jack: "0" }),
		);
		required(
			useScene
				.getState()
				.addCable({ itemUid: a, jack: "1" }, { itemUid: c, jack: "0" }),
		);
		const result = useScene.getState().setJackOverride(a, 1, { stereo: false });
		expect(result.ok).toBe(false);
		expect(result.reason).toContain("mono");
		expect(useScene.getState().cables).toHaveLength(2);
	});

	it("resets one jack and all jacks as guarded actions", () => {
		const uid = addItem(CHOKA);
		useScene.getState().setJackOverride(uid, 0, { pos: 0.2 });
		useScene.getState().setJackOverride(uid, 1, { edge: "bottom" });
		let item = useScene.getState().items.find((entry) => entry.uid === uid);
		if (!item) throw new Error("missing item");
		expect(item.jackOverrides).toHaveLength(2);

		expect(useScene.getState().resetJackOverride(uid, 0).ok).toBe(true);
		item = useScene.getState().items.find((entry) => entry.uid === uid);
		expect(item?.jackOverrides).toEqual([{ jack: 1, edge: "bottom" }]);

		expect(useScene.getState().resetAllJackOverrides(uid).ok).toBe(true);
		item = useScene.getState().items.find((entry) => entry.uid === uid);
		expect(item?.jackOverrides).toBeUndefined();
	});

	it("copies overrides on duplicate and ignores custom pedals", () => {
		const uid = addItem(CHOKA);
		useScene.getState().setJackOverride(uid, 1, { edge: "bottom" });
		const cloneUid = required(useScene.getState().duplicateItem(uid));
		const clone = useScene
			.getState()
			.items.find((item) => item.uid === cloneUid);
		expect(clone?.jackOverrides).toEqual([{ jack: 1, edge: "bottom" }]);

		const customRef = required(
			useScene.getState().addCustomPedal({
				brand: "Acme",
				name: "Custom",
				widthCm: 7,
				heightCm: 12,
				category: "pedal",
				effectTypes: [],
				jacks: [{ kind: "in", edge: "top", pos: 0.5 }],
			}),
		);
		const customUid = required(
			useScene.getState().addItem(customRef, "pedal", null, { x: 50, y: 0 }),
		);
		const result = useScene
			.getState()
			.setJackOverride(customUid, 0, { edge: "bottom" });
		expect(result.ok).toBe(false);
		expect(result.reason).toContain("Custom");
	});

	it("marks only the corrected fallback jack as non-assumed in the anchor index", () => {
		const uid = addItem(BARE);
		useScene.getState().setJackOverride(uid, 0, { edge: "top", pos: 0.3 });
		const state = useScene.getState();
		const index = buildAnchorIndex(state);
		expect(index.items.get(`item:${uid}:0`)).toMatchObject({
			assumed: false,
			corrected: true,
		});
		expect(index.items.get(`item:${uid}:1`)).toMatchObject({
			assumed: true,
		});
	});

	it("is not blocked by an unrelated malformed cable", () => {
		const a = addItem(CHOKA, 0);
		const b = addItem(CHOKA, 20);
		const c = addItem(CHOKA, 40);
		// A hand-edited source↔source cable between OTHER items must not make a
		// correction on `a` fail (the guard is scoped to the edited item).
		useScene.setState({
			cables: [
				{
					uid: "bad",
					from: { itemUid: b, jack: "1" },
					to: { itemUid: c, jack: "1" },
				},
			],
		});
		const result = useScene.getState().setJackOverride(a, 1, { pos: 0.3 });
		expect(result.ok).toBe(true);
	});

	it("records one undo step per correction and reset", () => {
		const uid = addItem(CHOKA);
		clearHistory();
		useScene.getState().setJackOverride(uid, 1, { edge: "bottom" });
		flushHistory();
		expect(useHistory.getState().past).toHaveLength(1);
		undo();
		expect(
			useScene.getState().items.find((item) => item.uid === uid)?.jackOverrides,
		).toBeUndefined();

		useScene.getState().setJackOverride(uid, 1, { edge: "bottom" });
		flushHistory();
		useScene.getState().resetJackOverride(uid, 1);
		flushHistory();
		expect(useHistory.getState().past).toHaveLength(2);
	});

	it("is a no-op in a read-only share", () => {
		const uid = addItem(CHOKA);
		useReadOnly.getState().setReadOnly(true);
		const result = useScene.getState().setJackOverride(uid, 0, { pos: 0.2 });
		expect(result.ok).toBe(false);
		expect(
			useScene.getState().items.find((item) => item.uid === uid)?.jackOverrides,
		).toBeUndefined();
	});
});
