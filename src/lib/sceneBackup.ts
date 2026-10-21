import {
	createSceneDocument,
	type SceneDocument,
	type SceneSnapshot,
} from "../state/sceneDocument";
import { downloadBlob } from "./download";

/**
 * Storage-failure escape hatch (P3-05): serialise the **live** in-memory scene
 * as a versioned `SceneDocument` v1 — the same shape IndexedDB stores — so a
 * user can keep their work when the browser refuses to save it. There is no
 * import/restore UI in v1; this is a one-way backup.
 */
export interface SceneBackupInput {
	id: string;
	name: string;
	snapshot: SceneSnapshot;
	now: Date;
}

export interface SceneBackup {
	document: SceneDocument;
	json: string;
	filename: string;
}

const NAME_MAX = 48;
const FALLBACK_NAME = "pedalvision-scene";

function pad(value: number): string {
	return String(value).padStart(2, "0");
}

/** Safe cross-platform stem + `YYYY-MM-DD` (local date, not UTC). */
export function backupFileName(name: string, now: Date): string {
	const stem =
		name
			.normalize("NFKD")
			.replace(/[\u0300-\u036f]/g, "")
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "")
			.slice(0, NAME_MAX)
			.replace(/-+$/g, "") || FALLBACK_NAME;
	const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
		now.getDate(),
	)}`;
	return `${stem}-${date}.json`;
}

/**
 * Build the backup from the scene fields passed at click time (never a stale
 * stored document). Pure: nothing is written to the scene, index or settings.
 */
export function buildSceneBackup(input: SceneBackupInput): SceneBackup {
	// The live snapshot is passed whole, so every persisted field (boards,
	// items, custom pedals, endpoints, cables) inherits the codec wiring.
	const document = createSceneDocument({
		id: input.id,
		name: input.name,
		...input.snapshot,
		updatedAt: input.now.toISOString(),
	});
	// Compact JSON: this is a machine backup with no import UI, and it keeps
	// the at-risk download under ~0.4 MB at the measured worst case.
	return {
		document,
		json: JSON.stringify(document),
		filename: backupFileName(input.name, input.now),
	};
}

/** Trigger the browser download for a built backup. */
export function downloadSceneBackup(backup: SceneBackup): void {
	downloadBlob(
		new Blob([backup.json], { type: "application/json" }),
		backup.filename,
	);
}
