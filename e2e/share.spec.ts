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
	expect(link).toContain("#s=v2:");
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
	// The copy is a real editable scene, not a read-only snapshot.
	await addPedal(page, "boss-bd-2-blues-driver");
	await expect(page.getByTestId("stage")).toHaveAttribute("data-items", "2");
	await waitForSavedItems(page, 2);
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

	// Reload: the saved copy (with the pedal added after saving) is still active,
	// and the recipient's scene is intact.
	await switchScene(page, "Sender board (copy)");
	await page.reload();
	await expect(page.getByTestId("stage")).toHaveAttribute("data-items", "2");
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
		boards: [board("b-1", { boardRefId: "retired-board", x: 40, y: 80 })],
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

test("clipboard denial leaves the link selectable", async ({ page }) => {
	await page.addInitScript(() => {
		Object.defineProperty(Navigator.prototype, "clipboard", {
			configurable: true,
			get: () => ({
				writeText: async () => {
					throw new Error("clipboard denied");
				},
			}),
		});
	});
	await page.goto("/");
	await expect(page.getByTestId("stage")).toBeVisible();
	await addBoard(page, "boss-bcb-1000");
	await page.getByTestId("share-open").click();
	await expect(page.getByTestId("share-panel")).toBeVisible();
	await page.getByTestId("share-copy").click();
	await expect(page.getByTestId("share-panel")).toContainText(
		"Couldn’t copy automatically",
	);
	const field = page.getByTestId("share-link");
	await expect(field).toBeFocused();
	const selected = await field.evaluate((element) => {
		const input = element as HTMLInputElement;
		return (
			input.selectionStart === 0 && input.selectionEnd === input.value.length
		);
	});
	expect(selected).toBe(true);
});

test("an over-cap shared scene can be saved as an editable copy", async ({
	page,
}) => {
	const boards = Array.from({ length: 11 }, (_, index) =>
		board(`b-${index + 1}`, { x: index * 12, y: 0 }),
	);
	await openShare(page, shareHash({ name: "Over cap", boards, items: [] }));
	await expect(page.getByTestId("share-stamp")).toBeVisible();
	await page.getByTestId("share-save-copy").click();
	await expect(page.getByTestId("share-saved")).toBeVisible();
	await expect(page.getByTestId("stage")).toHaveAttribute("data-boards", "11");
	// Capacity caps guard adding, not loading: the copy is still editable.
	await addPedal(page, "boss-bd-2-blues-driver");
	await expect(page.getByTestId("stage")).toHaveAttribute("data-items", "1");
	await waitForSavedItems(page, 1);
	await page.reload();
	await expect(page.getByTestId("stage")).toHaveAttribute("data-boards", "11");
	await expect(page.getByTestId("stage")).toHaveAttribute("data-items", "1");
});

test("share round-trips an inline custom board (size + finish) read-only", async ({
	page,
}) => {
	// Custom boards have no catalog ref: the definition (size + texture)
	// travels inline in the payload and must survive the recipient's save-copy.
	await openShare(
		page,
		shareHash({
			name: "Custom board",
			boards: [
				board("cb-1", {
					boardRefId: null,
					customSize: { widthCm: 80, heightCm: 40 },
					texture: "tolex",
					x: 10,
					y: 10,
				}),
			],
			items: [item("i-1", { boardUid: "cb-1", x: 5, y: 5 })],
		}),
	);
	const stage = page.getByTestId("stage");
	await expect(page.getByTestId("share-stamp")).toBeVisible();
	await expect(stage).toHaveAttribute("data-boards", "1");
	await expect(stage).toHaveAttribute("data-custom-boards", "1");
	await expect(stage).toHaveAttribute("data-board-sizes", "80x40");
	await expect(stage).toHaveAttribute("data-board-textures", "tolex");
	await expect(stage).toHaveAttribute("data-item-parents", "0");

	// Read-only chrome, but "Save a copy" keeps the inline definition editable.
	await expect(page.getByTestId("picker-open")).toHaveCount(0);
	await page.getByTestId("share-save-copy").click();
	await expect(page.getByTestId("share-saved")).toBeVisible();
	await expect(page.getByTestId("scene-open")).toBeVisible();
	await expect(stage).toHaveAttribute("data-custom-boards", "1");
	await expect(stage).toHaveAttribute("data-board-sizes", "80x40");
	await expect(stage).toHaveAttribute("data-board-textures", "tolex");

	// The copy went through IndexedDB: reload preserves the inline definition.
	await page.reload();
	await expect(stage).toHaveAttribute("data-custom-boards", "1");
	await expect(stage).toHaveAttribute("data-board-sizes", "80x40");
	await expect(stage).toHaveAttribute("data-board-textures", "tolex");
});

test("shared scenes keep multiple boards, rotations, loose items and pan/zoom", async ({
	page,
}) => {
	const boards = [
		board("b-1", { x: 10, y: 10 }),
		board("b-2", { x: 80, y: 10, rotationDeg: 30 }),
	];
	const items = [
		item("i-1", { boardUid: "b-1", x: 5, y: 5, rotationDeg: 0, z: 0 }),
		item("i-2", { boardUid: "b-2", x: 6, y: 6, rotationDeg: 45, z: 0 }),
		item("i-3", { boardUid: null, x: 120, y: 80, rotationDeg: 15, z: 0 }),
	];
	await openShare(page, shareHash({ name: "Multi board", boards, items }));
	await expect(page.getByTestId("share-stamp")).toBeVisible();
	await expect(page.getByTestId("stage")).toHaveAttribute("data-boards", "2");
	await expect(page.getByTestId("stage")).toHaveAttribute(
		"data-rotations",
		"0,30",
	);
	await expect(page.getByTestId("stage")).toHaveAttribute(
		"data-positions",
		"10.00,10.00;80.00,10.00",
	);
	await expect(page.getByTestId("stage")).toHaveAttribute("data-items", "3");
	await expect(page.getByTestId("stage")).toHaveAttribute(
		"data-item-parents",
		"0,1,loose",
	);
	await expect(page.getByTestId("stage")).toHaveAttribute(
		"data-item-rotations",
		"0.00,45.00,15.00",
	);
	// Read-only must not freeze navigation.
	const stage = page.getByTestId("stage");
	const box = await stage.boundingBox();
	if (!box) throw new Error("stage has no bounding box");
	const before = await stage.getAttribute("data-scale");
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	await page.mouse.wheel(0, -300);
	await expect
		.poll(async () => await stage.getAttribute("data-scale"))
		.not.toBe(before);
});

test("read-only drag attempts explain why editing is disabled", async ({
	page,
}) => {
	const hash = shareHash({
		name: "Read only",
		boards: [board("b-1", { x: 40, y: 80 })],
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
	const stage = page.getByTestId("stage");
	await expect(stage).toHaveAttribute("data-items", "1");

	// A tap/selection is allowed and must not nag.
	const firstPoint = await firstItemScreenCentre(page, {
		widthCm: 7,
		heightCm: 12,
	});
	await page.mouse.click(firstPoint.x, firstPoint.y);
	await expect(page.getByTestId("share-edit-cue")).toHaveCount(0);

	// Keyboard edit attempts get the same explanation (no silent no-op).
	await page.keyboard.press("Delete");
	await expect(page.getByTestId("share-edit-cue")).toBeVisible();
	await expect(stage).toHaveAttribute("data-readonly-cue", "item:i-1");

	// Moving the pedal like a drag shows the red outline + inline reason.
	const itemPoint = await firstItemScreenCentre(page, {
		widthCm: 7,
		heightCm: 12,
	});
	await page.mouse.move(itemPoint.x, itemPoint.y);
	await page.mouse.down();
	await page.mouse.move(itemPoint.x + 36, itemPoint.y + 24, { steps: 6 });
	await page.mouse.up();
	await expect(page.getByTestId("share-edit-cue")).toBeVisible();
	await expect(page.getByTestId("share-edit-cue")).toContainText("Save a copy");
	await expect(stage).toHaveAttribute("data-readonly-cue", "item:i-1");
	await expect(page.getByTestId("share-save-copy")).toHaveAttribute(
		"data-cue-highlight",
		"true",
	);

	// The board gives the same explanation.
	const boardPoint = await boardCenter(page);
	await page.mouse.move(boardPoint.x, boardPoint.y);
	await page.mouse.down();
	await page.mouse.move(boardPoint.x + 40, boardPoint.y + 24, { steps: 6 });
	await page.mouse.up();
	await expect(stage).toHaveAttribute("data-readonly-cue", "board:b-1");
	await expect(page.getByTestId("share-save-copy")).toHaveAttribute(
		"data-cue-highlight",
		"true",
	);

	// The cue never blocks navigation: an empty-canvas drag still pans.
	const beforeX = await stage.getAttribute("data-x");
	const box = await stage.boundingBox();
	if (!box) throw new Error("stage has no bounding box");
	await page.mouse.move(box.x + box.width - 40, box.y + box.height - 140);
	await page.mouse.down();
	await page.mouse.move(box.x + box.width - 100, box.y + box.height - 100, {
		steps: 6,
	});
	await page.mouse.up();
	await expect
		.poll(async () => await stage.getAttribute("data-x"))
		.not.toBe(beforeX);
	await expect(page.getByTestId("share-save-copy")).not.toHaveAttribute(
		"data-cue-highlight",
		"true",
	);

	// The cue text itself is the shortcut: clicking "Save a copy" saves the copy.
	const again = await firstItemScreenCentre(page, {
		widthCm: 7,
		heightCm: 12,
	});
	await page.mouse.move(again.x, again.y);
	await page.mouse.down();
	await page.mouse.move(again.x + 36, again.y + 24, { steps: 6 });
	await page.mouse.up();
	await expect(page.getByTestId("share-edit-cue")).toBeVisible();
	await page.getByTestId("share-cue-save").click();
	await expect(page.getByTestId("share-saved")).toBeVisible();
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
