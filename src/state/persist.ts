import { openSceneRepository, type SceneRepository } from "../lib/idb";
import { LEGACY_SCENE_KEY } from "../lib/sceneIndex";
import { resolveStorage } from "../lib/storage";
import {
	classifyStorageHealth,
	probeStorage,
	readStorageEstimate,
} from "../lib/storageHealth";
import {
	createSceneLibraryRuntime,
	type SceneLibraryRuntime,
	setSceneLibraryRuntime,
} from "./library";
import {
	isCable,
	isCustomPedal,
	isEndpoint,
	isPlacedBoard,
	isPlacedItem,
	type SceneSnapshot,
} from "./sceneDocument";

/**
 * The P1-06 temporary single-scene mirror (`localStorage`). P3-02 replaces it
 * with IndexedDB documents + a multi-scene index; this module now only parses
 * the legacy payload once so boot can migrate it into a named scene.
 */
export const SCENE_STORAGE_KEY = LEGACY_SCENE_KEY;

export type { SceneSnapshot };

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

/** Build a legacy snapshot payload (tests/tools). */
export function serializeScene(state: SceneSnapshot): string {
	return JSON.stringify({
		version: 1,
		boards: state.boards,
		items: state.items,
		customPedals: state.customPedals,
		endpoints: state.endpoints,
		cables: state.cables,
	});
}

/**
 * Parse the legacy snapshot, returning null for anything missing, corrupt or
 * from an unknown version (never throws). Bad entries are dropped rather than
 * failing the whole load.
 */
export function parseSceneSnapshot(raw: string | null): SceneSnapshot | null {
	if (!raw) return null;
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return null;
	}
	if (!isRecord(parsed) || parsed.version !== 1) return null;
	if (!Array.isArray(parsed.boards) || !Array.isArray(parsed.items))
		return null;
	const customPedals = Array.isArray(parsed.customPedals)
		? parsed.customPedals.filter(isCustomPedal)
		: [];
	// The legacy mirror predates cables/endpoints (P4-01), but a newer backup
	// replayed through this path must not silently lose them — the arrays are
	// additive and structurally validated like the IndexedDB codec.
	const endpoints = Array.isArray(parsed.endpoints)
		? parsed.endpoints.filter(isEndpoint)
		: [];
	const cables = Array.isArray(parsed.cables)
		? parsed.cables.filter(isCable)
		: [];
	return {
		boards: parsed.boards.filter(isPlacedBoard),
		items: parsed.items.filter(isPlacedItem),
		customPedals,
		endpoints,
		cables,
	};
}

/** Read the legacy mirror (fail-soft). */
export function readLegacyScene(
	storage?: Storage | null,
): SceneSnapshot | null {
	const target = resolveStorage(storage);
	if (!target) return null;
	try {
		return parseSceneSnapshot(target.getItem(SCENE_STORAGE_KEY));
	} catch {
		return null;
	}
}

/**
 * Boot persistence: open IndexedDB, reconcile the index, migrate the legacy
 * mirror once, hydrate the active scene, and start autosave. Never throws — if
 * storage is unavailable the app renders and runs in memory (P3-05 will add
 * the user-facing warning + JSON backup).
 */
export async function bootScenePersistence(): Promise<SceneLibraryRuntime> {
	const storage = resolveStorage();
	const legacy = readLegacyScene(storage);
	// P3-05: the advisory quota probe runs concurrently with the IDB open (the
	// critical path is the slower of the two, not their sum) and is time-boxed.
	const estimate = readStorageEstimate();
	let repo: SceneRepository | null = null;
	try {
		repo = await openSceneRepository();
	} catch {
		repo = null;
	}
	// Classify storage once (IDB open + localStorage usability + quota) instead
	// of scattering try/catch through the UI. A missing IDB cannot be rescued by
	// the estimate, so don't wait for it in that case.
	const health = classifyStorageHealth(
		await probeStorage({
			indexedDbAvailable: repo !== null,
			storage,
			estimate: repo === null ? () => Promise.resolve(null) : () => estimate,
		}),
	);
	const runtime = createSceneLibraryRuntime({ repo, storage, legacy, health });
	setSceneLibraryRuntime(runtime);
	try {
		await runtime.boot();
	} catch {
		// Keep the in-memory app usable; the library stays "not ready".
	}
	return runtime;
}
