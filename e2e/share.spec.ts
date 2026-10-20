import { expect, type Page, test } from "@playwright/test";
import { activeSceneId, readSceneDocument } from "./persistence.ts";
import { addBoard, addPedal, openPicker } from "./picker.ts";
import { board, item, shareHash } from "./share.ts";
import { firstItemScreenCentre } from "./stage.ts";

const CUSTOM_CM = { widthCm: 6, heightCm: 12 };

async function openScenes(page: Page) {
	await page.getByTestId("scene-open").click();
	await expect(page.getByTestId("scene-panel")).toBeVisible();
}

async function closeScenes(page: Page) {
	await page.getByTestId("scene-close").click();
	await expect(page.getByTestId("scene-panel")).toHaveCount(0);
}

async function currentSceneName(page: Page): Promise<string> {
	return (
		(await page.locator(".scene-trigger__name").textContent())?.trim() ?? ""
	);
}

/** Force a full document load even when only the hash would change. */
async function openShare(page: Page, hash: string) {
	await page.goto(`/?share=1${hash}`);
}

async function waitForSavedItems(page: Page, count: number) {
	await expect
		.poll(async () => {
			const id = await activeSceneId(page);
			if (!id) return null;
			const document = await readSceneDocument(page, id);
			return document?.items.length ?? null;
		})
		.toBe(count);
}

async function renameActiveScene(page: Page, from: string, to: string) {
	await openScenes(page);
	await page.getByRole("button", { name: `Rename ${from}` }).click();
	const input = page.getByLabel("Scene name");
	await expect(input).toBeFocused();
	await input.fill(to);
	await input.press("Enter");
	await expect(page.getByTestId("scene-open")).toContainText(to);
	await closeScenes(page);
}

async function newScene(page: Page) {
	await openScenes(page);
	await page.getByTestId("scene-new").click();
	await expect
		.poll(async () =>
			Number(await page.getByTestId("stage").getAttribute("data-boards")),
		)
		.toBe(0);
	await closeScenes(page);
}

async function switchScene(page: Page, name: string) {
	await openScenes(page);
	await page
		.locator("[data-scene-open]")
		.filter({ hasText: name })
		.first()
		.click();
	await expect(page.getByTestId("scene-open")).toContainText(name);
	await closeScenes(page);
}

async function stageSnapshot(page: Page) {
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

async function placeRotatedCustomPedal(page: Page) {
	await addBoard(page, "boss-bcb-1000");
	await openPicker(page, "custom");
	await page.getByTestId("custom-name").fill("Shared Fuzz");
	await page.getByTestId("custom-width").fill("6");
	await page.getByTestId("custom-depth").fill("12");
	await page.getByTestId("custom-submit").click();
	await expect(page.getByTestId("stage")).toHaveAttribute("data-items", "1");
	await page.getByTestId("rotate-item").click();
	await expect
		.poll(async () =>
			Number(
				await page.getByTestId("stage").getAttribute("data-item-rotations"),
			),
		)
		.toBe(45);
}

async function boardCenter(page: Page): Promise<{ x: number; y: number }> {
	const stage = page.getByTestId("stage");
	const box = await stage.boundingBox();
	if (!box) throw new Error("stage has no bounding box");
	const scale = Number(await stage.getAttribute("data-scale")) || 1;
	const vx = Number(await stage.getAttribute("data-x")) || 0;
	const vy = Number(await stage.getAttribute("data-y")) || 0;
	const [bx, by] = ((await stage.getAttribute("data-positions")) ?? "")
		.split(";")[0]
		.split(",")
		.map(Number);
	const [w, h] = ((await stage.getAttribute("data-board-sizes")) ?? "")
		.split(",")[0]
		.split("x")
		.map(Number);
	return {
		x: box.x + (bx + w / 2) * 4 * scale + vx,
		y: box.y + (by + h / 2) * 4 * scale + vy,
	};
}

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

test("share → read-only → save a copy never overwrites the recipient's scene", async ({
	page,
}) => {
	await page.goto("/");
	await expect(page.getByTestId("stage")).toBeVisible();

	// Sender scene: board + rotated inline custom pedal.
	await placeRotatedCustomPedal(page);
	const sender = await stageSnapshot(page);
	await renameActiveScene(page, "Scene 1", "Sender board");

	// Generate the link, then leave the sender scene.
	await page.getByTestId("share-open").click();
	await expect(page.getByTestId("share-panel")).toBeVisible();
	const link = await page.getByTestId("share-link").inputValue();
	expect(link).toContain("#s=v1:");
	await page.getByTestId("share-close").click();
	await expect(page.getByTestId("share-panel")).toHaveCount(0);

	// The recipient has their own scene with a board but no parts.
	await newScene(page);
	await addBoard(page, "boss-bcb-1000");
	await renameActiveScene(page, await currentSceneName(page), "Mine");

	// Open the shared link in the recipient's session.
	const hash = new URL(link).hash;
	await openShare(page, hash);
	await expect(page.getByTestId("share-stamp")).toBeVisible();
	await expect(page.getByTestId("share-name")).toHaveText("Sender board");
	expect(await stageSnapshot(page)).toEqual(sender);

	// Read-only: no editing chrome, and keyboard/board-drag cannot mutate.
	await expect(page.getByTestId("picker-open")).toHaveCount(0);
	await expect(page.getByTestId("scene-open")).toHaveCount(0);
	await expect(page.getByTestId("share-save-copy")).toBeVisible();
	const centre = await firstItemScreenCentre(page, CUSTOM_CM);
	await page.mouse.click(centre.x, centre.y);
	await page.keyboard.press("Delete");
	await expect(page.getByTestId("stage")).toHaveAttribute("data-items", "1");
	const boardPoint = await boardCenter(page);
	const beforePositions = await page
		.getByTestId("stage")
		.getAttribute("data-positions");
	await page.mouse.move(boardPoint.x, boardPoint.y);
	await page.mouse.down();
	await page.mouse.move(boardPoint.x + 60, boardPoint.y + 40, { steps: 5 });
	await page.mouse.up();
	await expect(page.getByTestId("stage")).toHaveAttribute(
		"data-positions",
		beforePositions ?? "",
	);

	// Save a copy: the new scene becomes active; the recipient's scene is intact.
	await page.getByTestId("share-save-copy").click();
	await expect(page.getByTestId("share-saved")).toBeVisible();
	await expect(page.getByTestId("share-stamp")).toHaveCount(0);
	await expect(page.getByTestId("scene-open")).toBeVisible();
	await openScenes(page);
	await expect(page.locator("[data-scene-open]")).toHaveCount(3);
	await expect(
		page
			.locator("[data-scene-open]")
			.filter({ hasText: "Sender board (copy)" }),
	).toHaveCount(1);
	await closeScenes(page);

	await switchScene(page, "Mine");
	await expect(page.getByTestId("stage")).toHaveAttribute("data-items", "0");
	await expect(page.getByTestId("stage")).toHaveAttribute("data-boards", "1");

	// Reload: the saved copy is still active, and the recipient's scene is intact.
	await switchScene(page, "Sender board (copy)");
	await page.reload();
	await expect(page.getByTestId("stage")).toHaveAttribute("data-items", "1");
	await switchScene(page, "Mine");
	await expect(page.getByTestId("stage")).toHaveAttribute("data-items", "0");
});

test("an over-cap shared scene loads read-only with the capacity warning", async ({
	page,
}) => {
	const boards = Array.from({ length: 11 }, (_, index) =>
		board(`b-${index + 1}`, { x: index * 12, y: 0 }),
	);
	const hash = shareHash({ name: "Over cap", boards, items: [] });
	await openShare(page, hash);
	await expect(page.getByTestId("share-stamp")).toBeVisible();
	await expect(page.getByTestId("share-capacity")).toContainText(
		"Over capacity",
	);
	await expect(page.getByTestId("share-error")).toHaveCount(0);
	await expect(page.getByTestId("stage")).toHaveAttribute("data-boards", "11");
});

test("an unknown ref keeps its geometry and renders a labeled placeholder", async ({
	page,
}) => {
	const hash = shareHash({
		name: "Unknown part",
		boards: [board("b-1", { x: 40, y: 30 })],
		items: [
			item("i-1", {
				refId: "mystery-pedal",
				boardUid: "b-1",
				x: 5,
				y: 5,
			}),
		],
	});
	await openShare(page, hash);
	await expect(page.getByTestId("share-stamp")).toBeVisible();
	await expect(page.getByTestId("share-error")).toHaveCount(0);
	await expect(page.getByTestId("stage")).toHaveAttribute("data-items", "1");
	// The canvas fallback is labeled with the refId (not just the info panel).
	await expect(page.getByTestId("stage")).toHaveAttribute(
		"data-item-labels",
		"mystery-pedal",
	);
	const centre = await firstItemScreenCentre(page, {
		widthCm: 7,
		heightCm: 12,
	});
	await page.mouse.click(centre.x, centre.y);
	await expect(page.getByTestId("info-name")).toHaveText("mystery-pedal");
});

test("save a copy at the 10-scene cap shows an inline reason", async ({
	page,
}) => {
	await seedSceneCount(page, 10);
	const hash = shareHash({
		name: "Shared board",
		boards: [board("b-1")],
		items: [item("i-1", { boardUid: "b-1", x: 5, y: 5 })],
	});
	await openShare(page, hash);
	await expect(page.getByTestId("share-stamp")).toBeVisible();
	await page.getByTestId("share-save-copy").click();
	await expect(page.getByTestId("share-save-error")).toContainText(
		"Scene limit reached",
	);
	await expect(page.getByTestId("share-stamp")).toBeVisible();
	await page.getByTestId("share-exit").click();
	await expect(page.getByTestId("scene-open")).toBeVisible();
	await openScenes(page);
	await expect(page.locator("[data-scene-open]")).toHaveCount(10);
});

test("a damaged link shows an inline error and leaves the scene untouched", async ({
	page,
}) => {
	await page.goto("/");
	await expect(page.getByTestId("stage")).toBeVisible();
	await addPedal(page, "boss-bd-2-blues-driver");
	await expect(page.getByTestId("stage")).toHaveAttribute("data-items", "1");
	await waitForSavedItems(page, 1);

	await openShare(page, "#s=v1:not-a-valid-payload");
	await expect(page.getByTestId("share-error")).toBeVisible();
	await expect(page.getByTestId("share-stamp")).toHaveCount(0);
	await expect(page.getByTestId("scene-open")).toBeVisible();
	await expect(page.getByTestId("stage")).toHaveAttribute("data-items", "1");
	await page.getByTestId("share-error-dismiss").click();
	await expect(page.getByTestId("share-error")).toHaveCount(0);
	await expect(page).not.toHaveURL(/#s=/);
});
