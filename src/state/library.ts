import { useStore } from "zustand";
import { createStore, type StoreApi } from "zustand/vanilla";
import type { SceneRepository } from "../lib/idb";
import {
	LEGACY_SCENE_KEY,
	nextSceneName,
	readSceneIndex,
	readSettings,
	reconcileIndex,
	type SceneIndexEntry,
	writeSceneIndex,
	writeSettings,
} from "../lib/sceneIndex";
import { type AutosaveTimers, createAutosave } from "./autosave";
import { useScene } from "./scene";
import {
	createSceneDocument,
	normalizeSceneContent,
	parseSceneDocument,
	type SceneDocument,
	type SceneSnapshot,
	sceneFromDocument,
} from "./sceneDocument";
import { useSelection } from "./selection";

/**
 * The multi-scene library (F8). Scene documents live in IndexedDB, the index
 * (id → name, updatedAt) + active-scene id live in `localStorage`. This store
 * is the React-facing snapshot; all writes go through the runtime below.
 */
export interface SceneLibraryState {
	scenes: SceneIndexEntry[];
	activeId: string | null;
	/** Boot finished (the UI can render a real state). */
	ready: boolean;
	/** IndexedDB + the index store are usable (P3-05 surfaces a warning). */
	storageAvailable: boolean;
	/** Documents could not be read/opened at boot: session-only canvas. */
	sessionOnly: boolean;
	saving: boolean;
	/** ISO timestamp of the last successful write. */
	lastSavedAt: string | null;
}

const INITIAL_STATE: SceneLibraryState = {
	scenes: [],
	activeId: null,
	ready: false,
	storageAvailable: false,
	sessionOnly: false,
	saving: false,
	lastSavedAt: null,
};

export const sceneLibraryStore: StoreApi<SceneLibraryState> =
	createStore<SceneLibraryState>(() => INITIAL_STATE);

/** Subscribe to the library snapshot from React. */
export function useSceneLibrary<T>(
	selector: (state: SceneLibraryState) => T,
): T {
	return useStore(sceneLibraryStore, selector);
}

export const SCENE_NAME_MAX_LENGTH = 48;

/** Trim + cap a user-entered scene name; empty/whitespace → null. */
export function normalizeSceneName(name: string): string | null {
	const trimmed = name.trim();
	if (!trimmed) return null;
	return trimmed.slice(0, SCENE_NAME_MAX_LENGTH);
}

export interface SceneLibraryDeps {
	/** Null when IndexedDB is unavailable — the app keeps an in-memory scene. */
	repo: SceneRepository | null;
	storage: Storage | null;
	/** A pre-P3-02 single-scene mirror to migrate once (P1-06). */
	legacy?: SceneSnapshot | null;
	newId?: () => string;
	now?: () => Date;
	autosaveDelayMs?: number;
	timers?: AutosaveTimers;
	store?: StoreApi<SceneLibraryState>;
}

export interface SceneLibraryRuntime {
	store: StoreApi<SceneLibraryState>;
	boot: () => Promise<void>;
	newScene: (name?: string) => Promise<string | null>;
	switchScene: (id: string) => Promise<boolean>;
	renameScene: (id: string, name: string) => Promise<boolean>;
	deleteScene: (id: string) => Promise<boolean>;
	saveNow: () => Promise<void>;
	dispose: () => void;
}

function emptyScene(): SceneSnapshot {
	return { boards: [], items: [], customPedals: [] };
}

function activeEntry(state: SceneLibraryState): SceneIndexEntry | undefined {
	return state.scenes.find((entry) => entry.id === state.activeId);
}

function newestSceneId(entries: SceneIndexEntry[]): string | null {
	let newest: SceneIndexEntry | null = null;
	for (const entry of entries) {
		const time = Date.parse(entry.updatedAt);
		const newestTime = newest
			? Date.parse(newest.updatedAt)
			: Number.NEGATIVE_INFINITY;
		if (!newest || time > newestTime) newest = entry;
	}
	return newest?.id ?? null;
}

/**
 * Create and boot the scene library. Kept as a factory so unit tests can inject
 * an in-memory repository/storage instead of a browser IndexedDB.
 */
export function createSceneLibraryRuntime(
	deps: SceneLibraryDeps,
): SceneLibraryRuntime {
	const store = deps.store ?? sceneLibraryStore;
	const newId = deps.newId ?? (() => crypto.randomUUID());
	const now = deps.now ?? (() => new Date());
	const nowIso = () => now().toISOString();

	let applying = false;
	let disposed = false;
	let unsubscribe: (() => void) | null = null;

	const persistIndex = (): boolean => {
		if (store.getState().sessionOnly) return false;
		const ok = writeSceneIndex(
			{ version: 1, scenes: store.getState().scenes },
			deps.storage,
		);
		if (!ok) store.setState({ storageAvailable: false });
		return ok;
	};

	const applyScene = (snapshot: SceneSnapshot) => {
		applying = true;
		try {
			useScene.setState({
				boards: snapshot.boards,
				items: snapshot.items,
				customPedals: snapshot.customPedals,
			});
			useSelection.getState().clearSelection();
		} finally {
			applying = false;
		}
	};

	const saveActive = async (): Promise<void> => {
		const state = store.getState();
		if (!deps.repo || !state.activeId || state.sessionOnly) return;
		const entry = activeEntry(state);
		if (!entry) return;
		const scene = useScene.getState();
		const updatedAt = nowIso();
		const document = createSceneDocument({
			id: state.activeId,
			name: entry.name,
			boards: scene.boards,
			items: scene.items,
			customPedals: scene.customPedals,
			updatedAt,
		});
		store.setState({ saving: true });
		try {
			await deps.repo.put(document);
		} catch {
			// Never claim "Saved" for a write that did not land. P3-05 adds the
			// user-facing warning + JSON backup.
			store.setState({ saving: false, storageAvailable: false });
			return;
		}
		const scenes = store.getState().scenes.map((candidate) =>
			candidate.id === state.activeId
				? {
						...candidate,
						updatedAt,
						boardCount: scene.boards.length,
						itemCount: scene.items.length,
					}
				: candidate,
		);
		store.setState({ saving: false, scenes, lastSavedAt: updatedAt });
		persistIndex();
	};

	const autosave = createAutosave(saveActive, {
		delayMs: deps.autosaveDelayMs,
		timers: deps.timers,
	});

	const subscribe = () => {
		unsubscribe?.();
		unsubscribe = useScene.subscribe((state, previous) => {
			if (applying || disposed) return;
			if (
				state.boards !== previous.boards ||
				state.items !== previous.items ||
				state.customPedals !== previous.customPedals
			) {
				autosave.schedule();
			}
		});
	};

	// `pagehide` does not guarantee visibilityState === "hidden", so flush
	// unconditionally there; the visibility event keeps its hidden check.
	const flushOnPageHide = () => {
		void autosave.flush();
	};
	const flushOnHidden = () => {
		if (document.visibilityState === "hidden") void autosave.flush();
	};
	const installLifecycle = () => {
		if (typeof window === "undefined") return;
		window.addEventListener("pagehide", flushOnPageHide);
		document.addEventListener("visibilitychange", flushOnHidden);
	};
	const removeLifecycle = () => {
		if (typeof window === "undefined") return;
		window.removeEventListener("pagehide", flushOnPageHide);
		document.removeEventListener("visibilitychange", flushOnHidden);
	};

	const loadDocument = async (id: string): Promise<SceneDocument | null> => {
		if (!deps.repo) return null;
		try {
			return parseSceneDocument(await deps.repo.get(id));
		} catch {
			return null;
		}
	};

	const boot = async (): Promise<void> => {
		const baseIndex = readSceneIndex(deps.storage);
		const preferred = readSettings(deps.storage).activeSceneId;

		let documents: SceneDocument[] = [];
		let documentsAvailable = false;
		if (deps.repo) {
			try {
				const stored = await deps.repo.all();
				documents = stored
					.map(parseSceneDocument)
					.filter((document): document is SceneDocument => document !== null);
				documentsAvailable = true;
			} catch {
				// A failed read is NOT an empty library. Never reconcile/persist
				// the resulting empty list over a valid stored register.
				documentsAvailable = false;
			}
		}

		if (!documentsAvailable) {
			// Session-only: keep the stored register visible, hydrate the legacy
			// mirror in memory if present, and never write over the real store.
			const scenes = baseIndex.scenes;
			const activeId =
				preferred && scenes.some((entry) => entry.id === preferred)
					? preferred
					: newestSceneId(scenes);
			store.setState({
				scenes,
				activeId,
				ready: true,
				storageAvailable: false,
				sessionOnly: true,
				saving: false,
				lastSavedAt:
					scenes.find((entry) => entry.id === activeId)?.updatedAt ?? null,
			});
			applyScene(
				deps.legacy
					? normalizeSceneContent({
							boards: deps.legacy.boards,
							items: deps.legacy.items,
							customPedals: deps.legacy.customPedals,
						})
					: emptyScene(),
			);
			return;
		}

		let storageAvailable = deps.storage !== null;
		const reconciled = reconcileIndex(
			baseIndex.scenes,
			documents.map(({ id, name, updatedAt, boards, items }) => ({
				id,
				name,
				updatedAt,
				boardCount: boards.length,
				itemCount: items.length,
			})),
		);
		let scenes = reconciled.index;

		// Migrate the P1-06 single-scene localStorage mirror exactly once, when
		// there is nothing in the new store yet.
		if (scenes.length === 0 && deps.legacy) {
			const id = newId();
			const content = normalizeSceneContent({
				boards: deps.legacy.boards,
				items: deps.legacy.items,
				customPedals: deps.legacy.customPedals,
			});
			const document = createSceneDocument({
				id,
				name: "My board",
				...content,
				updatedAt: nowIso(),
			});
			try {
				await deps.repo?.put(document);
				documents.push(document);
				scenes = [
					{
						id,
						name: document.name,
						updatedAt: document.updatedAt,
						boardCount: document.boards.length,
						itemCount: document.items.length,
					},
				];
				try {
					deps.storage?.removeItem(LEGACY_SCENE_KEY);
				} catch {
					// Fail-soft: the migrated scene is already in IndexedDB.
				}
			} catch {
				storageAvailable = false;
			}
		}

		// Always have one named scene to edit (but never paper over a failed
		// legacy migration: that would strand the user's old scene in the key).
		if (scenes.length === 0 && !deps.legacy && deps.repo) {
			const id = newId();
			const document = createSceneDocument({
				id,
				name: nextSceneName(scenes),
				...emptyScene(),
				updatedAt: nowIso(),
			});
			try {
				await deps.repo.put(document);
				documents.push(document);
				scenes = [
					{
						id,
						name: document.name,
						updatedAt: document.updatedAt,
						boardCount: 0,
						itemCount: 0,
					},
				];
				storageAvailable = true;
			} catch {
				storageAvailable = false;
			}
		}

		if (scenes.length === 0) {
			// Writes failed: hydrate the legacy mirror in memory and stay
			// session-only rather than persisting an empty register.
			store.setState({
				scenes: [],
				activeId: null,
				ready: true,
				storageAvailable: false,
				sessionOnly: true,
				saving: false,
				lastSavedAt: null,
			});
			applyScene(
				deps.legacy
					? normalizeSceneContent({
							boards: deps.legacy.boards,
							items: deps.legacy.items,
							customPedals: deps.legacy.customPedals,
						})
					: emptyScene(),
			);
			return;
		}

		let activeId =
			preferred && scenes.some((entry) => entry.id === preferred)
				? preferred
				: newestSceneId(scenes);

		store.setState({
			scenes,
			activeId,
			ready: true,
			storageAvailable,
			sessionOnly: false,
			saving: false,
			lastSavedAt:
				scenes.find((entry) => entry.id === activeId)?.updatedAt ?? null,
		});
		persistIndex();
		writeSettings({ activeSceneId: activeId }, deps.storage);

		if (activeId) {
			let document: SceneDocument | null =
				documents.find((candidate) => candidate.id === activeId) ?? null;
			if (!document) {
				document = await loadDocument(activeId);
				if (!document) {
					// The document disappeared between the reconcile and the load.
					const remaining = scenes.filter((entry) => entry.id !== activeId);
					activeId = newestSceneId(remaining);
					scenes = remaining;
					store.setState({ scenes, activeId });
					persistIndex();
					writeSettings({ activeSceneId: activeId }, deps.storage);
				}
			}
			applyScene(document ? sceneFromDocument(document) : emptyScene());
		} else {
			applyScene(emptyScene());
		}

		subscribe();
		installLifecycle();
	};

	const newScene = async (name?: string): Promise<string | null> => {
		if (!deps.repo || store.getState().sessionOnly) return null;
		await autosave.flush();
		const state = store.getState();
		const id = newId();
		const sceneName =
			(name === undefined ? null : normalizeSceneName(name)) ??
			nextSceneName(state.scenes);
		const updatedAt = nowIso();
		const document = createSceneDocument({
			id,
			name: sceneName,
			...emptyScene(),
			updatedAt,
		});
		try {
			await deps.repo.put(document);
		} catch {
			return null;
		}
		const scenes = [
			...store.getState().scenes,
			{ id, name: sceneName, updatedAt, boardCount: 0, itemCount: 0 },
		];
		store.setState({
			scenes,
			activeId: id,
			lastSavedAt: updatedAt,
			saving: false,
		});
		persistIndex();
		writeSettings({ activeSceneId: id }, deps.storage);
		applyScene(emptyScene());
		autosave.cancel();
		return id;
	};

	const switchScene = async (id: string): Promise<boolean> => {
		const state = store.getState();
		if (state.sessionOnly) return false;
		if (id === state.activeId) return true;
		if (!state.scenes.some((entry) => entry.id === id)) return false;
		await autosave.flush();
		const document = await loadDocument(id);
		if (!document) {
			// Stale index entry: drop it so the UI reflects reality.
			const scenes = store.getState().scenes.filter((entry) => entry.id !== id);
			store.setState({ scenes });
			persistIndex();
			return false;
		}
		store.setState({
			activeId: id,
			lastSavedAt: document.updatedAt,
			saving: false,
		});
		writeSettings({ activeSceneId: id }, deps.storage);
		applyScene(sceneFromDocument(document));
		autosave.cancel();
		return true;
	};

	const renameScene = async (id: string, name: string): Promise<boolean> => {
		if (store.getState().sessionOnly) return false;
		const nextName = normalizeSceneName(name);
		if (!nextName) return false;
		const state = store.getState();
		const entry = state.scenes.find((candidate) => candidate.id === id);
		if (!entry) return false;
		if (entry.name === nextName) return true;
		// Capture pending geometry under the old name before the index changes.
		await autosave.flush();
		const scenes = store
			.getState()
			.scenes.map((candidate) =>
				candidate.id === id ? { ...candidate, name: nextName } : candidate,
			);
		store.setState({ scenes });
		persistIndex();
		if (id === store.getState().activeId) {
			await saveActive();
		} else if (deps.repo) {
			try {
				const document = await deps.repo.get(id);
				if (document) await deps.repo.put({ ...document, name: nextName });
			} catch {
				return false;
			}
		}
		return true;
	};

	const deleteScene = async (id: string): Promise<boolean> => {
		const initial = store.getState();
		if (initial.sessionOnly) return false;
		if (initial.scenes.length <= 1) return false;
		const removingActive = initial.activeId === id;
		if (removingActive) autosave.cancel();
		else await autosave.flush();
		// Re-read after the flush: it updates the active entry's metadata.
		const state = store.getState();
		const position = state.scenes.findIndex((entry) => entry.id === id);
		if (position === -1) return false;
		if (deps.repo) {
			try {
				await deps.repo.remove(id);
			} catch {
				return false;
			}
		}
		const scenes = state.scenes.filter((entry) => entry.id !== id);
		if (!removingActive) {
			store.setState({ scenes });
			persistIndex();
			return true;
		}
		const next = scenes[Math.min(position, scenes.length - 1)];
		const document = await loadDocument(next.id);
		store.setState({
			scenes,
			activeId: next.id,
			lastSavedAt: document?.updatedAt ?? null,
			saving: false,
		});
		persistIndex();
		writeSettings({ activeSceneId: next.id }, deps.storage);
		applyScene(document ? sceneFromDocument(document) : emptyScene());
		return true;
	};

	const saveNow = async (): Promise<void> => {
		await autosave.flush();
	};

	const dispose = () => {
		disposed = true;
		autosave.cancel();
		unsubscribe?.();
		unsubscribe = null;
		removeLifecycle();
	};

	// Mutating library actions run one at a time so a fast double "New scene"
	// (or a delete racing a flush) can never overwrite the register with a stale
	// snapshot.
	let tail: Promise<unknown> = Promise.resolve();
	const serialize = <T>(task: () => Promise<T>): Promise<T> => {
		const result = tail.then(task, task);
		tail = result.then(
			() => undefined,
			() => undefined,
		);
		return result;
	};

	return {
		store,
		boot,
		newScene: (name) => serialize(() => newScene(name)),
		switchScene: (id) => serialize(() => switchScene(id)),
		renameScene: (id, name) => serialize(() => renameScene(id, name)),
		deleteScene: (id) => serialize(() => deleteScene(id)),
		saveNow,
		dispose,
	};
}

let runtime: SceneLibraryRuntime | null = null;

/** Register the booted runtime so the UI can call its actions. */
export function setSceneLibraryRuntime(
	next: SceneLibraryRuntime | null,
): SceneLibraryRuntime | null {
	runtime = next;
	return runtime;
}

/** UI action facade (safe before boot: no-ops). */
export const sceneLibrary = {
	newScene: (name?: string): Promise<string | null> =>
		runtime?.newScene(name) ?? Promise.resolve(null),
	switchScene: (id: string): Promise<boolean> =>
		runtime?.switchScene(id) ?? Promise.resolve(false),
	renameScene: (id: string, name: string): Promise<boolean> =>
		runtime?.renameScene(id, name) ?? Promise.resolve(false),
	deleteScene: (id: string): Promise<boolean> =>
		runtime?.deleteScene(id) ?? Promise.resolve(false),
	saveNow: (): Promise<void> => runtime?.saveNow() ?? Promise.resolve(),
};
