import { expect, type Page, test } from "@playwright/test";
import { activeSceneId, readSceneDocument } from "./persistence.ts";
import { addBoard, openPicker } from "./picker.ts";
import { firstItemScreenCentre } from "./stage.ts";

const INDEX_KEY = "pedalvision.scenes.v1";
const CUSTOM_CM = { widthCm: 6, heightCm: 12 };

async function waitForSavedRotation(page: Page, rotationDeg: number) {
	await expect
		.poll(async () => {
			const id = await activeSceneId(page);
			if (!id) return null;
			const document = await readSceneDocument(page, id);
			return document?.items[0]?.rotationDeg ?? null;
		})
		.toBe(rotationDeg);
}

async function placeRotatedCustomPedal(page: Page) {
	await addBoard(page, "boss-bcb-1000");
	await openPicker(page, "custom");
	await page.getByTestId("custom-name").fill("My Fuzz");
	await page.getByTestId("custom-width").fill("6");
	await page.getByTestId("custom-depth").fill("12");
	await page.getByTestId("custom-submit").click();
	await expect(page.getByTestId("stage")).toHaveAttribute("data-items", "1");
	// Selection action bar: rotate the attached custom pedal 45°.
	await page.getByTestId("rotate-item").click();
	await expect
		.poll(async () =>
			Number(
				await page.getByTestId("stage").getAttribute("data-item-rotations"),
			),
		)
		.toBe(45);
	await waitForSavedRotation(page, 45);
}

async function snapshotStage(page: Page) {
	const stage = page.getByTestId("stage");
	await expect(stage).toBeVisible();
	return {
		boards: await stage.getAttribute("data-boards"),
		rotations: await stage.getAttribute("data-rotations"),
		positions: await stage.getAttribute("data-positions"),
		items: await stage.getAttribute("data-items"),
		parents: await stage.getAttribute("data-item-parents"),
		itemPositions: await stage.getAttribute("data-item-positions"),
		itemRotations: await stage.getAttribute("data-item-rotations"),
		order: await stage.getAttribute("data-item-order"),
	};
}

async function openScenes(page: Page) {
	await page.getByTestId("scene-open").click();
	await expect(page.getByTestId("scene-panel")).toBeVisible();
}

async function closeScenes(page: Page) {
	await page.getByTestId("scene-close").click();
	await expect(page.getByTestId("scene-panel")).toHaveCount(0);
}

/** Replace the IndexedDB scene documents (raw objects, for migration tests). */
async function seedSceneDocuments(
	page: Page,
	documents: Array<Record<string, unknown>>,
): Promise<void> {
	await page.evaluate(async (docs) => {
		await new Promise<void>((resolve, reject) => {
			const request = indexedDB.open("pedalvision", 1);
			request.onerror = () => reject(request.error);
			request.onsuccess = () => {
				const tx = request.result.transaction("scenes", "readwrite");
				const store = tx.objectStore("scenes");
				store.clear();
				for (const doc of docs) store.put(doc);
				tx.oncomplete = () => resolve();
				tx.onerror = () => reject(tx.error);
			};
		});
	}, documents);
}

/** Persist the active scene + index without going through the app. */
async function seedActiveScene(
	page: Page,
	document: Record<string, unknown>,
): Promise<void> {
	const id = document.id as string;
	const name = document.name as string;
	const updatedAt = document.updatedAt as string;
	await page.evaluate(
		({ id, name, updatedAt }) => {
			localStorage.setItem(
				"pedalvision.scenes.v1",
				JSON.stringify({
					version: 1,
					scenes: [{ id, name, updatedAt, boardCount: 1, itemCount: 1 }],
				}),
			);
			localStorage.setItem(
				"pedalvision.settings.v1",
				JSON.stringify({ version: 1, units: "cm", activeSceneId: id }),
			);
		},
		{ id, name, updatedAt },
	);
}

/** Seed `count` empty scenes (for the product-cap UI state). */
async function seedSceneCount(page: Page, count: number): Promise<void> {
	await page.goto("/");
	await expect(page.getByTestId("stage")).toBeVisible();
	await page.evaluate(async (total) => {
		const now = new Date().toISOString();
		const docs = Array.from({ length: total }, (_, index) => ({
			id: `cap-${index + 1}`,
			version: 1,
			name: `Scene ${index + 1}`,
			boards: [],
			items: [],
			customPedals: [],
			updatedAt: now,
		}));
		await new Promise<void>((resolve, reject) => {
			const request = indexedDB.open("pedalvision", 1);
			request.onerror = () => reject(request.error);
			request.onsuccess = () => {
				const tx = request.result.transaction("scenes", "readwrite");
				const store = tx.objectStore("scenes");
				store.clear();
				for (const doc of docs) store.put(doc);
				tx.oncomplete = () => resolve();
				tx.onerror = () => reject(tx.error);
			};
		});
		localStorage.setItem(
			"pedalvision.scenes.v1",
			JSON.stringify({
				version: 1,
				scenes: docs.map((doc) => ({
					id: doc.id,
					name: doc.name,
					updatedAt: doc.updatedAt,
					boardCount: 0,
					itemCount: 0,
				})),
			}),
		);
		localStorage.setItem(
			"pedalvision.settings.v1",
			JSON.stringify({ version: 1, units: "cm", activeSceneId: "cap-1" }),
		);
	}, count);
	await page.reload();
	await expect(page.getByTestId("stage")).toBeVisible();
}

test("A4: save → reload → identical state (geometry, rotation, z-order, inline custom pedal)", async ({
	page,
}) => {
	await page.goto("/");
	await expect(page.getByTestId("stage")).toBeVisible();
	await placeRotatedCustomPedal(page);

	const before = await snapshotStage(page);
	expect(before.boards).toBe("1");
	expect(before.items).toBe("1");
	expect(Number(before.itemRotations)).toBe(45);

	await page.reload();
	await expect(page.getByTestId("stage")).toBeVisible();
	expect(await snapshotStage(page)).toEqual(before);

	// The inline custom pedal still resolves (name in the info panel, not a
	// fallback `custom-…` ref id).
	await page.getByTestId("stage").waitFor();
	const centre = await firstItemScreenCentre(page, CUSTOM_CM);
	await page.mouse.click(centre.x, centre.y);
	await expect(page.getByTestId("info-name")).toHaveText("My Fuzz");
});

test("a legacy graph-less document loads without loss (additive v1)", async ({
	page,
}) => {
	await page.goto("/");
	await expect(page.getByTestId("stage")).toBeVisible();
	const updatedAt = new Date().toISOString();
	const legacy = {
		id: "legacy-sheet",
		version: 1,
		name: "Legacy sheet",
		boards: [
			{
				uid: "legacy-board",
				boardRefId: "boss-bcb-1000",
				x: 0,
				y: 0,
				rotationDeg: 0,
			},
		],
		items: [
			{
				uid: "legacy-item",
				refId: "boss-bd-2-blues-driver",
				kind: "pedal",
				boardUid: "legacy-board",
				x: 1,
				y: 2,
				rotationDeg: 0,
				z: 0,
			},
		],
		// No customPedals / endpoints / cables: the oldest additive shape.
		updatedAt,
	};
	await seedSceneDocuments(page, [legacy]);
	await seedActiveScene(page, legacy);

	await page.reload();
	const stage = page.getByTestId("stage");
	await expect(stage).toBeVisible();
	await expect(stage).toHaveAttribute("data-boards", "1");
	await expect(stage).toHaveAttribute("data-items", "1");
	await expect(stage).toHaveAttribute("data-cables", "0");
	await expect(stage).toHaveAttribute("data-endpoints", "0");

	// The next write emits the current shape with the additive arrays.
	await addBoard(page, "boss-bcb-1000");
	await expect
		.poll(async () => {
			const document = await readSceneDocument(page, "legacy-sheet");
			return document
				? [
						document.version,
						Array.isArray(document.customPedals),
						Array.isArray(document.endpoints),
						Array.isArray(document.cables),
					]
				: null;
		})
		.toEqual([1, true, true, true]);
});

test("a newer-version document is preserved, not deleted (forward compatibility)", async ({
	page,
}) => {
	await page.goto("/");
	await expect(page.getByTestId("stage")).toBeVisible();
	const future = {
		id: "future-sheet",
		version: 2,
		name: "Future sheet",
		boards: [],
		items: [],
		updatedAt: new Date().toISOString(),
		// A field this build does not understand yet.
		tiers: [{ uid: "tier-1" }],
	};
	await seedSceneDocuments(page, [future]);

	await page.reload();
	await expect(page.getByTestId("stage")).toBeVisible();
	await expect(page.getByTestId("stage")).toHaveAttribute("data-boards", "0");

	// The old build cannot read it, but it must not delete or rewrite it.
	const stored = await readSceneDocument(page, "future-sheet");
	expect(stored?.version).toBe(2);
	expect(stored?.name).toBe("Future sheet");
});

test("scenes stay isolated: creating, switching and reloading restores each sheet", async ({
	page,
}) => {
	await page.goto("/");
	await expect(page.getByTestId("stage")).toBeVisible();
	await addBoard(page, "boss-bcb-1000");
	await expect(page.getByTestId("stage")).toHaveAttribute("data-boards", "1");

	// Scene 2 starts empty; the outgoing scene is flushed by the switch.
	await openScenes(page);
	await page.getByTestId("scene-new").click();
	await expect
		.poll(async () =>
			Number(await page.getByTestId("stage").getAttribute("data-boards")),
		)
		.toBe(0);
	await expect
		.poll(async () =>
			Number(await page.getByTestId("stage").getAttribute("data-items")),
		)
		.toBe(0);
	await addPedalLoose(page);
	await expect
		.poll(async () =>
			Number(await page.getByTestId("stage").getAttribute("data-items")),
		)
		.toBe(1);

	// The picker closed the register; reopen it before switching.
	await openScenes(page);
	// Switch back to sheet 1 — its board is there, the loose pedal is not.
	await page.getByRole("button", { name: /^Scene 1/ }).click();
	await expect
		.poll(async () =>
			Number(await page.getByTestId("stage").getAttribute("data-boards")),
		)
		.toBe(1);
	await expect
		.poll(async () =>
			Number(await page.getByTestId("stage").getAttribute("data-items")),
		)
		.toBe(0);

	// Reload keeps the active sheet; the other sheet is still available.
	await page.reload();
	await expect(page.getByTestId("stage")).toHaveAttribute("data-boards", "1");
	await openScenes(page);
	await page.getByRole("button", { name: /^Scene 2/ }).click();
	await closeScenes(page);
	await expect
		.poll(async () =>
			Number(await page.getByTestId("stage").getAttribute("data-items")),
		)
		.toBe(1);
});

async function addPedalLoose(page: Page) {
	await openPicker(page, "pedals");
	await page.getByTestId("add-pedal-boss-bd-2-blues-driver").click();
	await expect(page.getByTestId("picker-panel")).toHaveCount(0);
}

test("renaming a scene persists across reloads", async ({ page }) => {
	await page.goto("/");
	await expect(page.getByTestId("stage")).toBeVisible();
	await openScenes(page);
	await page.getByRole("button", { name: "Rename Scene 1" }).click();
	const input = page.getByLabel("Scene name");
	await expect(input).toBeFocused();
	await input.fill("Verse rig");
	await input.press("Enter");
	await expect(page.getByTestId("scene-open")).toContainText("Verse rig");
	await expect
		.poll(async () => {
			const id = await activeSceneId(page);
			if (!id) return null;
			const doc = await readSceneDocument(page, id);
			return doc?.name ?? null;
		})
		.toBe("Verse rig");

	await page.reload();
	await expect(page.getByTestId("scene-open")).toContainText("Verse rig");
	await expect
		.poll(() =>
			page.evaluate(
				(key) =>
					JSON.parse(localStorage.getItem(key) ?? "null")?.scenes?.[0]?.name,
				INDEX_KEY,
			),
		)
		.toBe("Verse rig");
});

test("deleting a scene persists and keeps at least one sheet", async ({
	page,
}) => {
	await page.goto("/");
	await expect(page.getByTestId("stage")).toBeVisible();
	await openScenes(page);
	// The only sheet cannot be deleted.
	await expect(
		page.getByRole("button", { name: "Delete Scene 1" }),
	).toBeDisabled();

	await page.getByTestId("scene-new").click();
	await expect(page.getByRole("button", { name: /^Scene 2/ })).toBeVisible();
	await page.getByRole("button", { name: "Delete Scene 2" }).click();
	await expect(page.getByTestId("scene-delete-confirm")).toBeVisible();
	await page.getByTestId("scene-delete-confirm-button").click();
	await expect(page.getByTestId("scene-delete-confirm")).toHaveCount(0);
	await expect
		.poll(() =>
			page.evaluate(
				(key) =>
					(
						JSON.parse(localStorage.getItem(key) ?? "null") as {
							scenes?: unknown[];
						}
					)?.scenes?.length ?? 0,
				INDEX_KEY,
			),
		)
		.toBe(1);

	await page.reload();
	await expect(page.getByTestId("stage")).toBeVisible();
	await openScenes(page);
	await expect(page.getByRole("button", { name: /^Scene 2/ })).toHaveCount(0);
	await expect(page.getByRole("button", { name: /^Scene 1/ })).toBeVisible();
});

test("the product cap disables New scene at 10 sheets", async ({ page }) => {
	await seedSceneCount(page, 10);
	await openScenes(page);
	await expect(page.getByTestId("scene-new")).toBeDisabled();
	await expect(page.getByTestId("scene-limit")).toContainText(
		"Scene limit reached",
	);
	await expect(page.getByRole("button", { name: /^Scene 10/ })).toBeVisible();
});

test("boot reconcile drops stale index entries and surfaces orphan documents", async ({
	page,
}) => {
	await page.goto("/");
	await expect(page.getByTestId("stage")).toBeVisible();
	await openScenes(page);
	await page.getByTestId("scene-new").click();
	await closeScenes(page);

	// Evict sheet 1's document but leave its localStorage index entry.
	const sceneOneId = await page.evaluate((key) => {
		const index = JSON.parse(localStorage.getItem(key) ?? "null") as {
			scenes?: Array<{ id: string; name: string }>;
		};
		return index.scenes?.find((scene) => scene.name === "Scene 1")?.id ?? null;
	}, INDEX_KEY);
	expect(sceneOneId).not.toBeNull();
	await page.evaluate(async (id) => {
		await new Promise<void>((resolve, reject) => {
			const request = indexedDB.open("pedalvision", 1);
			request.onerror = () => reject(request.error);
			request.onsuccess = () => {
				const db = request.result;
				const tx = db.transaction("scenes", "readwrite");
				tx.objectStore("scenes").delete(id as string);
				tx.oncomplete = () => resolve();
				tx.onerror = () => reject(tx.error);
			};
		});
	}, sceneOneId);

	// Seed an orphan document with no index entry.
	await page.evaluate(async () => {
		await new Promise<void>((resolve, reject) => {
			const request = indexedDB.open("pedalvision", 1);
			request.onerror = () => reject(request.error);
			request.onsuccess = () => {
				const db = request.result;
				const tx = db.transaction("scenes", "readwrite");
				tx.objectStore("scenes").put({
					id: "orphan-sheet",
					version: 1,
					name: "Recovered sheet",
					boards: [],
					items: [],
					customPedals: [],
					updatedAt: new Date().toISOString(),
				});
				tx.oncomplete = () => resolve();
				tx.onerror = () => reject(tx.error);
			};
		});
	});

	await page.reload();
	await expect(page.getByTestId("stage")).toBeVisible();
	await openScenes(page);
	await expect(
		page.getByRole("button", { name: /^Recovered sheet/ }),
	).toBeVisible();
	await expect(page.getByRole("button", { name: /^Scene 1/ })).toHaveCount(0);
	await expect(page.getByRole("button", { name: /^Scene 2/ })).toBeVisible();
});
