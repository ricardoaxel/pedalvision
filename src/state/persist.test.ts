import { beforeEach, describe, expect, it } from "vitest";
import { catalog } from "../catalog/load";
import {
	hydrateScene,
	parseSceneSnapshot,
	SCENE_STORAGE_KEY,
	serializeScene,
	startScenePersistence,
} from "./persist";
import { useScene } from "./scene";

const boss = catalog.boards.find((board) => board.id === "boss-bcb-1000");
if (!boss) throw new Error("test fixture board missing from the seed");

/** An in-memory `Storage` stand-in (no DOM needed). */
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
		{
			uid: "i2",
			refId: "boss-bd-2-blues-driver",
			kind: "pedal" as const,
			boardUid: "b1",
			x: 5,
			y: 6,
			rotationDeg: 0,
			z: 1,
		},
	],
};

describe("scene serialization", () => {
	it("round-trips the persisted fields (including z)", () => {
		const parsed = parseSceneSnapshot(serializeScene(snapshot));
		expect(parsed).toEqual({ version: 1, ...snapshot });
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
			version: 1,
			boards: [snapshot.boards[0]],
			items: [snapshot.items[0]],
		});
	});
});

describe("scene persistence", () => {
	beforeEach(() => {
		useScene.setState({ boards: [], items: [] });
	});

	it("hydrates the store from storage", () => {
		const storage = fakeStorage({
			[SCENE_STORAGE_KEY]: serializeScene(snapshot),
		});
		hydrateScene(storage);
		expect(useScene.getState().boards).toEqual(snapshot.boards);
		expect(useScene.getState().items).toEqual(snapshot.items);
	});

	it("writes on change and stops after unsubscribe", () => {
		const storage = fakeStorage();
		const stop = startScenePersistence(storage);
		useScene.getState().addBoard(boss.id, { x: 0, y: 0 });
		const saved = parseSceneSnapshot(storage.getItem(SCENE_STORAGE_KEY));
		expect(saved?.boards).toHaveLength(1);

		stop();
		useScene.getState().addBoard(boss.id, { x: 0, y: 0 });
		const after = parseSceneSnapshot(storage.getItem(SCENE_STORAGE_KEY));
		expect(after?.boards).toHaveLength(1);
	});
});
