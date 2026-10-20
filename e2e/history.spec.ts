import { expect, type Page, test } from "@playwright/test";
import { waitForSavedScene } from "./persistence.ts";
import { addBoard, addPedal, openPicker } from "./picker.ts";
import { board, item, shareHash } from "./share.ts";
import { firstItemScreenCentre } from "./stage.ts";

const PEDAL_CM = { widthCm: 7.3, heightCm: 13.02 };
const PX_PER_CM = 4;

function isMobile(page: Page): boolean {
	return (page.viewportSize()?.width ?? 1280) < 1024;
}

function undoButton(page: Page) {
	return page.getByTestId(
		isMobile(page) ? "history-undo-mobile" : "history-undo",
	);
}

function redoButton(page: Page) {
	return page.getByTestId(
		isMobile(page) ? "history-redo-mobile" : "history-redo",
	);
}

async function expectDepth(page: Page, undo: number, redo: number) {
	const stage = page.getByTestId("stage");
	await expect(stage).toHaveAttribute("data-undo-depth", String(undo));
	await expect(stage).toHaveAttribute("data-redo-depth", String(redo));
}

async function undoWithKeys(page: Page) {
	await page.keyboard.press("Control+z");
}

async function redoWithKeys(page: Page) {
	await page.keyboard.press("Control+Shift+z");
}

/** The first board's screen centre and footprint (world cm). */
async function boardCentre(page: Page) {
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
		x: box.x + (bx + w / 2) * PX_PER_CM * scale + vx,
		y: box.y + (by + h / 2) * PX_PER_CM * scale + vy,
		heightPx: h * PX_PER_CM * scale,
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

async function newScene(page: Page) {
	await openScenes(page);
	await page.getByTestId("scene-new").click();
	await expect(page.getByTestId("stage")).toHaveAttribute("data-boards", "0");
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

test("undo/redo work from the visible controls and the shortcuts", async ({
	page,
}) => {
	await page.goto("/");
	const stage = page.getByTestId("stage");
	await expect(stage).toBeVisible();
	await expectDepth(page, 0, 0);
	await expect(undoButton(page)).toHaveAttribute("aria-disabled", "true");
	await expect(redoButton(page)).toHaveAttribute("aria-disabled", "true");

	await addPedal(page, "boss-bd-2-blues-driver");
	await expect(stage).toHaveAttribute("data-items", "1");
	await expectDepth(page, 1, 0);

	await undoButton(page).click();
	await expect(stage).toHaveAttribute("data-items", "0");
	await expectDepth(page, 0, 1);
	await expect(undoButton(page)).toHaveAttribute("aria-disabled", "true");

	await redoButton(page).click();
	await expect(stage).toHaveAttribute("data-items", "1");
	await expectDepth(page, 1, 0);

	// Shortcuts: undo then redo.
	await undoWithKeys(page);
	await expect(stage).toHaveAttribute("data-items", "0");
	await redoWithKeys(page);
	await expect(stage).toHaveAttribute("data-items", "1");
	await expectDepth(page, 1, 0);
});

test("a drag and a rotate each undo as one committed step", async ({
	page,
}) => {
	await page.goto("/");
	const stage = page.getByTestId("stage");
	await expect(stage).toBeVisible();
	await addPedal(page, "boss-bd-2-blues-driver");
	await expect(stage).toHaveAttribute("data-items", "1");
	const original = await stage.getAttribute("data-item-positions");

	// Drag the loose pedal; the history must record only the committed drop.
	const centre = await firstItemScreenCentre(page, PEDAL_CM);
	await page.mouse.move(centre.x, centre.y);
	await page.mouse.down();
	await page.mouse.move(centre.x + 60, centre.y + 40, { steps: 8 });
	await page.mouse.up();
	await expect
		.poll(async () => stage.getAttribute("data-item-positions"))
		.not.toBe(original);
	await expectDepth(page, 2, 0);
	const moved = await stage.getAttribute("data-item-positions");

	await undoWithKeys(page);
	await expect(stage).toHaveAttribute("data-item-positions", original ?? "");
	await expectDepth(page, 1, 1);
	await redoWithKeys(page);
	await expect(stage).toHaveAttribute("data-item-positions", moved ?? "");
	await expectDepth(page, 2, 0);

	// The pedal stays selected through undo/redo (history never touches
	// selection), so its action bar is still attached.
	await expect(stage).not.toHaveAttribute("data-selected-item", "");
	await page.getByTestId("rotate-item").click();
	await expect(stage).toHaveAttribute("data-item-rotations", "45.00");
	await expectDepth(page, 3, 0);
	await undoWithKeys(page);
	await expect(stage).toHaveAttribute("data-item-rotations", "0.00");
	await redoWithKeys(page);
	await expect(stage).toHaveAttribute("data-item-rotations", "45.00");
});

test("duplicate, delete and z-order are one step each", async ({ page }) => {
	await page.goto("/");
	const stage = page.getByTestId("stage");
	await expect(stage).toBeVisible();
	await addPedal(page, "boss-bd-2-blues-driver");
	await expectDepth(page, 1, 0);

	// Duplicate: the clone is selected and on top.
	await page.getByTestId("duplicate-item").click();
	await expect(stage).toHaveAttribute("data-items", "2");
	await expectDepth(page, 2, 0);

	// Z-order: send the selected (top) clone to the back — one step.
	const orderBefore = (
		(await stage.getAttribute("data-item-order")) ?? ""
	).split(",");
	const swapped = [...orderBefore].reverse().join(",");
	await page.getByTestId("send-to-back").click();
	await expect
		.poll(async () => stage.getAttribute("data-item-order"))
		.toBe(swapped);
	await expectDepth(page, 3, 0);
	await undoWithKeys(page);
	await expect(stage).toHaveAttribute("data-item-order", orderBefore.join(","));
	await expectDepth(page, 2, 1);

	// Delete the still-selected clone: one step; undo brings it back.
	await page.keyboard.press("Delete");
	await expect(stage).toHaveAttribute("data-items", "1");
	await expectDepth(page, 3, 0);
	await undoWithKeys(page);
	await expect(stage).toHaveAttribute("data-items", "2");
	await expectDepth(page, 2, 1);
	await redoWithKeys(page);
	await expect(stage).toHaveAttribute("data-items", "1");
	await expectDepth(page, 3, 0);
});

test("custom pedal creation and edit are one step each", async ({ page }) => {
	await page.goto("/");
	const stage = page.getByTestId("stage");
	await expect(stage).toBeVisible();
	await addBoard(page, "boss-bcb-1000");

	// Definition + placement are one compound action.
	await openPicker(page, "custom");
	await page.getByTestId("custom-name").fill("My Fuzz");
	await page.getByTestId("custom-width").fill("6");
	await page.getByTestId("custom-depth").fill("12");
	await page.getByTestId("custom-submit").click();
	await expect(stage).toHaveAttribute("data-items", "1");
	await expectDepth(page, 2, 0);
	await expect(stage).toHaveAttribute("data-item-labels", "My Fuzz");

	await undoWithKeys(page);
	await expect(stage).toHaveAttribute("data-items", "0");
	await expect(stage).toHaveAttribute("data-item-labels", "");
	await redoWithKeys(page);
	await expect(stage).toHaveAttribute("data-items", "1");
	await expect(stage).toHaveAttribute("data-item-labels", "My Fuzz");

	// Edit the definition in place: one more step. The placed part is still
	// selected (redo does not touch selection), so its action bar is available.
	await expect(stage).not.toHaveAttribute("data-selected-item", "");
	await page.getByTestId("edit-custom-part").click();
	await page.getByTestId("custom-name").fill("My Fuzz II");
	await page.getByTestId("custom-submit").click();
	await expect(stage).toHaveAttribute("data-item-labels", "My Fuzz II");
	await expectDepth(page, 3, 0);
	await undoWithKeys(page);
	await expect(stage).toHaveAttribute("data-item-labels", "My Fuzz");
	await redoWithKeys(page);
	await expect(stage).toHaveAttribute("data-item-labels", "My Fuzz II");
});

test("board create, move, rotate and delete are one step each", async ({
	page,
}) => {
	await page.goto("/");
	const stage = page.getByTestId("stage");
	await expect(stage).toBeVisible();

	await addBoard(page, "boss-bcb-1000");
	await expect(stage).toHaveAttribute("data-boards", "1");
	await expectDepth(page, 1, 0);
	await undoWithKeys(page);
	await expect(stage).toHaveAttribute("data-boards", "0");
	await redoWithKeys(page);
	await expect(stage).toHaveAttribute("data-boards", "1");

	// Move the board by dragging its body.
	const centre = await boardCentre(page);
	const originalPositions = await stage.getAttribute("data-positions");
	await page.mouse.move(centre.x, centre.y);
	await page.mouse.down();
	await page.mouse.move(centre.x + 50, centre.y + 30, { steps: 6 });
	await page.mouse.up();
	await expect
		.poll(async () => stage.getAttribute("data-positions"))
		.not.toBe(originalPositions);
	await expectDepth(page, 2, 0);
	await undoWithKeys(page);
	await expect(stage).toHaveAttribute(
		"data-positions",
		originalPositions ?? "",
	);

	// Rotate via the board's Transformer handle (top edge + 28 px). The board
	// stays selected through the undo above.
	const moved = await boardCentre(page);
	await expect(stage).not.toHaveAttribute("data-selected-board", "");
	const handleY = moved.y - moved.heightPx / 2 - 28;
	await page.mouse.move(moved.x, handleY);
	await page.mouse.down();
	await page.mouse.move(moved.x + 120, handleY + 60, { steps: 10 });
	await page.mouse.up();
	await expect
		.poll(async () => stage.getAttribute("data-rotations"))
		.not.toBe("0");
	await expectDepth(page, 2, 0);
	await undoWithKeys(page);
	await expect(stage).toHaveAttribute("data-rotations", "0");

	// Delete the selected board through the boards picker: one step.
	await expect(stage).not.toHaveAttribute("data-selected-board", "");
	await openPicker(page, "boards");
	await page.getByTestId("remove-board").click();
	await expect(stage).toHaveAttribute("data-boards", "0");
	await expectDepth(page, 2, 0);
	await undoWithKeys(page);
	await expect(stage).toHaveAttribute("data-boards", "1");
	await expectDepth(page, 1, 1);
});

test("shortcuts are ignored inside inputs and while the picker is open", async ({
	page,
}) => {
	await page.goto("/");
	const stage = page.getByTestId("stage");
	await expect(stage).toBeVisible();
	await addPedal(page, "boss-bd-2-blues-driver");
	await expectDepth(page, 1, 0);

	await openPicker(page, "pedals");
	await page.getByTestId("picker-search").fill("boss");
	await undoWithKeys(page);
	await expect(stage).toHaveAttribute("data-items", "1");
	await expect(page.getByTestId("picker-panel")).toBeVisible();

	// Modal still owns the keyboard even when focus is on a button, not a field.
	await page.getByTestId("picker-close").focus();
	await undoWithKeys(page);
	await expect(stage).toHaveAttribute("data-items", "1");
	await expect(page.getByTestId("picker-panel")).toBeVisible();

	// Once closed, the same shortcut undoes normally.
	await page.getByTestId("picker-close").click();
	await expect(page.getByTestId("picker-panel")).toHaveCount(0);
	await undoWithKeys(page);
	await expect(stage).toHaveAttribute("data-items", "0");
});

test("history never crosses scenes", async ({ page }) => {
	await page.goto("/");
	const stage = page.getByTestId("stage");
	await expect(stage).toBeVisible();
	await addPedal(page, "boss-bd-2-blues-driver");
	await expectDepth(page, 1, 0);

	await newScene(page);
	await expect(stage).toHaveAttribute("data-items", "0");
	await expectDepth(page, 0, 0);
	await undoWithKeys(page);
	await expect(stage).toHaveAttribute("data-items", "0");

	await switchScene(page, "Scene 1");
	await expect(stage).toHaveAttribute("data-items", "1");
	await expectDepth(page, 0, 0);
	await undoWithKeys(page);
	await expect(stage).toHaveAttribute("data-items", "1");
});

test("a read-only share has no history and ignores undo", async ({ page }) => {
	const hash = shareHash({
		name: "Shared history",
		boards: [board("b-1", { x: 40, y: 40 })],
		items: [item("i-1", { boardUid: "b-1", x: 5, y: 5 })],
	});
	await page.goto(`/?share=1${hash}`);
	const stage = page.getByTestId("stage");
	await expect(page.getByTestId("share-stamp")).toBeVisible();
	await expect(stage).toHaveAttribute("data-items", "1");
	await expectDepth(page, 0, 0);
	await expect(page.getByTestId("history-undo")).toHaveCount(0);
	await expect(page.getByTestId("history-redo")).toHaveCount(0);
	await expect(page.getByTestId("history-undo-mobile")).toHaveCount(0);
	await expect(page.getByTestId("history-redo-mobile")).toHaveCount(0);

	const positions = await stage.getAttribute("data-item-positions");
	await undoWithKeys(page);
	await page.keyboard.press("Control+Shift+z");
	await expect(stage).toHaveAttribute("data-item-positions", positions ?? "");
	await expect(stage).toHaveAttribute("data-items", "1");
});

test("undo then reload persists the undone state", async ({ page }) => {
	await page.goto("/");
	const stage = page.getByTestId("stage");
	await expect(stage).toBeVisible();
	await addPedal(page, "boss-bd-2-blues-driver");
	await expect(stage).toHaveAttribute("data-items", "1");
	await waitForSavedScene(page, (document) => document.items.length === 1);

	await undoWithKeys(page);
	await expect(stage).toHaveAttribute("data-items", "0");
	await waitForSavedScene(page, (document) => document.items.length === 0);

	await page.reload();
	const reloaded = page.getByTestId("stage");
	await expect(reloaded).toHaveAttribute("data-items", "0");
	// History is in-memory only: a reload starts clean.
	await expect(reloaded).toHaveAttribute("data-undo-depth", "0");
});
