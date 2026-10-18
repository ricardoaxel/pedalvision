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
	customPedals: [],
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
			customPedals: [],
		});
	});

	it("round-trips inline custom pedals (P2-02)", () => {
		const withCustom = {
			...snapshot,
			customPedals: [
				{
					refId: "custom-abc",
					brand: "Acme",
					name: "My Fuzz",
					widthCm: 6,
					heightCm: 12,
					category: "pedal" as const,
					effectTypes: ["fuzz" as const],
					jacks: [{ kind: "in" as const, edge: "top" as const, pos: 0.5 }],
					power: { voltage: 9, acDc: "DC" as const, currentMa: 20 },
				},
			],
		};
		const parsed = parseSceneSnapshot(serializeScene(withCustom));
		expect(parsed?.customPedals).toEqual(withCustom.customPedals);
	});

	it("drops a malformed inline custom pedal", () => {
		const raw = JSON.stringify({
			version: 1,
			boards: [],
			items: [],
			customPedals: [
				{
					refId: "custom-ok",
					brand: "",
					name: "Ok",
					widthCm: 6,
					heightCm: 12,
					category: "pedal",
					effectTypes: [],
				},
				{ refId: "custom-bad", widthCm: -1 },
			],
		});
		expect(parseSceneSnapshot(raw)?.customPedals).toHaveLength(1);
	});

	it("rejects a custom pedal with an unknown jack kind or edge", () => {
		const base = {
			refId: "custom-x",
			brand: "",
			name: "X",
			widthCm: 6,
			heightCm: 12,
			category: "pedal",
			effectTypes: ["fuzz"],
		};
		for (const jack of [
			{ kind: "banana", edge: "top", pos: 0.5 },
			{ kind: "in", edge: "middle", pos: 0.5 },
			{ kind: "in", edge: "top", pos: 2 },
		]) {
			const raw = JSON.stringify({
				version: 1,
				boards: [],
				items: [],
				customPedals: [{ ...base, jacks: [jack] }],
			});
			expect(parseSceneSnapshot(raw)?.customPedals).toHaveLength(0);
		}
	});
});

describe("scene persistence", () => {
	beforeEach(() => {
		useScene.setState({ boards: [], items: [], customPedals: [] });
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

	it("drops items whose board is missing and re-normalises z (no ghost items)", () => {
		const raw = JSON.stringify({
			version: 1,
			boards: [snapshot.boards[0]],
			items: [
				{ ...snapshot.items[0], uid: "ok", boardUid: "b1", z: 5 },
				{ ...snapshot.items[1], uid: "orphan", boardUid: "gone" },
			],
		});
		hydrateScene(fakeStorage({ [SCENE_STORAGE_KEY]: raw }));
		const items = useScene.getState().items;
		expect(items.map((item) => item.uid)).toEqual(["ok"]);
		expect(items[0].z).toBe(0);
	});

	it("prunes a custom pedal left orphaned by a dropped item on hydrate", () => {
		const raw = JSON.stringify({
			version: 1,
			boards: [],
			items: [
				{
					uid: "i",
					refId: "custom-x",
					kind: "pedal",
					boardUid: "gone",
					x: 0,
					y: 0,
					rotationDeg: 0,
					z: 0,
				},
			],
			customPedals: [
				{
					refId: "custom-x",
					brand: "",
					name: "X",
					widthCm: 6,
					heightCm: 12,
					category: "pedal",
					effectTypes: [],
				},
			],
		});
		hydrateScene(fakeStorage({ [SCENE_STORAGE_KEY]: raw }));
		expect(useScene.getState().items).toHaveLength(0);
		expect(useScene.getState().customPedals).toHaveLength(0);
	});

	it("never throws at boot when storage is unavailable or blocked", () => {
		const blocked = fakeStorage();
		blocked.getItem = () => {
			throw new Error("SecurityError: storage blocked");
		};
		expect(() => hydrateScene(blocked)).not.toThrow();
		expect(() => hydrateScene()).not.toThrow();
		expect(() => startScenePersistence(null)()).not.toThrow();
		expect(useScene.getState().boards).toEqual([]);
	});
});
