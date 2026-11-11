import { expect, type Page, test } from "@playwright/test";
import { addBoard, addPedal, openPicker } from "./picker.ts";
import { item, shareHash } from "./share.ts";
import { firstItemScreenCentre } from "./stage.ts";

/**
 * F-14 — "Cross-Reference": a selected catalog pedal offers catalogue
 * alternatives with a shared effect type. Clicking one opens the Pedals picker
 * filtered to the selected pedal's types. Runs on desktop + mobile.
 */

/** Expand the mobile info sheet (a no-op on the desktop rail). */
async function expandDetails(page: Page): Promise<void> {
	const expand = page.getByTestId("info-expand");
	if (await expand.isVisible()) await expand.click();
}

async function selectCatalogPedal(page: Page): Promise<void> {
	await page.goto("/");
	await addBoard(page, "boss-bcb-1000");
	await addPedal(page, "boss-bd-2-blues-driver");
	await expect(page.getByTestId("info-panel")).toBeVisible();
	await expandDetails(page);
}

test("lists similar catalog pedals and opens the filtered picker", async ({
	page,
}) => {
	await selectCatalogPedal(page);

	const section = page.getByTestId("info-similar");
	await expect(section).toBeVisible();
	await expect(section).toContainText("Similar");
	// A stable same-effect alternative for the BD-2 (overdrive).
	const alternative = page.getByTestId("info-similar-boss-bb-1x-bass-driver");
	await expect(alternative).toBeVisible();
	await expect(alternative).toContainText("BB-1X Bass Driver");
	await expect(alternative).toContainText("BOSS");
	await expect(alternative).toContainText("Overdrive");

	// Its accessible name states the action (the row has no visible CTA).
	await expect(alternative).toHaveAttribute(
		"aria-label",
		/BB-1X Bass Driver, shares Overdrive, .*cm — open in the catalogue/,
	);
	await expect(alternative).toHaveAttribute("aria-haspopup", "dialog");

	await alternative.click();
	await expect(page.getByTestId("picker-panel")).toBeVisible();
	// Pedals tab, effect type applied, other axes cleared.
	await expect(page.getByTestId("picker-tab-pedals")).toHaveAttribute(
		"aria-pressed",
		"true",
	);
	await expect(page.getByTestId("picker-effect-overdrive")).toHaveAttribute(
		"aria-pressed",
		"true",
	);
	await expect(page.getByTestId("picker-search")).toHaveValue("");
	await expect(page.getByTestId("picker-brand")).toHaveValue("");
	await expect(page.getByTestId("picker-sort")).toHaveValue("relevance");
	await expect(page.getByTestId("picker-stereo")).toHaveAttribute(
		"aria-pressed",
		"false",
	);
	// The filtered ledger offers alternatives the user can place.
	await expect(page.getByTestId("picker-results")).toBeVisible();
});

test("a re-tap re-applies the preset after the picker closes", async ({
	page,
}) => {
	await selectCatalogPedal(page);
	await page.getByTestId("info-similar-boss-bb-1x-bass-driver").click();
	await expect(page.getByTestId("picker-panel")).toBeVisible();
	await expect(page.getByTestId("picker-effect-overdrive")).toHaveAttribute(
		"aria-pressed",
		"true",
	);
	// The user changes every filter axis, then closes without placing anything.
	await page.getByTestId("picker-search").fill("waza");
	await page.getByTestId("picker-brand").selectOption("BOSS");
	await page.getByTestId("picker-sort").selectOption("name");
	await page.getByTestId("picker-stereo").click();
	await expect(page.getByTestId("picker-stereo")).toHaveAttribute(
		"aria-pressed",
		"true",
	);
	await page.getByTestId("picker-close").click();
	await expect(page.getByTestId("picker-panel")).toHaveCount(0);
	await expect(page.getByTestId("info-similar")).toBeVisible();

	// Re-tapping the same row applies the preset again (new key) and clears
	// the previous query/brand.
	await page.getByTestId("info-similar-boss-bb-1x-bass-driver").click();
	await expect(page.getByTestId("picker-panel")).toBeVisible();
	await expect(page.getByTestId("picker-search")).toHaveValue("");
	await expect(page.getByTestId("picker-brand")).toHaveValue("");
	await expect(page.getByTestId("picker-sort")).toHaveValue("relevance");
	await expect(page.getByTestId("picker-effect-overdrive")).toHaveAttribute(
		"aria-pressed",
		"true",
	);
});

test("hides the similar section for a custom part", async ({ page }) => {
	await page.goto("/");
	await openPicker(page, "custom");
	await page.getByTestId("custom-name").fill("My Fuzz");
	await page.getByTestId("custom-width").fill("6");
	await page.getByTestId("custom-depth").fill("12");
	await page.getByTestId("custom-submit").click();
	await expect(page.getByTestId("info-panel")).toBeVisible();
	await expandDetails(page);
	await expect(page.getByTestId("info-similar")).toHaveCount(0);
});

test("hides the similar section in a read-only share", async ({ page }) => {
	const hash = shareHash({
		name: "Shared drive",
		boards: [
			{
				uid: "b-1",
				boardRefId: "boss-bcb-1000",
				x: 0,
				y: 0,
				rotationDeg: 0,
			},
		],
		items: [item("i-1", { boardUid: "b-1", x: 5, y: 5 })],
	});
	await page.goto(`/?share=1${hash}`);
	const stage = page.getByTestId("stage");
	await expect(stage).toHaveAttribute("data-items", "1");
	const centre = await firstItemScreenCentre(page, {
		widthCm: 7.3,
		heightCm: 13.02,
	});
	await page.mouse.click(centre.x, centre.y);
	await expect(page.getByTestId("info-panel")).toBeVisible();
	await expandDetails(page);
	await expect(page.getByTestId("info-similar")).toHaveCount(0);
	// The picker is an edit surface and must not exist in a share.
	await expect(page.getByTestId("picker-panel")).toHaveCount(0);
});
