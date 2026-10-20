import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createStore } from "zustand/vanilla";
import { catalog } from "../catalog/load";
import type { SceneRepository } from "../lib/idb";
import {
	LEGACY_SCENE_KEY,
	parseSceneIndex,
	parseSettings,
	readSceneIndex,
	SCENE_INDEX_KEY,
	SETTINGS_KEY,
} from "../lib/sceneIndex";
import {
	createSceneLibraryRuntime,
	MAX_SCENES,
	type SceneLibraryRuntime,
	type SceneLibraryState,
} from "./library";
import { useReadOnly } from "./readOnly";
import { useScene } from "./scene";
import type { SceneDocument } from "./sceneDocument";
import { useSelection } from "./selection";

const boss = catalog.boards.find((board) => board.id === "boss-bcb-1000");
if (!boss) throw new Error("test fixture board missing from the seed");
const bossId = boss.id;

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

class MemoryRepository implements SceneRepository {
	docs = new Map<string, SceneDocument>();

	async all(): Promise<SceneDocument[]> {
		return [...this.docs.values()];
	}

	async get(id: string): Promise<SceneDocument | undefined> {
		return this.docs.get(id);
	}

	async put(document: SceneDocument): Promise<void> {
		this.docs.set(document.id, document);
	}

	async remove(id: string): Promise<void> {
		this.docs.delete(id);
	}
}

/** A repository that can simulate a blocked store after a successful boot. */
class FailingRepository extends MemoryRepository {
	failAll = false;
	failPuts = false;

	override async all(): Promise<SceneDocument[]> {
		if (this.failAll) throw new Error("blocked");
		return super.all();
	}

	override async put(document: SceneDocument): Promise<void> {
		if (this.failPuts) throw new Error("quota");
		return super.put(document);
	}
}

function documentOf(
	id: string,
	name: string,
	updatedAt: string,
	withBoard = false,
): SceneDocument {
	return {
		id,
		version: 1,
		name,
		boards: withBoard
			? [{ uid: `${id}-board`, boardRefId: bossId, x: 0, y: 0, rotationDeg: 0 }]
			: [],
		items: [],
		customPedals: [],
		updatedAt,
	};
}

const runtimes: SceneLibraryRuntime[] = [];

function required<T>(value: T | null | undefined): T {
	if (value === null || value === undefined)
		throw new Error("expected a value");
	return value;
}

function freshStore() {
	return createStore<SceneLibraryState>(() => ({
		scenes: [],
		activeId: null,
		ready: false,
		storageAvailable: false,
		sessionOnly: false,
		saving: false,
		lastSavedAt: null,
	}));
}

function setup(
	options: {
		repo?: SceneRepository | null;
		storage?: Storage;
		legacy?: Parameters<typeof createSceneLibraryRuntime>[0]["legacy"];
	} = {},
) {
	let tick = 0;
	let counter = 0;
	const store = freshStore();
	const runtime = createSceneLibraryRuntime({
		repo: options.repo === undefined ? new MemoryRepository() : options.repo,
		storage: options.storage ?? fakeStorage(),
		legacy: options.legacy,
		newId: () => `scene-${++counter}`,
		now: () => new Date(Date.parse("2026-10-19T12:00:00.000Z") + tick++ * 1000),
		autosaveDelayMs: 500,
		store,
	});
	runtimes.push(runtime);
	return { runtime, store };
}

describe("scene library", () => {
	beforeEach(() => {
		useScene.setState({ boards: [], items: [], customPedals: [] });
		useSelection.setState({ selection: null, hoveredItemUid: null });
		useReadOnly.setState({ readOnly: false });
	});

	afterEach(() => {
		for (const runtime of runtimes.splice(0)) runtime.dispose();
		vi.useRealTimers();
	});

	it("boots with a default scene, index and active id", async () => {
		const storage = fakeStorage();
		const { runtime, store } = setup({ storage });
		await runtime.boot();
		expect(store.getState()).toMatchObject({
			ready: true,
			storageAvailable: true,
			activeId: "scene-1",
		});
		expect(store.getState().scenes).toEqual([
			{
				id: "scene-1",
				name: "Scene 1",
				updatedAt: "2026-10-19T12:00:00.000Z",
				boardCount: 0,
				itemCount: 0,
			},
		]);
		expect(readSceneIndex(storage).scenes).toHaveLength(1);
		expect(parseSettings(storage.getItem(SETTINGS_KEY)).activeSceneId).toBe(
			"scene-1",
		);
	});

	it("reconciles stale index entries and orphaned documents at boot", async () => {
		const repo = new MemoryRepository();
		await repo.put(
			documentOf("kept", "Kept", "2026-10-19T10:00:00.000Z", true),
		);
		await repo.put(documentOf("orphan", "Orphan", "2026-10-19T11:00:00.000Z"));
		const storage = fakeStorage({
			[SCENE_INDEX_KEY]: JSON.stringify({
				version: 1,
				scenes: [
					{ id: "gone", name: "Gone", updatedAt: "2026-10-18T10:00:00.000Z" },
					{ id: "kept", name: "Old", updatedAt: "2026-10-18T10:00:00.000Z" },
				],
			}),
			[SETTINGS_KEY]: JSON.stringify({
				version: 1,
				units: "cm",
				activeSceneId: "gone",
			}),
		});
		const { runtime, store } = setup({ repo, storage });
		await runtime.boot();
		expect(store.getState().scenes.map((scene) => scene.id)).toEqual([
			"kept",
			"orphan",
		]);
		expect(store.getState().scenes[0].name).toBe("Kept");
		expect(store.getState().scenes[0].boardCount).toBe(1);
		// The gone active scene falls back to the newest surviving document.
		expect(store.getState().activeId).toBe("orphan");
		expect(
			parseSceneIndex(storage.getItem(SCENE_INDEX_KEY)).scenes,
		).toHaveLength(2);
		expect(useScene.getState().boards).toEqual([]);
	});

	it("migrates the legacy localStorage mirror once", async () => {
		const repo = new MemoryRepository();
		const storage = fakeStorage({
			[LEGACY_SCENE_KEY]: JSON.stringify({
				version: 1,
				boards: [{ uid: "b1", boardRefId: bossId, x: 0, y: 0, rotationDeg: 0 }],
				items: [
					{
						uid: "i1",
						refId: "boss-bd-2-blues-driver",
						kind: "pedal",
						boardUid: "b1",
						x: 1,
						y: 2,
						rotationDeg: 90,
						z: 0,
					},
				],
				customPedals: [],
			}),
		});
		const { runtime, store } = setup({
			repo,
			storage,
			legacy: {
				boards: [{ uid: "b1", boardRefId: bossId, x: 0, y: 0, rotationDeg: 0 }],
				items: [
					{
						uid: "i1",
						refId: "boss-bd-2-blues-driver",
						kind: "pedal",
						boardUid: "b1",
						x: 1,
						y: 2,
						rotationDeg: 90,
						z: 0,
					},
				],
				customPedals: [],
			},
		});
		await runtime.boot();
		expect(store.getState().scenes).toHaveLength(1);
		expect(store.getState().scenes[0].name).toBe("My board");
		expect(storage.getItem(LEGACY_SCENE_KEY)).toBeNull();
		expect(useScene.getState().boards).toHaveLength(1);
		expect(useScene.getState().items[0].rotationDeg).toBe(90);
		expect(repo.docs.get("scene-1")?.name).toBe("My board");
	});

	it("autosaves debounced changes into the active document + index", async () => {
		vi.useFakeTimers();
		const repo = new MemoryRepository();
		const { runtime, store } = setup({ repo });
		await runtime.boot();
		useScene.getState().addBoard(boss.id, { x: 0, y: 0 });
		expect(repo.docs.get("scene-1")?.boards).toHaveLength(0);
		await vi.advanceTimersByTimeAsync(500);
		const saved = repo.docs.get("scene-1");
		expect(saved?.boards).toHaveLength(1);
		expect(store.getState().lastSavedAt).toBe("2026-10-19T12:00:01.000Z");
		expect(store.getState().scenes[0].boardCount).toBe(1);
	});

	it("flushes the outgoing scene before switching", async () => {
		vi.useFakeTimers();
		const repo = new MemoryRepository();
		await repo.put(documentOf("a", "A", "2026-10-19T10:00:00.000Z"));
		await repo.put(documentOf("b", "B", "2026-10-19T09:00:00.000Z"));
		const storage = fakeStorage({
			[SCENE_INDEX_KEY]: JSON.stringify({
				version: 1,
				scenes: [
					{ id: "a", name: "A", updatedAt: "2026-10-19T10:00:00.000Z" },
					{ id: "b", name: "B", updatedAt: "2026-10-19T09:00:00.000Z" },
				],
			}),
		});
		const { runtime, store } = setup({ repo, storage });
		await runtime.boot();
		expect(store.getState().activeId).toBe("a");
		useScene.getState().addBoard(boss.id, { x: 0, y: 0 });
		// No timer advance: the switch itself must persist the pending change.
		expect(await runtime.switchScene("b")).toBe(true);
		expect(repo.docs.get("a")?.boards).toHaveLength(1);
		expect(useScene.getState().boards).toHaveLength(0);
	});

	it("creates a new named scene and switches back to the original content", async () => {
		const repo = new MemoryRepository();
		const { runtime, store } = setup({ repo });
		await runtime.boot();
		useScene.getState().addBoard(boss.id, { x: 0, y: 0 });
		await runtime.saveNow();
		expect(await runtime.newScene()).toBe("scene-2");
		expect(store.getState().activeId).toBe("scene-2");
		expect(store.getState().scenes.map((scene) => scene.name)).toEqual([
			"Scene 1",
			"Scene 2",
		]);
		expect(useScene.getState().boards).toHaveLength(0);
		expect(repo.docs.get("scene-2")?.boards).toHaveLength(0);
		expect(await runtime.switchScene("scene-1")).toBe(true);
		expect(useScene.getState().boards).toHaveLength(1);
	});

	it("renames active and inactive scenes in the index and documents", async () => {
		const repo = new MemoryRepository();
		const { runtime, store } = setup({ repo });
		await runtime.boot();
		expect(await runtime.renameScene("scene-1", "  Verse rig  ")).toBe(true);
		expect(store.getState().scenes[0].name).toBe("Verse rig");
		expect(repo.docs.get("scene-1")?.name).toBe("Verse rig");
		expect(await runtime.renameScene("scene-1", "   ")).toBe(false);
		expect(await runtime.renameScene("missing", "Nope")).toBe(false);

		await runtime.newScene("Chorus rig");
		expect(await runtime.renameScene("scene-1", "Verse 2")).toBe(true);
		expect(store.getState().scenes[0].name).toBe("Verse 2");
		expect(repo.docs.get("scene-1")?.name).toBe("Verse 2");
	});

	it("deletes scenes but never the last one", async () => {
		const repo = new MemoryRepository();
		const { runtime, store } = setup({ repo });
		await runtime.boot();
		expect(await runtime.deleteScene("scene-1")).toBe(false);
		await runtime.newScene("Second");
		expect(await runtime.deleteScene("scene-2")).toBe(true);
		expect(store.getState().scenes.map((scene) => scene.name)).toEqual([
			"Scene 1",
		]);
		expect(store.getState().activeId).toBe("scene-1");
		expect(repo.docs.has("scene-2")).toBe(false);

		await runtime.newScene("Third");
		await runtime.newScene("Fourth");
		// Deleting the non-active "Third" keeps the active scene.
		expect(await runtime.deleteScene("scene-3")).toBe(true);
		expect(store.getState().activeId).toBe("scene-4");
		expect(repo.docs.has("scene-3")).toBe(false);
	});

	it("deleting the active scene loads the next one", async () => {
		const repo = new MemoryRepository();
		await repo.put(documentOf("b", "B", "2026-10-19T09:00:00.000Z", true));
		const storage = fakeStorage({
			[SCENE_INDEX_KEY]: JSON.stringify({
				version: 1,
				scenes: [{ id: "b", name: "B", updatedAt: "2026-10-19T09:00:00.000Z" }],
			}),
		});
		const { runtime, store } = setup({ repo, storage });
		await runtime.boot();
		await runtime.newScene("A");
		expect(store.getState().activeId).toBe("scene-1");
		expect(useScene.getState().boards).toHaveLength(0);
		expect(await runtime.deleteScene("scene-1")).toBe(true);
		expect(store.getState().activeId).toBe("b");
		expect(useScene.getState().boards).toHaveLength(1);
	});

	it("never overwrites the register when the document store is unreadable", async () => {
		const repo = new FailingRepository();
		repo.failAll = true;
		const indexRaw = JSON.stringify({
			version: 1,
			scenes: [
				{ id: "a", name: "Kept sheet", updatedAt: "2026-10-19T10:00:00.000Z" },
			],
		});
		const settingsRaw = JSON.stringify({
			version: 1,
			units: "cm",
			activeSceneId: "a",
		});
		const storage = fakeStorage({
			[SCENE_INDEX_KEY]: indexRaw,
			[SETTINGS_KEY]: settingsRaw,
		});
		const legacy = {
			boards: [
				{ uid: "legacy-board", boardRefId: bossId, x: 0, y: 0, rotationDeg: 0 },
			],
			items: [],
			customPedals: [],
		};
		const { runtime, store } = setup({ repo, storage, legacy });
		await runtime.boot();
		expect(store.getState()).toMatchObject({
			ready: true,
			storageAvailable: false,
			activeId: "a",
		});
		expect(store.getState().scenes.map((scene) => scene.name)).toEqual([
			"Kept sheet",
		]);
		// The stored index/settings are untouched (no empty overwrite).
		expect(storage.getItem(SCENE_INDEX_KEY)).toBe(indexRaw);
		expect(storage.getItem(SETTINGS_KEY)).toBe(settingsRaw);
		// The legacy mirror is still usable in memory for the session.
		expect(useScene.getState().boards).toHaveLength(1);
		expect(repo.docs.size).toBe(0);
	});

	it("does not strand a legacy scene when its migration write fails", async () => {
		const repo = new FailingRepository();
		repo.failPuts = true;
		const legacy = {
			boards: [
				{ uid: "legacy-board", boardRefId: bossId, x: 0, y: 0, rotationDeg: 0 },
			],
			items: [],
			customPedals: [],
		};
		const storage = fakeStorage({
			[LEGACY_SCENE_KEY]: JSON.stringify({ version: 1, ...legacy }),
		});
		const { runtime, store } = setup({ repo, storage, legacy });
		await runtime.boot();
		expect(store.getState()).toMatchObject({
			ready: true,
			storageAvailable: false,
			activeId: null,
		});
		expect(store.getState().scenes).toEqual([]);
		// In-memory fallback only; the key stays for a later successful boot.
		expect(useScene.getState().boards).toHaveLength(1);
		expect(repo.docs.size).toBe(0);
		expect(storage.getItem(LEGACY_SCENE_KEY)).not.toBeNull();
	});

	it("never reports Saved when the document write fails", async () => {
		vi.useFakeTimers();
		const repo = new FailingRepository();
		const { runtime, store } = setup({ repo });
		await runtime.boot();
		repo.failPuts = true;
		useScene.getState().addBoard(bossId, { x: 0, y: 0 });
		await vi.advanceTimersByTimeAsync(500);
		expect(store.getState().storageAvailable).toBe(false);
		expect(store.getState().saving).toBe(false);
	});

	it("deleting an inactive scene keeps the flushed active metadata", async () => {
		vi.useFakeTimers();
		const repo = new MemoryRepository();
		await repo.put(documentOf("a", "A", "2026-10-19T10:00:00.000Z"));
		await repo.put(documentOf("b", "B", "2026-10-19T09:00:00.000Z"));
		const storage = fakeStorage({
			[SCENE_INDEX_KEY]: JSON.stringify({
				version: 1,
				scenes: [
					{ id: "a", name: "A", updatedAt: "2026-10-19T10:00:00.000Z" },
					{ id: "b", name: "B", updatedAt: "2026-10-19T09:00:00.000Z" },
				],
			}),
			[SETTINGS_KEY]: JSON.stringify({
				version: 1,
				units: "cm",
				activeSceneId: "a",
			}),
		});
		const { runtime } = setup({ repo, storage });
		await runtime.boot();
		useScene.getState().addBoard(bossId, { x: 0, y: 0 });
		expect(await runtime.deleteScene("b")).toBe(true);
		const index = readSceneIndex(storage);
		expect(index.scenes.map((scene) => scene.id)).toEqual(["a"]);
		// The flush updated A (new timestamp + board count), not the stale snapshot.
		expect(index.scenes[0].updatedAt).toBe("2026-10-19T12:00:00.000Z");
		expect(index.scenes[0].boardCount).toBe(1);
	});

	it("serialises two fast New scene clicks without losing an entry", async () => {
		const repo = new MemoryRepository();
		const { runtime, store } = setup({ repo });
		await runtime.boot();
		const [first, second] = await Promise.all([
			runtime.newScene("Fast A"),
			runtime.newScene("Fast B"),
		]);
		expect(first).toBeTruthy();
		expect(second).toBeTruthy();
		expect(store.getState().scenes.map((scene) => scene.name)).toEqual([
			"Scene 1",
			"Fast A",
			"Fast B",
		]);
		expect(repo.docs.size).toBe(3);
	});

	it("session-only actions never mutate the stored index", async () => {
		const indexRaw = JSON.stringify({
			version: 1,
			scenes: [
				{ id: "a", name: "A", updatedAt: "2026-10-19T10:00:00.000Z" },
				{ id: "b", name: "B", updatedAt: "2026-10-19T09:00:00.000Z" },
			],
		});
		const storage = fakeStorage({
			[SCENE_INDEX_KEY]: indexRaw,
			[SETTINGS_KEY]: JSON.stringify({
				version: 1,
				units: "cm",
				activeSceneId: "a",
			}),
		});
		const { runtime, store } = setup({ repo: null, storage });
		await runtime.boot();
		expect(store.getState().sessionOnly).toBe(true);
		expect(await runtime.switchScene("b")).toBe(false);
		expect(await runtime.deleteScene("b")).toBe(false);
		expect(await runtime.renameScene("b", "Nope")).toBe(false);
		expect(await runtime.newScene()).toBeNull();
		expect(storage.getItem(SCENE_INDEX_KEY)).toBe(indexRaw);
	});

	it("stops at the 10-scene product cap", async () => {
		const repo = new MemoryRepository();
		const { runtime, store } = setup({ repo });
		await runtime.boot();
		for (let index = 2; index <= MAX_SCENES; index++) {
			expect(await runtime.newScene(`Scene ${index}`)).toBeTruthy();
		}
		expect(store.getState().scenes).toHaveLength(MAX_SCENES);
		expect(await runtime.newScene("Too many")).toBeNull();
		expect(store.getState().scenes).toHaveLength(MAX_SCENES);
		expect(repo.docs.size).toBe(MAX_SCENES);
	});

	it("previews a shared scene read-only and never writes it into the recipient's document", async () => {
		vi.useFakeTimers();
		const repo = new MemoryRepository();
		const { runtime, store } = setup({ repo });
		await runtime.boot();

		// The recipient's own scene, persisted before the share opens.
		const recipientBoard = required(
			useScene.getState().addBoard(bossId, { x: 10, y: 10 }),
		);
		await vi.advanceTimersByTimeAsync(500);
		const before = repo.docs.get("scene-1");
		expect(before?.boards[0]?.uid).toBe(recipientBoard);

		await runtime.enterPreview(
			{
				boards: [
					{
						uid: "shared-board",
						boardRefId: bossId,
						x: 0,
						y: 0,
						rotationDeg: 0,
					},
				],
				items: [
					{
						uid: "shared-item",
						refId: "boss-bd-2-blues-driver",
						kind: "pedal",
						boardUid: "shared-board",
						x: 1,
						y: 2,
						rotationDeg: 0,
						z: 0,
					},
				],
				customPedals: [],
			},
			"Shared board",
		);
		expect(useReadOnly.getState().readOnly).toBe(true);
		expect(store.getState().activeId).toBe("scene-1");
		expect(useScene.getState().boards[0]?.uid).toBe("shared-board");

		// Editing is refused while the preview is open.
		expect(useScene.getState().addBoard(bossId, { x: 0, y: 0 })).toBeNull();
		useScene.getState().removeBoard("shared-board");
		expect(useScene.getState().boards).toHaveLength(1);
		expect(useScene.getState().boards[0]?.uid).toBe("shared-board");

		// No autosave may leak the shared content into the recipient's document.
		await vi.advanceTimersByTimeAsync(1_000);
		expect(repo.docs.get("scene-1")).toEqual(before);
	});

	it("saves a preview as a new editable scene and leaves the recipient's original intact", async () => {
		vi.useFakeTimers();
		const repo = new MemoryRepository();
		const { runtime, store } = setup({ repo });
		await runtime.boot();
		const recipientBoard = required(
			useScene.getState().addBoard(bossId, { x: 10, y: 10 }),
		);
		await vi.advanceTimersByTimeAsync(500);
		const before = repo.docs.get("scene-1");

		await runtime.enterPreview(
			{
				boards: [
					{
						uid: "shared-board",
						boardRefId: bossId,
						x: 0,
						y: 0,
						rotationDeg: 0,
					},
				],
				items: [],
				customPedals: [],
			},
			"Shared board",
		);
		const result = await runtime.savePreviewAsCopy();
		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error(result.message);
		expect(result.name).toBe("Shared board (copy)");
		expect(store.getState().scenes).toHaveLength(2);
		expect(store.getState().activeId).toBe(result.id);
		expect(useReadOnly.getState().readOnly).toBe(false);
		expect(useScene.getState().boards[0]?.uid).toBe("shared-board");
		expect(repo.docs.get(result.id)?.boards[0]?.uid).toBe("shared-board");
		expect(repo.docs.get("scene-1")).toEqual(before);
		expect(before?.boards[0]?.uid).toBe(recipientBoard);
	});

	it("exits a preview back to the recipient's scene", async () => {
		vi.useFakeTimers();
		const repo = new MemoryRepository();
		const { runtime, store } = setup({ repo });
		await runtime.boot();
		const recipientBoard = required(
			useScene.getState().addBoard(bossId, { x: 10, y: 10 }),
		);
		await vi.advanceTimersByTimeAsync(500);
		await runtime.enterPreview(
			{
				boards: [
					{
						uid: "shared-board",
						boardRefId: bossId,
						x: 0,
						y: 0,
						rotationDeg: 0,
					},
				],
				items: [],
				customPedals: [],
			},
			"Shared board",
		);
		await runtime.exitPreview();
		expect(useReadOnly.getState().readOnly).toBe(false);
		expect(store.getState().activeId).toBe("scene-1");
		expect(useScene.getState().boards[0]?.uid).toBe(recipientBoard);
	});

	it("restores the in-memory scene on exit even when the entry flush failed", async () => {
		vi.useFakeTimers();
		const repo = new FailingRepository();
		const { runtime } = setup({ repo });
		await runtime.boot();
		const recipientBoard = required(
			useScene.getState().addBoard(bossId, { x: 10, y: 10 }),
		);
		// The outgoing flush fails (quota/eviction). The snapshot captured at
		// enterPreview is the only copy of the recipient's unsaved work.
		repo.failPuts = true;
		await runtime.enterPreview(
			{
				boards: [
					{
						uid: "shared-board",
						boardRefId: bossId,
						x: 0,
						y: 0,
						rotationDeg: 0,
					},
				],
				items: [],
				customPedals: [],
			},
			"Shared board",
		);
		await runtime.exitPreview();
		expect(useReadOnly.getState().readOnly).toBe(false);
		expect(useScene.getState().boards[0]?.uid).toBe(recipientBoard);
	});

	it("stays in preview when the save-a-copy write fails", async () => {
		vi.useFakeTimers();
		const repo = new FailingRepository();
		const { runtime, store } = setup({ repo });
		await runtime.boot();
		await runtime.enterPreview(
			{
				boards: [
					{
						uid: "shared-board",
						boardRefId: bossId,
						x: 0,
						y: 0,
						rotationDeg: 0,
					},
				],
				items: [],
				customPedals: [],
			},
			"Shared board",
		);
		repo.failPuts = true;
		const result = await runtime.savePreviewAsCopy();
		expect(result).toMatchObject({ ok: false, reason: "write" });
		expect(store.getState().scenes).toHaveLength(1);
		expect(useReadOnly.getState().readOnly).toBe(true);
		expect(useScene.getState().boards[0]?.uid).toBe("shared-board");
	});

	it("refuses save-a-copy at the scene cap without leaving preview", async () => {
		const repo = new MemoryRepository();
		const { runtime, store } = setup({ repo });
		await runtime.boot();
		for (let index = 2; index <= MAX_SCENES; index++) {
			expect(await runtime.newScene(`Scene ${index}`)).toBeTruthy();
		}
		await runtime.enterPreview(
			{
				boards: [
					{
						uid: "shared-board",
						boardRefId: bossId,
						x: 0,
						y: 0,
						rotationDeg: 0,
					},
				],
				items: [],
				customPedals: [],
			},
			"Shared board",
		);
		const result = await runtime.savePreviewAsCopy();
		expect(result).toMatchObject({ ok: false, reason: "limit" });
		expect(store.getState().scenes).toHaveLength(MAX_SCENES);
		expect(useReadOnly.getState().readOnly).toBe(true);
	});

	it("boots in session-only mode when storage is unavailable", async () => {
		const { runtime, store } = setup({ repo: null });
		await expect(runtime.boot()).resolves.toBeUndefined();
		expect(store.getState()).toMatchObject({
			ready: true,
			storageAvailable: false,
			activeId: null,
		});
		expect(await runtime.newScene()).toBeNull();
	});
});
