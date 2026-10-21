import { describe, expect, it } from "vitest";
import {
	DEFAULT_SETTINGS,
	nextSceneName,
	parseSceneIndex,
	parseSettings,
	readSceneIndex,
	reconcileIndex,
	SCENE_INDEX_KEY,
	type SceneIndexEntry,
	SETTINGS_KEY,
	writeSceneIndex,
	writeSettings,
} from "./sceneIndex";

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

const entry = (overrides: Partial<SceneIndexEntry> = {}): SceneIndexEntry => ({
	id: "a",
	name: "Scene A",
	updatedAt: "2026-10-19T10:00:00.000Z",
	boardCount: 1,
	itemCount: 2,
	...overrides,
});

describe("scene index", () => {
	it("parses an empty/corrupt index as empty", () => {
		expect(parseSceneIndex(null)).toEqual({ version: 1, scenes: [] });
		expect(parseSceneIndex("{")).toEqual({ version: 1, scenes: [] });
		expect(parseSceneIndex(JSON.stringify({ version: 2 }))).toEqual({
			version: 1,
			scenes: [],
		});
	});

	it("drops malformed/duplicate entries", () => {
		const parsed = parseSceneIndex(
			JSON.stringify({
				version: 1,
				scenes: [
					entry(),
					entry({ name: "duplicate id" }),
					{ id: "bad" },
					entry({ id: "b", boardCount: -1 }),
				],
			}),
		);
		expect(parsed.scenes).toEqual([entry()]);
	});

	it("round-trips through storage and fails soft when blocked", () => {
		const storage = fakeStorage();
		expect(writeSceneIndex({ version: 1, scenes: [entry()] }, storage)).toBe(
			true,
		);
		expect(readSceneIndex(storage).scenes).toEqual([entry()]);
		const blocked = fakeStorage();
		blocked.getItem = () => {
			throw new Error("blocked");
		};
		blocked.setItem = () => {
			throw new Error("blocked");
		};
		expect(readSceneIndex(blocked)).toEqual({ version: 1, scenes: [] });
		expect(writeSceneIndex({ version: 1, scenes: [] }, blocked)).toBe(false);
		expect(readSceneIndex(fakeStorage({ [SCENE_INDEX_KEY]: "{oops" }))).toEqual(
			{
				version: 1,
				scenes: [],
			},
		);
	});
});

describe("settings", () => {
	it("defaults corrupt/missing payloads to cm and no active scene", () => {
		expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
		expect(parseSettings("{")).toEqual(DEFAULT_SETTINGS);
		expect(parseSettings(JSON.stringify({ version: 2 }))).toEqual(
			DEFAULT_SETTINGS,
		);
	});

	it("round-trips units and the active scene id, merging patches", () => {
		const storage = fakeStorage();
		expect(writeSettings({ units: "in" }, storage)).toBe(true);
		expect(writeSettings({ activeSceneId: "scene-2" }, storage)).toBe(true);
		expect(readSceneIndex(storage)).toEqual({ version: 1, scenes: [] });
		expect(parseSettings(storage.getItem(SETTINGS_KEY))).toEqual({
			version: 1,
			units: "in",
			activeSceneId: "scene-2",
			showCables: true,
		});
		expect(writeSettings({ showCables: false }, storage)).toBe(true);
		expect(parseSettings(storage.getItem(SETTINGS_KEY)).showCables).toBe(false);
	});
});

describe("boot reconcile", () => {
	it("drops index entries with no document and surfaces orphans", () => {
		const result = reconcileIndex(
			[
				entry({ id: "kept", name: "Old name", itemCount: 1 }),
				entry({ id: "gone" }),
			],
			[
				{
					id: "kept",
					name: "New name",
					updatedAt: "2026-10-19T11:00:00.000Z",
					boardCount: 2,
					itemCount: 5,
				},
				{
					id: "orphan-old",
					name: "Orphan old",
					updatedAt: "2026-10-18T09:00:00.000Z",
				},
				{
					id: "orphan-new",
					name: "Orphan new",
					updatedAt: "2026-10-19T09:00:00.000Z",
				},
			],
		);
		expect(result.dropped).toEqual(["gone"]);
		expect(result.added).toEqual(["orphan-new", "orphan-old"]);
		expect(result.changed).toBe(true);
		expect(result.index.map((scene) => scene.id)).toEqual([
			"kept",
			"orphan-new",
			"orphan-old",
		]);
		expect(result.index[0]).toEqual({
			id: "kept",
			name: "New name",
			updatedAt: "2026-10-19T11:00:00.000Z",
			boardCount: 2,
			itemCount: 5,
		});
	});

	it("is idempotent on an already-consistent index", () => {
		const scenes = [entry({ id: "a" }), entry({ id: "b" })];
		const docs = scenes.map((scene) => ({
			id: scene.id,
			name: scene.name,
			updatedAt: scene.updatedAt,
			boardCount: scene.boardCount,
			itemCount: scene.itemCount,
		}));
		const first = reconcileIndex(scenes, docs);
		expect(first.changed).toBe(false);
		const second = reconcileIndex(first.index, docs);
		expect(second.changed).toBe(false);
		expect(second.index).toEqual(scenes);
	});
});

describe("default scene names", () => {
	it("picks the first free Scene N", () => {
		expect(nextSceneName([])).toBe("Scene 1");
		expect(nextSceneName([entry({ name: "Scene 1" })])).toBe("Scene 2");
		expect(
			nextSceneName([
				entry({ id: "a", name: "Scene 1" }),
				entry({ id: "b", name: "Scene 3" }),
			]),
		).toBe("Scene 2");
	});
});
