import { EFFECT_TYPES, JACK_EDGES, JACK_KINDS } from "../catalog/schema";
import { isBoardTexture } from "../lib/boardTexture";
import { MAX_BOARD_DIMENSION_CM } from "../lib/customBoard";
import { resolveStorage } from "../lib/storage";
import type { CustomPedal, PlacedBoard, PlacedItem } from "./scene";
import { normalizeAllZ, pruneCustomPedals, useScene } from "./scene";

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
	/** Inline custom pedals (P2-02) travel with the scene (A5). */
	customPedals: CustomPedal[];
}

/** A snapshot of the store's persisted fields. */
export function sceneSnapshot(state: {
	boards: PlacedBoard[];
	items: PlacedItem[];
	customPedals: CustomPedal[];
}): SceneSnapshot {
	return {
		version: 1,
		boards: state.boards,
		items: state.items,
		customPedals: state.customPedals,
	};
}

/** Serialise the persisted fields to a JSON string. */
export function serializeScene(state: {
	boards: PlacedBoard[];
	items: PlacedItem[];
	customPedals: CustomPedal[];
}): string {
	return JSON.stringify(sceneSnapshot(state));
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
	return typeof value === "number" && Number.isFinite(value);
}

function isSize(value: unknown): boolean {
	return (
		isRecord(value) &&
		isFiniteNumber(value.widthCm) &&
		value.widthCm > 0 &&
		value.widthCm <= MAX_BOARD_DIMENSION_CM &&
		isFiniteNumber(value.heightCm) &&
		value.heightCm > 0 &&
		value.heightCm <= MAX_BOARD_DIMENSION_CM
	);
}

function isPlacedBoard(value: unknown): value is PlacedBoard {
	if (!isRecord(value)) return false;
	if (typeof value.uid !== "string") return false;
	if (value.boardRefId !== null && typeof value.boardRefId !== "string") {
		return false;
	}
	// The inline-definition invariant: a custom board (no ref) MUST carry a
	// bounded customSize, and a catalog board must NOT carry one (boardFootprint
	// would otherwise stretch the catalog image to the stray size).
	if (value.boardRefId === null) {
		if (!isSize(value.customSize)) return false;
	} else if (value.customSize !== undefined) {
		return false;
	}
	return (
		(value.texture === undefined || isBoardTexture(value.texture)) &&
		(value.name === undefined || typeof value.name === "string") &&
		(value.brand === undefined || typeof value.brand === "string") &&
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

function isJack(value: unknown): boolean {
	return (
		isRecord(value) &&
		typeof value.kind === "string" &&
		(JACK_KINDS as readonly string[]).includes(value.kind) &&
		typeof value.edge === "string" &&
		(JACK_EDGES as readonly string[]).includes(value.edge) &&
		isFiniteNumber(value.pos) &&
		value.pos >= 0 &&
		value.pos <= 1
	);
}

function isPower(value: unknown): boolean {
	return (
		isRecord(value) &&
		isFiniteNumber(value.voltage) &&
		(value.acDc === "DC" || value.acDc === "AC") &&
		isFiniteNumber(value.currentMa)
	);
}

/** Structural check so a corrupt inline custom pedal can't reach the renderer. */
function isCustomPedal(value: unknown): value is CustomPedal {
	return (
		isRecord(value) &&
		typeof value.refId === "string" &&
		typeof value.brand === "string" &&
		typeof value.name === "string" &&
		isFiniteNumber(value.widthCm) &&
		value.widthCm > 0 &&
		isFiniteNumber(value.heightCm) &&
		value.heightCm > 0 &&
		(value.category === "pedal" || value.category === "supply") &&
		Array.isArray(value.effectTypes) &&
		value.effectTypes.every(
			(type) =>
				typeof type === "string" &&
				(EFFECT_TYPES as readonly string[]).includes(type),
		) &&
		(value.jacks === undefined ||
			(Array.isArray(value.jacks) && value.jacks.every(isJack))) &&
		(value.power === undefined || isPower(value.power))
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
	// `customPedals` is additive (P2-02): an older snapshot without it is valid.
	const customPedals = Array.isArray(parsed.customPedals)
		? parsed.customPedals.filter(isCustomPedal)
		: [];
	return {
		version: 1,
		boards: parsed.boards.filter(isPlacedBoard),
		items: parsed.items.filter(isPlacedItem),
		customPedals,
	};
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
	useScene.setState({
		boards: snapshot.boards,
		items,
		// A snapshot whose item referenced a dropped (orphan) item can leave a
		// custom definition unreferenced — prune it like `removeItem` does.
		customPedals: pruneCustomPedals(snapshot.customPedals, items),
	});
}

/**
 * Mirror the scene slice to storage on every change; returns an unsubscribe.
 * Storage failures (unavailable store, quota, private mode) are non-fatal in
 * v1 — recovery is P3-02's job.
 */
export function startScenePersistence(storage?: Storage | null): () => void {
	const target = resolveStorage(storage);
	if (!target) return () => {};
	const save = (state: {
		boards: PlacedBoard[];
		items: PlacedItem[];
		customPedals: CustomPedal[];
	}) => {
		try {
			target.setItem(SCENE_STORAGE_KEY, serializeScene(state));
		} catch {
			// Ignore: temporary save only.
		}
	};
	// No initial save: only mirror real changes, so booting an older build can't
	// overwrite a newer (unparsed) payload with the empty starting store.
	return useScene.subscribe((state, previous) => {
		if (
			state.boards !== previous.boards ||
			state.items !== previous.items ||
			state.customPedals !== previous.customPedals
		) {
			save(state);
		}
	});
}
