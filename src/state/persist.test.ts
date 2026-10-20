import { describe, expect, it } from "vitest";
import { catalog } from "../catalog/load";
import {
	parseSceneSnapshot,
	readLegacyScene,
	SCENE_STORAGE_KEY,
	serializeScene,
} from "./persist";

const boss = catalog.boards.find((board) => board.id === "boss-bcb-1000");
if (!boss) throw new Error("test fixture board missing from the seed");

function fakeStorage(initial: Record<string, string> = {}): Storage {
	const map = new Map(Object.entries(initial));
	return {
		get length() {
			return map.size;
		},
		clear: () => map.clear(),
		getItem: (key) => map.get(key) ?? null,
		key: (index) => [...map.keys()][index] ?? null,
		removeItem: (key) => {
			map.delete(key);
		},
		setItem: (key, value) => {
			map.set(key, value);
		},
	};
}

const snapshot = {
	boards: [{ uid: "b1", boardRefId: boss.id, x: 1, y: 2, rotationDeg: 0 }],
	items: [
		{
			uid: "i1",
			refId: "boss-bd-2-blues-driver",
			kind: "pedal" as const,
			boardUid: "b1",
			x: 3,
			y: 4,
			rotationDeg: 45,
			z: 0,
		},
	],
	customPedals: [],
};

describe("legacy single-scene mirror", () => {
	it("round-trips the P1-06 snapshot fields (including z)", () => {
		expect(parseSceneSnapshot(serializeScene(snapshot))).toEqual(snapshot);
	});

	it("returns null for empty / corrupt / unknown-version payloads", () => {
		expect(parseSceneSnapshot(null)).toBeNull();
		expect(parseSceneSnapshot("")).toBeNull();
		expect(parseSceneSnapshot("{ not json")).toBeNull();
		expect(parseSceneSnapshot(JSON.stringify({ version: 2 }))).toBeNull();
		expect(
			parseSceneSnapshot(JSON.stringify({ version: 1, boards: {} })),
		).toBeNull();
	});

	it("drops malformed entries instead of failing the whole load", () => {
		const raw = JSON.stringify({
			version: 1,
			boards: [snapshot.boards[0], { uid: 5 }],
			items: [snapshot.items[0], { refId: "x" }],
		});
		expect(parseSceneSnapshot(raw)).toEqual({
			boards: [snapshot.boards[0]],
			items: [snapshot.items[0]],
			customPedals: [],
		});
	});

	it("reads the legacy key and survives a blocked store", () => {
		const storage = fakeStorage({
			[SCENE_STORAGE_KEY]: serializeScene(snapshot),
		});
		expect(readLegacyScene(storage)).toEqual(snapshot);
		const blocked = fakeStorage();
		blocked.getItem = () => {
			throw new Error("SecurityError: storage blocked");
		};
		expect(readLegacyScene(blocked)).toBeNull();
		expect(readLegacyScene(null)).toBeNull();
	});
});
