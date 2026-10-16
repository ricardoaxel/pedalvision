import type { PlacedBoard, PlacedItem } from "./scene";
import { normalizeAllZ, useScene } from "./scene";

/**
 * Temporary v1 scene save (P1-06): the boards + items slices are mirrored to
 * localStorage so z-order (and geometry) survives a reload. This is intentionally
 * minimal — the real save system (IndexedDB + autosave + boot reconcile) is
 * P3-02 and will replace it. Only the persisted scene fields are stored; transient
 * UI state (selection, viewport, drag) is never saved.
 */
export const SCENE_STORAGE_KEY = "pedalvision.scene.v1";

/** The persisted subset of the scene document, versioned for future migrations. */
export interface SceneSnapshot {
	version: 1;
	boards: PlacedBoard[];
	items: PlacedItem[];
}

/** A snapshot of the store's persisted fields. */
export function sceneSnapshot(state: {
	boards: PlacedBoard[];
	items: PlacedItem[];
}): SceneSnapshot {
	return { version: 1, boards: state.boards, items: state.items };
}

/** Serialise the persisted fields to a JSON string. */
export function serializeScene(state: {
	boards: PlacedBoard[];
	items: PlacedItem[];
}): string {
	return JSON.stringify(sceneSnapshot(state));
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
	return typeof value === "number" && Number.isFinite(value);
}

function isPlacedBoard(value: unknown): value is PlacedBoard {
	return (
		isRecord(value) &&
		typeof value.uid === "string" &&
		(value.boardRefId === null || typeof value.boardRefId === "string") &&
		isFiniteNumber(value.x) &&
		isFiniteNumber(value.y) &&
		isFiniteNumber(value.rotationDeg)
	);
}

function isPlacedItem(value: unknown): value is PlacedItem {
	return (
		isRecord(value) &&
		typeof value.uid === "string" &&
		typeof value.refId === "string" &&
		(value.kind === "pedal" || value.kind === "supply") &&
		(value.boardUid === null || typeof value.boardUid === "string") &&
		isFiniteNumber(value.x) &&
		isFiniteNumber(value.y) &&
		isFiniteNumber(value.rotationDeg) &&
		isFiniteNumber(value.z)
	);
}

/**
 * Parse a persisted snapshot, returning null for anything missing, corrupt or
 * from an unknown version (never throws). Bad entries are dropped rather than
 * failing the whole load, so one bad record can't blank the canvas.
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
	return {
		version: 1,
		boards: parsed.boards.filter(isPlacedBoard),
		items: parsed.items.filter(isPlacedItem),
	};
}

/**
 * Resolve a usable `Storage`. An explicit store (tests) is returned as-is;
 * otherwise `localStorage` is probed defensively — merely touching it throws a
 * `SecurityError` when site storage is blocked (sandboxed iframe, "block all
 * cookies"), and boot must not fail there.
 */
function resolveStorage(storage?: Storage | null): Storage | null {
	if (storage) return storage;
	try {
		return typeof localStorage === "undefined" ? null : localStorage;
	} catch {
		return null;
	}
}

/**
 * Load the persisted scene into the store (no-op when absent/invalid/unavailable).
 * Items whose owning board is missing are dropped (their board-relative position
 * can't be resolved without the board transform, and they would otherwise render
 * in neither the board nor the loose layer), and every container's z is
 * re-normalised dense so a stale/hand-edited snapshot can't break ordering.
 */
export function hydrateScene(storage?: Storage | null): void {
	const target = resolveStorage(storage);
	if (!target) return;
	let raw: string | null;
	try {
		raw = target.getItem(SCENE_STORAGE_KEY);
	} catch {
		return;
	}
	const snapshot = parseSceneSnapshot(raw);
	if (!snapshot) return;
	const boardIds = new Set(snapshot.boards.map((board) => board.uid));
	const items = normalizeAllZ(
		snapshot.items.filter(
			(item) => item.boardUid === null || boardIds.has(item.boardUid),
		),
	);
	useScene.setState({ boards: snapshot.boards, items });
}

/**
 * Mirror the scene slice to storage on every change; returns an unsubscribe.
 * Storage failures (unavailable store, quota, private mode) are non-fatal in
 * v1 — recovery is P3-02's job.
 */
export function startScenePersistence(storage?: Storage | null): () => void {
	const target = resolveStorage(storage);
	if (!target) return () => {};
	const save = (state: { boards: PlacedBoard[]; items: PlacedItem[] }) => {
		try {
			target.setItem(SCENE_STORAGE_KEY, serializeScene(state));
		} catch {
			// Ignore: temporary save only.
		}
	};
	save(useScene.getState());
	return useScene.subscribe((state, previous) => {
		if (state.boards !== previous.boards || state.items !== previous.items) {
			save(state);
		}
	});
}
