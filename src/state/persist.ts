import type { PlacedBoard, PlacedItem } from "./scene";
import { useScene } from "./scene";

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

/** Load the persisted scene into the store (no-op when absent/invalid). */
export function hydrateScene(storage: Storage = localStorage): void {
	const snapshot = parseSceneSnapshot(storage.getItem(SCENE_STORAGE_KEY));
	if (!snapshot) return;
	useScene.setState({ boards: snapshot.boards, items: snapshot.items });
}

/**
 * Mirror the scene slice to storage on every change; returns an unsubscribe.
 * Storage failures (quota, private mode) are non-fatal in v1 — recovery is
 * P3-02's job.
 */
export function startScenePersistence(
	storage: Storage = localStorage,
): () => void {
	const save = (state: { boards: PlacedBoard[]; items: PlacedItem[] }) => {
		try {
			storage.setItem(SCENE_STORAGE_KEY, serializeScene(state));
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
