import { expect, type Page, test } from "@playwright/test";
import { openPicker } from "./picker.ts";

/**
 * Create a custom board through the Custom tab (P2-05). Opens the picker on the
 * Custom tab, switches the kind segment to Board, fills the definition, picks a
 * finish and submits.
 */
async function createCustomBoard(
	page: Page,
	{
		name,
		width,
		depth,
		finish = "matte",
	}: { name: string; width: string; depth: string; finish?: string },
): Promise<void> {
	await openPicker(page, "custom");
	await page.getByTestId("custom-category-board").click();
	await page.getByTestId("board-name").fill(name);
	await page.getByTestId("board-width").fill(width);
	await page.getByTestId("board-depth").fill(depth);
	await page.getByTestId(`board-finish-${finish}`).click();
	await page.getByTestId("board-submit").click();
	await expect(page.getByTestId("picker-panel")).toHaveCount(0);
}

/** The stage-viewport centre in page coordinates (the board placement point). */
async function stageCentre(page: Page): Promise<{ x: number; y: number }> {
	const box = await page.getByTestId("stage").boundingBox();
	if (!box) throw new Error("stage has no bounding box");
	return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test("creates a custom board with a chosen finish", async ({ page }) => {
	await page.goto("/");
	const stage = page.getByTestId("stage");
	await expect(stage).toHaveAttribute("data-custom-boards", "0");

	await createCustomBoard(page, {
		name: "Big Rig",
		width: "80",
		depth: "40",
		finish: "wood",
	});

	await expect(stage).toHaveAttribute("data-boards", "1");
	await expect(stage).toHaveAttribute("data-custom-boards", "1");
	await expect(stage).toHaveAttribute("data-board-textures", "wood");
	// A custom board renders procedurally — no catalog image is requested.
	await expect(stage).toHaveAttribute("data-item-images", "loaded:0 failed:0");
});

test("the cm/in toggle converts board dimensions losslessly", async ({
	page,
}) => {
	await page.goto("/");
	await openPicker(page, "custom");
	await page.getByTestId("custom-category-board").click();
	await page.getByTestId("board-width").fill("6.35");
	await page.getByTestId("board-depth").fill("12.7");

	await page.getByTestId("board-units-in").click();
	await expect(page.getByTestId("board-width")).toHaveValue("2.5");
	await expect(page.getByTestId("board-depth")).toHaveValue("5");

	await page.getByTestId("board-units-cm").click();
	await expect(page.getByTestId("board-width")).toHaveValue("6.35");
	await expect(page.getByTestId("board-depth")).toHaveValue("12.7");
});

test("the board CTA is disabled until the dimensions are valid", async ({
	page,
}) => {
	await page.goto("/");
	await openPicker(page, "custom");
	await page.getByTestId("custom-category-board").click();
	const submit = page.getByTestId("board-submit");
	await expect(submit).toBeDisabled();
	await page.getByTestId("board-width").fill("80");
	await expect(submit).toBeDisabled();
	await page.getByTestId("board-depth").fill("40");
	await expect(submit).toBeEnabled();
	// A board over the sanity bound is rejected.
	await page.getByTestId("board-width").fill("500");
	await expect(submit).toBeDisabled();
});

test("moves and rotates a custom board like a catalog board", async ({
	page,
}) => {
	await page.goto("/");
	const stage = page.getByTestId("stage");
	await createCustomBoard(page, { name: "Big Rig", width: "80", depth: "40" });
	await expect(stage).toHaveAttribute("data-custom-boards", "1");

	const before = await stage.getAttribute("data-positions");
	const { x: cx, y: cy } = await stageCentre(page);

	// Rotate via the Transformer handle (80 × 40 cm → the handle sits 28 px
	// above the top edge, i.e. cy − 80 − 28).
	await page.mouse.click(cx, cy);
	await expect(stage).not.toHaveAttribute("data-selected-board", "");
	await page.mouse.move(cx, cy - 108);
	await page.mouse.down();
	await page.mouse.move(cx + 130, cy - 40, { steps: 12 });
	await page.mouse.up();
	await expect
		.poll(async () => Number(await stage.getAttribute("data-rotations")))
		.not.toBe(0);

	// Move by dragging the board body.
	await page.mouse.move(cx, cy);
	await page.mouse.down();
	await page.mouse.move(cx + 70, cy + 50, { steps: 10 });
	await page.mouse.up();
	await expect
		.poll(async () => await stage.getAttribute("data-positions"))
		.not.toBe(before);
});

test("edits a custom board in place", async ({ page }) => {
	await page.goto("/");
	const stage = page.getByTestId("stage");
	await createCustomBoard(page, {
		name: "Big Rig",
		width: "80",
		depth: "40",
		finish: "matte",
	});
	await expect(stage).toHaveAttribute("data-custom-boards", "1");

	// Select the board, then Edit from the board action bar.
	const { x, y } = await stageCentre(page);
	await page.mouse.click(x, y);
	await expect(page.getByTestId("board-action-bar")).toBeVisible();
	await page.getByTestId("edit-custom-board").click();
	await expect(page.getByTestId("board-name")).toHaveValue("Big Rig");
	await expect(page.getByTestId("board-submit")).toHaveText("Save changes");

	await page.getByTestId("board-name").fill("Bigger Rig");
	await page.getByTestId("board-finish-tolex").click();
	await page.getByTestId("board-submit").click();
	await expect(page.getByTestId("picker-panel")).toHaveCount(0);
	// Edited in place: still one board, now with the new finish.
	await expect(stage).toHaveAttribute("data-boards", "1");
	await expect(stage).toHaveAttribute("data-board-textures", "tolex");
});

test("deletes a custom board", async ({ page }) => {
	await page.goto("/");
	const stage = page.getByTestId("stage");
	await createCustomBoard(page, { name: "Big Rig", width: "80", depth: "40" });
	await expect(stage).toHaveAttribute("data-boards", "1");

	const { x, y } = await stageCentre(page);
	await page.mouse.click(x, y);
	await expect(page.getByTestId("board-action-bar")).toBeVisible();
	await page.getByTestId("delete-custom-board").click();
	await expect(stage).toHaveAttribute("data-boards", "0");
});

test("a custom board persists across a reload", async ({ page }) => {
	await page.goto("/");
	await createCustomBoard(page, {
		name: "Big Rig",
		width: "80",
		depth: "40",
		finish: "brushed",
	});

	const stage = page.getByTestId("stage");
	const uidBefore = await stage.getAttribute("data-board-uids");
	expect(uidBefore).toBeTruthy();
	await expect(stage).toHaveAttribute("data-board-sizes", "80x40");

	await page.reload();
	await expect(stage).toHaveAttribute("data-custom-boards", "1");
	await expect(stage).toHaveAttribute("data-board-textures", "brushed");
	// Same uuid + true cm size survive the reload (not flattened to the fallback).
	await expect(stage).toHaveAttribute("data-board-uids", uidBefore ?? "");
	await expect(stage).toHaveAttribute("data-board-sizes", "80x40");
});
