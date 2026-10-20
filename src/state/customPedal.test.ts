import { beforeEach, describe, expect, it } from "vitest";
import {
	itemFootprint,
	itemWorldCorners,
	type PlacedItem,
	resolveItem,
	rotateItemAboutCenter,
	useScene,
} from "./scene";

function required<T>(value: T | null): T {
	if (value === null) throw new Error("expected a value");
	return value;
}

const CUSTOM = {
	brand: "Acme",
	name: "My Deluxe Fuzz",
	widthCm: 6.4,
	heightCm: 12.1,
	category: "pedal" as const,
	effectTypes: ["fuzz" as const],
	jacks: [{ kind: "in" as const, edge: "top" as const, pos: 0.5 }],
	power: { voltage: 9, acDc: "DC" as const, currentMa: 40 },
};

function placedItem(
	refId: string,
	overrides: Partial<PlacedItem> = {},
): PlacedItem {
	return {
		uid: "i1",
		refId,
		kind: "pedal",
		boardUid: null,
		x: 0,
		y: 0,
		rotationDeg: 0,
		z: 0,
		...overrides,
	};
}

describe("custom pedals (P2-02)", () => {
	beforeEach(() => {
		useScene.setState({ boards: [], items: [], customPedals: [] });
	});

	it("registers a custom pedal with a scene-local refId", () => {
		const refId = useScene.getState().addCustomPedal(CUSTOM);
		expect(refId.startsWith("custom-")).toBe(true);
		const stored = useScene.getState().customPedals;
		expect(stored).toHaveLength(1);
		expect(stored[0]).toEqual({ ...CUSTOM, refId });
	});

	it("places and resolves a custom pedal by name + cm footprint", () => {
		const refId = useScene.getState().addCustomPedal(CUSTOM);
		const uid = required(
			useScene.getState().addItem(refId, "pedal", null, {
				x: 2,
				y: 3,
			}),
		);
		const item = useScene.getState().items.find((i) => i.uid === uid);
		if (!item) throw new Error("item not placed");
		const resolved = resolveItem(item, useScene.getState().customPedals);
		expect(resolved.custom?.refId).toBe(refId);
		expect(resolved.definition).toBeNull();
		expect(resolved.name).toBe("My Deluxe Fuzz");
		expect(itemFootprint(item, useScene.getState().customPedals)).toEqual({
			widthCm: 6.4,
			heightCm: 12.1,
		});
	});

	it("falls back to the label + default footprint when the ref is unknown", () => {
		const item = placedItem("custom-missing");
		const resolved = resolveItem(item, []);
		expect(resolved.name).toBe("custom-missing");
		expect(resolved.custom).toBeNull();
	});

	it("rotates about the custom footprint's centre", () => {
		const custom = { ...CUSTOM, refId: "custom-ref" };
		const item = placedItem("custom-ref");
		const next = rotateItemAboutCenter(item, 90, [custom]);
		const rotated = { ...item, ...next };
		const centroid = (corners: { x: number; y: number }[]) => ({
			x: corners.reduce((sum, p) => sum + p.x, 0) / corners.length,
			y: corners.reduce((sum, p) => sum + p.y, 0) / corners.length,
		});
		const before = centroid(itemWorldCorners(item, [], [custom]));
		const after = centroid(itemWorldCorners(rotated, [], [custom]));
		expect(after.x).toBeCloseTo(before.x, 12);
		expect(after.y).toBeCloseTo(before.y, 12);
		expect(next.rotationDeg).toBe(90);
	});

	it("builds world corners from the custom footprint", () => {
		const item = placedItem("custom-ref", { x: 1, y: 1 });
		const corners = itemWorldCorners(
			item,
			[],
			[{ ...CUSTOM, refId: "custom-ref" }],
		);
		expect(corners).toContainEqual({ x: 1, y: 1 });
		expect(corners).toContainEqual({ x: 1 + 6.4, y: 1 + 12.1 });
	});

	it("prunes a custom pedal once its last placed item is removed", () => {
		const refId = useScene.getState().addCustomPedal(CUSTOM);
		const uid = required(
			useScene.getState().addItem(refId, "pedal", null, {
				x: 0,
				y: 0,
			}),
		);
		expect(useScene.getState().customPedals).toHaveLength(1);
		useScene.getState().removeItem(uid);
		expect(useScene.getState().customPedals).toHaveLength(0);
	});

	it("keeps a custom pedal while a duplicate still references it", () => {
		const refId = useScene.getState().addCustomPedal(CUSTOM);
		const uid = required(
			useScene.getState().addItem(refId, "pedal", null, {
				x: 0,
				y: 0,
			}),
		);
		const clone = required(useScene.getState().duplicateItem(uid));
		useScene.getState().removeItem(uid);
		expect(clone).not.toBeNull();
		expect(useScene.getState().customPedals).toHaveLength(1);
	});

	it("edits a custom pedal in place (keeps refId, updates the footprint)", () => {
		const refId = useScene.getState().addCustomPedal(CUSTOM);
		const uid = required(
			useScene.getState().addItem(refId, "pedal", null, {
				x: 2,
				y: 3,
			}),
		);
		const before = useScene.getState().items.find((i) => i.uid === uid);
		if (!before) throw new Error("item missing");
		useScene
			.getState()
			.updateCustomPedal(refId, { ...CUSTOM, name: "Renamed", widthCm: 10 });
		const stored = useScene.getState().customPedals;
		expect(stored).toHaveLength(1);
		expect(stored[0].refId).toBe(refId);
		expect(stored[0].name).toBe("Renamed");
		const item = useScene.getState().items.find((i) => i.uid === uid);
		if (!item) throw new Error("item missing");
		expect(itemFootprint(item, stored)).toEqual({
			widthCm: 10,
			heightCm: 12.1,
		});
		// Editing the definition never moves placed items.
		expect({ uid: item.uid, x: item.x, y: item.y, z: item.z }).toEqual({
			uid: before.uid,
			x: before.x,
			y: before.y,
			z: before.z,
		});
	});
});
