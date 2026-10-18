import { expect, type Page, test } from "@playwright/test";
import { addBoard, openPicker } from "./picker.ts";

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
