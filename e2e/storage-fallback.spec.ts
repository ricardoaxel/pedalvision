import { readFile } from "node:fs/promises";
import { expect, type Page, test } from "@playwright/test";
import { activeSceneId, readSceneDocument } from "./persistence.ts";
import { addBoard, addPedal } from "./picker.ts";
import { board, item, shareHash } from "./share.ts";

const warning = (page: Page) => page.getByTestId("storage-note");
const stage = (page: Page) => page.getByTestId("stage");

/** P3-05 injection: IndexedDB is blocked from the first script onward. */
async function blockIndexedDb(page: Page): Promise<void> {
	await page.addInitScript(() => {
		Object.defineProperty(window, "indexedDB", {
			configurable: true,
			get: () => undefined,
		});
	});
}

/** P3-05 injection: no usable storage estimate (must never warn). */
async function makeEstimateUnavailable(page: Page): Promise<void> {
	await page.addInitScript(() => {
		if (!navigator.storage) return;
		Object.defineProperty(navigator.storage, "estimate", {
			configurable: true,
			value: () => Promise.reject(new Error("estimate unavailable")),
		});
	});
}

/** P3-05 injection: a deterministic low-quota estimate (95 of 100 bytes). */
async function makeLowQuota(page: Page): Promise<void> {
	await page.addInitScript(() => {
		if (!navigator.storage) return;
		Object.defineProperty(navigator.storage, "estimate", {
			configurable: true,
			value: () => Promise.resolve({ usage: 95, quota: 100 }),
		});
	});
}

async function downloadBackup(page: Page) {
	const [download] = await Promise.all([
		page.waitForEvent("download"),
		page.getByTestId("storage-backup").click(),
	]);
	const path = await download.path();
	expect(path).not.toBeNull();
	const json = JSON.parse(await readFile(path as string, "utf8"));
	return { download, json };
}

test("blocked IndexedDB: the app stays editable, warns, and exports a backup", async ({
	page,
}) => {
	await blockIndexedDb(page);
	await page.goto("/");
	await expect(stage(page)).toBeVisible();

	await expect(warning(page)).toBeVisible();
	await expect(warning(page)).toHaveAttribute("data-state", "unavailable");
	await expect(warning(page)).toHaveAttribute("data-reason", "indexeddb");
	await expect(warning(page)).toContainText("Storage is blocked");
	// One notice at a time: the first-run Bench Note yields to the warning.
	await expect(page.getByTestId("first-run-hint")).toHaveCount(0);

	// The canvas is fully usable in memory (session-only).
	await addBoard(page, "boss-bcb-1000");
	await addPedal(page, "boss-bd-2-blues-driver");
	await expect(stage(page)).toHaveAttribute("data-boards", "1");
	await expect(stage(page)).toHaveAttribute("data-items", "1");

	const { download, json } = await downloadBackup(page);
	expect(download.suggestedFilename()).toMatch(/\.json$/);
	expect(json.version).toBe(1);
	expect(json.name).toBe("Untitled scene");
	expect(json.boards).toHaveLength(1);
	expect(json.items).toHaveLength(1);
	await expect(page.getByTestId("storage-receipt")).toContainText("Downloaded");

	// Nothing was persisted: a reload still shows the warning and an empty sheet.
	await page.reload();
	await expect(stage(page)).toBeVisible();
	await expect(warning(page)).toHaveAttribute("data-state", "unavailable");
	await expect(stage(page)).toHaveAttribute("data-boards", "0");
});

test("mid-session write failure warns and keeps the work in memory", async ({
	page,
}) => {
	await page.goto("/");
	await expect(stage(page)).toBeVisible();
	await expect(warning(page)).toHaveCount(0);

	// P3-05 injection: the next IndexedDB write throws (quota/eviction).
	await page.evaluate(() => {
		IDBObjectStore.prototype.put = () => {
			throw new DOMException("quota exceeded", "QuotaExceededError");
		};
	});

	await addBoard(page, "boss-bcb-1000");
	await addPedal(page, "boss-bd-2-blues-driver");
	await expect(warning(page)).toBeVisible();
	await expect(warning(page)).toHaveAttribute("data-state", "unavailable");
	await expect(warning(page)).toHaveAttribute("data-reason", "write");
	await expect(warning(page)).toContainText("last save didn’t go through");
	await expect(stage(page)).toHaveAttribute("data-boards", "1");
	await expect(stage(page)).toHaveAttribute("data-items", "1");

	const { json } = await downloadBackup(page);
	// Built from the live in-memory scene, not the last stored document.
	expect(json.boards).toHaveLength(1);
	expect(json.items).toHaveLength(1);
});

test("an unavailable quota estimate does not warn", async ({ page }) => {
	await makeEstimateUnavailable(page);
	await page.goto("/");
	await expect(stage(page)).toBeVisible();
	await expect(warning(page)).toHaveCount(0);
});

test("a hanging quota estimate never blocks boot or warns", async ({
	page,
}) => {
	await page.addInitScript(() => {
		if (!navigator.storage) return;
		Object.defineProperty(navigator.storage, "estimate", {
			configurable: true,
			value: () => new Promise(() => undefined),
		});
	});
	await page.goto("/");
	await expect(stage(page)).toBeVisible();
	await expect(warning(page)).toHaveCount(0);
});

test("normal storage shows no warning and saves normally", async ({ page }) => {
	await page.goto("/");
	await expect(stage(page)).toBeVisible();
	await expect(warning(page)).toHaveCount(0);
	await addBoard(page, "boss-bcb-1000");
	await expect
		.poll(async () => {
			const id = await activeSceneId(page);
			if (!id) return null;
			const document = await readSceneDocument(page, id);
			return document?.boards.length ?? null;
		})
		.toBe(1);
});

test("low quota is an advisory, not a block, and is dismissible", async ({
	page,
}) => {
	await makeLowQuota(page);
	await page.goto("/");
	await expect(stage(page)).toBeVisible();
	await expect(warning(page)).toBeVisible();
	await expect(warning(page)).toHaveAttribute("data-state", "low-quota");
	await expect(warning(page)).toContainText("about 95% full");
	await expect(warning(page)).toContainText("Saving still works");

	// Saving is unaffected.
	await addBoard(page, "boss-bcb-1000");
	await expect
		.poll(async () => {
			const id = await activeSceneId(page);
			if (!id) return null;
			const document = await readSceneDocument(page, id);
			return document?.boards.length ?? null;
		})
		.toBe(1);

	await page.getByTestId("storage-dismiss").click();
	await expect(warning(page)).toHaveCount(0);
});

test("a read-only share hides the storage warning and backup", async ({
	page,
}) => {
	await blockIndexedDb(page);
	const hash = shareHash({
		boards: [board("shared-board")],
		items: [item("shared-item", { boardUid: "shared-board" })],
	});
	await page.goto(`/?share=1${hash}`);
	await expect(page.getByTestId("share-stamp")).toBeVisible();
	await expect(stage(page)).toHaveAttribute("data-boards", "1");
	await expect(warning(page)).toHaveCount(0);
	await expect(page.getByTestId("storage-backup")).toHaveCount(0);
});
