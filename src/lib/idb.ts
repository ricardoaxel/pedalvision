import { type DBSchema, type IDBPDatabase, openDB } from "idb";
import type { SceneDocument } from "../state/sceneDocument";

/**
 * Thin IndexedDB layer for scene documents (design.md §Persistence). The
 * library store talks to this interface, so unit tests can inject an in-memory
 * repository instead of requiring a browser IndexedDB.
 */
const DB_NAME = "pedalvision";
const DB_VERSION = 1;
const STORE = "scenes";

interface PedalvisionDb extends DBSchema {
	scenes: {
		key: string;
		value: SceneDocument;
	};
}

export interface SceneRepository {
	/** Every stored document (used by the boot reconcile). */
	all(): Promise<SceneDocument[]>;
	get(id: string): Promise<SceneDocument | undefined>;
	put(document: SceneDocument): Promise<void>;
	remove(id: string): Promise<void>;
	close(): void;
}

/**
 * Open the scene database. Rejects when IndexedDB is unavailable/blocked
 * (private mode, disabled site data); callers fail soft and the app keeps
 * working in memory (the user-facing warning is P3-05).
 */
export async function openSceneRepository(): Promise<SceneRepository> {
	const database: IDBPDatabase<PedalvisionDb> = await openDB<PedalvisionDb>(
		DB_NAME,
		DB_VERSION,
		{
			upgrade(db) {
				if (!db.objectStoreNames.contains(STORE)) {
					db.createObjectStore(STORE, { keyPath: "id" });
				}
			},
		},
	);
	return {
		all: () => database.getAll(STORE),
		get: (id) => database.get(STORE, id),
		put: async (document) => {
			await database.put(STORE, document);
		},
		remove: async (id) => {
			await database.delete(STORE, id);
		},
		close: () => database.close(),
	};
}
