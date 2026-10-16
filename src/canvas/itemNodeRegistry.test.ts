import type Konva from "konva";
import { describe, expect, it, vi } from "vitest";
import {
	getItemNode,
	registerItemNode,
	subscribeItemNodes,
	unregisterItemNode,
} from "./itemNodeRegistry";

const node = (name: string) => ({ name }) as unknown as Konva.Group;

describe("itemNodeRegistry", () => {
	it("registers and clears a node", () => {
		const uid = "reg-basic";
		const a = node("a");
		registerItemNode(uid, a);
		expect(getItemNode(uid)).toBe(a);
		unregisterItemNode(uid, a);
		expect(getItemNode(uid)).toBeNull();
	});

	it("keeps the newer node when a stale cleanup runs (remount race)", () => {
		const uid = "reg-race";
		const oldNode = node("old");
		const newNode = node("new");
		registerItemNode(uid, oldNode);
		// A cross-board drop mounts the new node under the same uid…
		registerItemNode(uid, newNode);
		// …then the old node's cleanup fires: it must NOT clear the new node.
		unregisterItemNode(uid, oldNode);
		expect(getItemNode(uid)).toBe(newNode);
		unregisterItemNode(uid, newNode);
		expect(getItemNode(uid)).toBeNull();
	});

	it("notifies subscribers and stops after unsubscribe", () => {
		const uid = "reg-sub";
		const listener = vi.fn();
		const unsubscribe = subscribeItemNodes(listener);

		const a = node("a");
		registerItemNode(uid, a);
		expect(listener).toHaveBeenCalledTimes(1);
		unregisterItemNode(uid, a);
		expect(listener).toHaveBeenCalledTimes(2);

		unsubscribe();
		const b = node("b");
		registerItemNode(uid, b);
		expect(listener).toHaveBeenCalledTimes(2);
		unregisterItemNode(uid, b);
	});
});
