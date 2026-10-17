import { expect, type Page, test } from "@playwright/test";
import { addBoard, openPicker } from "./picker.ts";

/** The numeric result count from the picker footer (e.g. "137 pedals"). */
async function resultCount(page: Page): Promise<number> {
	const text = (await page.getByTestId("picker-count").textContent()) ?? "0";
	return Number.parseInt(text, 10);
}

test("the picker searches, filters and places a pedal", async ({ page }) => {
	await page.goto("/");
	const stage = page.getByTestId("stage");
	await expect(stage).toHaveAttribute("data-items", "0");

	await openPicker(page, "pedals");
	const total = await resultCount(page);
	expect(total).toBeGreaterThan(0);

	// Search narrows the list to the matching pedal.
	await page.getByTestId("picker-search").fill("blues driver");
	await expect(
		page.getByTestId("add-pedal-boss-bd-2-blues-driver"),
	).toBeVisible();
	expect(await resultCount(page)).toBeLessThan(total);

	// Brand filter narrows further (BOSS still includes the searched pedal).
	await page.getByTestId("picker-brand").selectOption("BOSS");
	await expect(
		page.getByTestId("add-pedal-boss-bd-2-blues-driver"),
	).toBeVisible();

	// No-results recovery: a nonsense query offers "Clear filters".
	await page.getByTestId("picker-search").fill("zzzzzzzz");
	await expect(page.getByTestId("picker-empty")).toBeVisible();
	await page.getByRole("button", { name: "Clear filters" }).click();
	await expect(page.getByTestId("picker-empty")).toHaveCount(0);

	// Placing a pedal closes the picker and drops it on the canvas.
	await page.getByTestId("add-pedal-boss-bd-2-blues-driver").click();
	await expect(page.getByTestId("picker-panel")).toHaveCount(0);
	await expect(stage).toHaveAttribute("data-items", "1");
	await expect(stage).not.toHaveAttribute("data-selected-item", "");
});

test("an effect-type chip filters the pedal list", async ({ page }) => {
	await page.goto("/");
	await openPicker(page, "pedals");
	const before = await resultCount(page);
	await page.getByTestId("picker-effect-distortion").click();
	expect(await resultCount(page)).toBeLessThan(before);
	// Toggling the chip off restores the full list.
	await page.getByTestId("picker-effect-distortion").click();
	expect(await resultCount(page)).toBe(before);
});

test("the picker places and removes a board", async ({ page }) => {
	await page.goto("/");
	const stage = page.getByTestId("stage");
	await addBoard(page, "boss-bcb-1000");
	await expect(stage).toHaveAttribute("data-boards", "1");
	await expect(stage).not.toHaveAttribute("data-selected-board", "");

	await openPicker(page, "boards");
	await page.getByTestId("remove-board").click();
	await expect(stage).toHaveAttribute("data-boards", "0");
});

test("the picker dismisses via Esc, the close button and the backdrop", async ({
	page,
}) => {
	await page.goto("/");

	await openPicker(page, "boards");
	await page.keyboard.press("Escape");
	await expect(page.getByTestId("picker-panel")).toHaveCount(0);

	await openPicker(page, "boards");
	await page.getByTestId("picker-close").click();
	await expect(page.getByTestId("picker-panel")).toHaveCount(0);

	await openPicker(page, "boards");
	// Click the scrim's top-left corner (clear of the centered/bottom panel).
	await page.getByTestId("picker-scrim").click({ position: { x: 8, y: 8 } });
	await expect(page.getByTestId("picker-panel")).toHaveCount(0);
});

test("mobile shows the persistent bottom tab bar and the sheet", async ({
	page,
}) => {
	const width = page.viewportSize()?.width ?? 1280;
	test.skip(width >= 1024, "mobile-only check");

	await page.goto("/");
	await expect(page.getByTestId("picker-open")).toBeHidden();

	const barTab = page.getByTestId("picker-bar-pedals");
	await expect(barTab).toBeVisible();
	await barTab.click();
	await expect(page.getByTestId("picker-panel")).toBeVisible();

	// The sheet leaves the tab bar reachable (small persistent footprint).
	await expect(page.getByTestId("picker-bar-pedals")).toBeVisible();
	const panel = await page.getByTestId("picker-panel").boundingBox();
	const viewport = page.viewportSize();
	if (!panel || !viewport) throw new Error("missing box");
	expect(panel.height).toBeLessThan(viewport.height);

	await page.getByTestId("add-pedal-boss-bd-2-blues-driver").click();
	await expect(page.getByTestId("picker-panel")).toHaveCount(0);
	await expect(page.getByTestId("stage")).toHaveAttribute("data-items", "1");
});
