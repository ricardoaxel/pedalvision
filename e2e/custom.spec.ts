import { expect, type Page, test } from "@playwright/test";
import { addBoard, addPedal, openPicker } from "./picker.ts";

/**
 * A custom part must satisfy name + width + depth before it can be placed.
 * Fills the minimum fields and returns (the supplied values are in cm).
 */
async function fillMinimalPart(
	page: Page,
	{ name, width, depth }: { name: string; width: string; depth: string },
): Promise<void> {
	await page.getByTestId("custom-name").fill(name);
	await page.getByTestId("custom-width").fill(width);
	await page.getByTestId("custom-depth").fill(depth);
}

test("opening the Custom tab focuses its first field", async ({ page }) => {
	await page.goto("/");
	await openPicker(page, "custom");
	await expect(page.getByTestId("custom-name")).toBeFocused();
});

test("creates a custom pedal and places it as a text-only part", async ({
	page,
}) => {
	await page.goto("/");
	const stage = page.getByTestId("stage");
	await expect(stage).toHaveAttribute("data-items", "0");

	await openPicker(page, "custom");
	await fillMinimalPart(page, { name: "My Fuzz", width: "6", depth: "12" });

	// A jack can be added (edge + position), then placed.
	await page.getByTestId("custom-add-jack").click();
	await expect(page.getByTestId("custom-jacks")).toBeVisible();

	await page.getByTestId("custom-submit").click();

	await expect(page.getByTestId("picker-panel")).toHaveCount(0);
	await expect(stage).toHaveAttribute("data-items", "1");
	// Custom parts are text-only — nothing registers as a canvas image.
	await expect(stage).toHaveAttribute("data-item-images", "loaded:0 failed:0");
});

test("places a custom part on the selected board", async ({ page }) => {
	await page.goto("/");
	const stage = page.getByTestId("stage");
	await addBoard(page, "boss-bcb-1000");
	await expect(stage).toHaveAttribute("data-boards", "1");

	await openPicker(page, "custom");
	await fillMinimalPart(page, { name: "On board", width: "7", depth: "12" });
	await page.getByTestId("custom-submit").click();

	await expect(stage).toHaveAttribute("data-items", "1");
	// Attached to board #0 (not loose).
	await expect(stage).toHaveAttribute("data-item-parents", "0");
});

test("edits an existing custom part from the action bar", async ({ page }) => {
	await page.goto("/");
	const stage = page.getByTestId("stage");
	await openPicker(page, "custom");
	await fillMinimalPart(page, { name: "My Fuzz", width: "6", depth: "12" });
	await page.getByTestId("custom-submit").click();
	await expect(stage).toHaveAttribute("data-items", "1");

	// The selection action bar offers Edit for a custom part, pre-filled.
	await page.getByTestId("edit-custom-part").click();
	const name = page.getByTestId("custom-name");
	await expect(name).toHaveValue("My Fuzz");
	await expect(page.getByTestId("custom-submit")).toHaveText("Save changes");

	await name.fill("My Fuzz II");
	await page.getByTestId("custom-submit").click();
	await expect(page.getByTestId("picker-panel")).toHaveCount(0);
	// Edited in place — still one item, not a second placement.
	await expect(stage).toHaveAttribute("data-items", "1");

	// Re-opening Edit shows the saved name.
	await page.getByTestId("edit-custom-part").click();
	await expect(page.getByTestId("custom-name")).toHaveValue("My Fuzz II");
});

test("the Edit action is not offered for a catalog pedal", async ({ page }) => {
	await page.goto("/");
	await addPedal(page, "boss-bd-2-blues-driver");
	await expect(page.getByTestId("item-action-bar")).toBeVisible();
	await expect(page.getByTestId("edit-custom-part")).toHaveCount(0);
});

test("an edit draft does not leak into the next Create", async ({ page }) => {
	await page.goto("/");
	const stage = page.getByTestId("stage");
	await openPicker(page, "custom");
	await fillMinimalPart(page, { name: "Original", width: "6", depth: "12" });
	await page.getByTestId("custom-submit").click();
	await expect(stage).toHaveAttribute("data-items", "1");

	await page.getByTestId("edit-custom-part").click();
	await expect(page.getByTestId("custom-name")).toHaveValue("Original");
	await page.getByTestId("custom-name").fill("Edited");
	await page.getByTestId("custom-submit").click();
	await expect(page.getByTestId("picker-panel")).toHaveCount(0);

	// Opening Custom again starts a clean Create, not the edited draft.
	await openPicker(page, "custom");
	await expect(page.getByTestId("custom-name")).toHaveValue("");
	await expect(page.getByTestId("custom-submit")).toHaveText("Add custom part");
});

test("re-tapping the active Custom tab keeps edit mode", async ({ page }) => {
	await page.goto("/");
	await openPicker(page, "custom");
	await fillMinimalPart(page, { name: "Stay", width: "6", depth: "12" });
	await page.getByTestId("custom-submit").click();
	await page.getByTestId("edit-custom-part").click();
	await expect(page.getByTestId("custom-name")).toHaveValue("Stay");

	// Re-tapping the already-active Custom tab must not reopen the picker (which
	// would drop edit mode and leak the edit draft into Create).
	const bar = page.getByTestId("picker-bar-custom");
	if (await bar.isVisible()) await bar.click();
	else await page.getByTestId("picker-tab-custom").click();

	await expect(page.getByTestId("custom-name")).toHaveValue("Stay");
	await expect(page.getByTestId("custom-submit")).toHaveText("Save changes");
});

test("switching tabs keeps an in-progress create draft", async ({ page }) => {
	await page.goto("/");
	await openPicker(page, "custom");
	await page.getByTestId("custom-name").fill("Draft in progress");

	// Switch away (mobile bar if visible, else the desktop segmented control)
	// and back; the un-submitted Create draft must survive.
	const toBoards = page.getByTestId("picker-bar-boards");
	if (await toBoards.isVisible()) await toBoards.click();
	else await page.getByTestId("picker-tab-boards").click();
	const toCustom = page.getByTestId("picker-bar-custom");
	if (await toCustom.isVisible()) await toCustom.click();
	else await page.getByTestId("picker-tab-custom").click();

	await expect(page.getByTestId("custom-name")).toHaveValue(
		"Draft in progress",
	);
});

test("creates a supply with power and jacks", async ({ page }) => {
	await page.goto("/");
	const stage = page.getByTestId("stage");
	await openPicker(page, "custom");

	await page.getByTestId("custom-category-supply").click();
	// A supply is its power spec: the AC/DC + current fields are shown.
	await expect(page.getByTestId("custom-acdc")).toBeVisible();
	await fillMinimalPart(page, { name: "Power Brick", width: "20", depth: "8" });
	await page.getByTestId("custom-voltage").fill("9");
	await page.getByTestId("custom-current").fill("500");
	await page.getByTestId("custom-add-jack").click();

	await page.getByTestId("custom-submit").click();
	await expect(page.getByTestId("picker-panel")).toHaveCount(0);
	await expect(stage).toHaveAttribute("data-items", "1");
});

test("the CTA is disabled until the required fields are valid", async ({
	page,
}) => {
	await page.goto("/");
	await openPicker(page, "custom");
	const submit = page.getByTestId("custom-submit");
	await expect(submit).toBeDisabled();
	await fillMinimalPart(page, { name: "Now valid", width: "6", depth: "12" });
	await expect(submit).toBeEnabled();
	// Clearing the name disables it again.
	await page.getByTestId("custom-name").fill("");
	await expect(submit).toBeDisabled();
});

test("the cm/in toggle converts dimensions losslessly", async ({ page }) => {
	await page.goto("/");
	await openPicker(page, "custom");
	await page.getByTestId("custom-width").fill("6.35");
	await page.getByTestId("custom-depth").fill("12.7");

	await page.getByTestId("custom-units-in").click();
	await expect(page.getByTestId("custom-width")).toHaveValue("2.5");
	await expect(page.getByTestId("custom-depth")).toHaveValue("5");

	// Switching back restores the exact metric values.
	await page.getByTestId("custom-units-cm").click();
	await expect(page.getByTestId("custom-width")).toHaveValue("6.35");
	await expect(page.getByTestId("custom-depth")).toHaveValue("12.7");
});

test("the draft survives closing and reopening the picker", async ({
	page,
}) => {
	await page.goto("/");
	await openPicker(page, "custom");
	await page.getByTestId("custom-name").fill("Keep me");

	await page.keyboard.press("Escape");
	await expect(page.getByTestId("picker-panel")).toHaveCount(0);

	await openPicker(page, "custom");
	await expect(page.getByTestId("custom-name")).toHaveValue("Keep me");
});
