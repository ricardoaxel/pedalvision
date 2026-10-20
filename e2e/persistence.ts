import { expect, type Page } from "@playwright/test";

/** The persisted fields a test cares about (IndexedDB scene document). */
export interface SavedDocument {
	id: string;
	name: string;
	boards: Array<{ uid: string }>;
	items: Array<{
		uid: string;
		z?: number;
		refId?: string;
		rotationDeg?: number;
		boardUid?: string | null;
	}>;
	customPedals: unknown[];
	updatedAt: string;
}

/** The active scene id from the persisted settings. */
export async function activeSceneId(page: Page): Promise<string | null> {
	return page.evaluate(() => {
		const raw = localStorage.getItem("pedalvision.settings.v1");
		if (!raw) return null;
		const parsed = JSON.parse(raw) as { activeSceneId?: unknown };
		return typeof parsed.activeSceneId === "string"
			? parsed.activeSceneId
			: null;
	});
}

/** Read a scene document straight from IndexedDB (the persisted truth). */
export async function readSceneDocument(
	page: Page,
	id: string,
): Promise<SavedDocument | null> {
	return page.evaluate(
		(id) =>
			new Promise<SavedDocument | null>((resolve, reject) => {
				const request = indexedDB.open("pedalvision", 1);
				request.onerror = () => reject(request.error);
				request.onsuccess = () => {
					const db = request.result;
					const tx = db.transaction("scenes", "readonly");
					const get = tx.objectStore("scenes").get(id);
					get.onsuccess = () => resolve((get.result as SavedDocument) ?? null);
					get.onerror = () => reject(get.error);
				};
			}),
		id,
	);
}

/**
 * P3-02 autosave is debounced (~500 ms), so a reload right after a mutation can
 * race the write. Poll the active document until it reflects the change.
 */
export async function waitForSavedScene(
	page: Page,
	check: (document: SavedDocument) => boolean,
): Promise<void> {
	await expect
		.poll(async () => {
			const id = await activeSceneId(page);
			if (!id) return false;
			const document = await readSceneDocument(page, id);
			return document !== null && check(document);
		})
		.toBe(true);
}
