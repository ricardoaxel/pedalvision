import type { DisplayUnits } from "./geometry";
import { resolveStorage } from "./storage";

/**
 * The scene index + settings live in `localStorage`; scene documents live in
 * IndexedDB (design.md §Persistence). The two stores can be evicted
 * independently, hence the boot-time reconcile.
 */
export const SCENE_INDEX_KEY = "pedalvision.scenes.v1";
export const SETTINGS_KEY = "pedalvision.settings.v1";
/** The P1-06 temporary single-scene mirror, migrated once on first boot. */
export const LEGACY_SCENE_KEY = "pedalvision.scene.v1";

export interface SceneIndexEntry {
	id: string;
	name: string;
	updatedAt: string;
	/** Cached counts for the register meta (optional on older indexes). */
	boardCount?: number;
	itemCount?: number;
}

export interface SceneIndex {
	version: 1;
	scenes: SceneIndexEntry[];
}

export interface SceneSettings {
	version: 1;
	units: DisplayUnits;
	activeSceneId: string | null;
	/** Canvas view preference: show cables, jack ticks and endpoints. */
	showCables: boolean;
}

/** The smallest document shape the reconcile needs. */
export interface SceneMeta {
	id: string;
	name: string;
	updatedAt: string;
	boardCount?: number;
	itemCount?: number;
}

export interface ReconcileResult {
	index: SceneIndexEntry[];
	dropped: string[];
	added: string[];
	changed: boolean;
}

export const DEFAULT_SETTINGS: SceneSettings = {
	version: 1,
	units: "cm",
	activeSceneId: null,
	showCables: true,
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function readRaw(storage: Storage | null, key: string): string | null {
	if (!storage) return null;
	try {
		return storage.getItem(key);
	} catch {
		return null;
	}
}

function writeRaw(
	storage: Storage | null,
	key: string,
	value: string,
): boolean {
	if (!storage) return false;
	try {
		storage.setItem(key, value);
		return true;
	} catch {
		return false;
	}
}

function isCount(value: unknown): value is number {
	return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isEntry(value: unknown): value is SceneIndexEntry {
	return (
		isRecord(value) &&
		typeof value.id === "string" &&
		value.id.length > 0 &&
		typeof value.name === "string" &&
		typeof value.updatedAt === "string" &&
		(value.boardCount === undefined || isCount(value.boardCount)) &&
		(value.itemCount === undefined || isCount(value.itemCount))
	);
}

/** Parse the scene index, returning an empty index for any corrupt payload. */
export function parseSceneIndex(raw: string | null): SceneIndex {
	if (!raw) return { version: 1, scenes: [] };
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return { version: 1, scenes: [] };
	}
	if (!isRecord(parsed) || parsed.version !== 1) {
		return { version: 1, scenes: [] };
	}
	if (!Array.isArray(parsed.scenes)) return { version: 1, scenes: [] };
	const seen = new Set<string>();
	const scenes = parsed.scenes.filter((entry): entry is SceneIndexEntry => {
		if (!isEntry(entry) || seen.has(entry.id)) return false;
		seen.add(entry.id);
		return true;
	});
	return { version: 1, scenes };
}

/** Read the scene index from storage (fail-soft → empty). */
export function readSceneIndex(storage?: Storage | null): SceneIndex {
	return parseSceneIndex(readRaw(resolveStorage(storage), SCENE_INDEX_KEY));
}

/** Persist the scene index; returns false when storage is unavailable/blocked. */
export function writeSceneIndex(
	index: SceneIndex,
	storage?: Storage | null,
): boolean {
	return writeRaw(
		resolveStorage(storage),
		SCENE_INDEX_KEY,
		JSON.stringify(index),
	);
}

/** Parse settings, falling back to defaults for corrupt/unknown payloads. */
export function parseSettings(raw: string | null): SceneSettings {
	if (!raw) return { ...DEFAULT_SETTINGS };
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return { ...DEFAULT_SETTINGS };
	}
	if (!isRecord(parsed) || parsed.version !== 1) {
		return { ...DEFAULT_SETTINGS };
	}
	return {
		version: 1,
		units: parsed.units === "in" ? "in" : "cm",
		activeSceneId:
			typeof parsed.activeSceneId === "string" ? parsed.activeSceneId : null,
		// Absent = old setting / default visible.
		showCables: parsed.showCables !== false,
	};
}

/** Read settings from storage (fail-soft → defaults). */
export function readSettings(storage?: Storage | null): SceneSettings {
	return parseSettings(readRaw(resolveStorage(storage), SETTINGS_KEY));
}

/**
 * Merge a patch into the stored settings. The caller may hold a `Storage`
 * instance (tests) or omit it (browser `localStorage`). Returns false when the
 * write is unavailable.
 */
export function writeSettings(
	patch: Partial<Pick<SceneSettings, "units" | "activeSceneId" | "showCables">>,
	storage?: Storage | null,
): boolean {
	const target = resolveStorage(storage);
	const next: SceneSettings = { ...readSettings(target), ...patch, version: 1 };
	return writeRaw(target, SETTINGS_KEY, JSON.stringify(next));
}

function sameEntry(a: SceneIndexEntry, b: SceneIndexEntry): boolean {
	return (
		a.id === b.id &&
		a.name === b.name &&
		a.updatedAt === b.updatedAt &&
		a.boardCount === b.boardCount &&
		a.itemCount === b.itemCount
	);
}

function byUpdatedDesc(a: SceneMeta, b: SceneMeta): number {
	const delta = Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
	if (Number.isFinite(delta) && delta !== 0) return delta;
	return a.id.localeCompare(b.id);
}

/**
 * Reconcile the `localStorage` index against the documents actually present in
 * IndexedDB (R6/S2):
 * - index entries whose document is gone are **dropped**;
 * - documents missing from the index are **surfaced** (appended newest-first);
 * - surviving entries take the document's canonical name/updatedAt.
 *
 * Idempotent: reconciling an already-consistent index returns `changed: false`.
 */
export function reconcileIndex(
	entries: SceneIndexEntry[],
	documents: SceneMeta[],
): ReconcileResult {
	const docsById = new Map<string, SceneMeta>();
	for (const doc of documents) {
		// Last write wins if the caller somehow passes duplicate ids.
		docsById.set(doc.id, doc);
	}
	const dropped: string[] = [];
	const kept: SceneIndexEntry[] = [];
	const indexed = new Set<string>();
	for (const entry of entries) {
		const doc = docsById.get(entry.id);
		if (!doc) {
			dropped.push(entry.id);
			continue;
		}
		indexed.add(entry.id);
		kept.push({
			id: doc.id,
			name: doc.name,
			updatedAt: doc.updatedAt,
			boardCount: doc.boardCount,
			itemCount: doc.itemCount,
		});
	}
	const orphans = documents
		.filter((doc) => !indexed.has(doc.id))
		.sort(byUpdatedDesc)
		.map((doc) => ({
			id: doc.id,
			name: doc.name,
			updatedAt: doc.updatedAt,
			boardCount: doc.boardCount,
			itemCount: doc.itemCount,
		}));
	const index = [...kept, ...orphans];
	const changed =
		index.length !== entries.length ||
		index.some((entry, position) => !sameEntry(entry, entries[position]));
	return { index, dropped, added: orphans.map((entry) => entry.id), changed };
}

/** First unused `Scene N` name (default names for new scenes). */
export function nextSceneName(entries: SceneIndexEntry[]): string {
	const used = new Set(entries.map((entry) => entry.name));
	for (let n = 1; ; n++) {
		const name = `Scene ${n}`;
		if (!used.has(name)) return name;
	}
}
