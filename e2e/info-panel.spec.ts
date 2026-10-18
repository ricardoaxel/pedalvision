import { expect, type Page, test } from "@playwright/test";
import { addBoard, addPedal, openPicker } from "./picker.ts";

/**
 * P2-03 — the pedal info panel + the non-blocking space warning. Runs on the
 * desktop project and the `mobile-chromium` project (both viewports), since the
 * panel is a push rail on desktop and a bottom sheet on mobile.
 */

/** Expand the mobile sheet's detail sections (a no-op on the desktop rail). */
async function expandDetails(page: Page): Promise<void> {
	const expand = page.getByTestId("info-expand");
	if (await expand.isVisible()) await expand.click();
}

async function fillMinimalPart(
	page: Page,
	{ name, width, depth }: { name: string; width: string; depth: string },
): Promise<void> {
	await page.getByTestId("custom-name").fill(name);
	await page.getByTestId("custom-width").fill(width);
	await page.getByTestId("custom-depth").fill(depth);
}

test("shows a selected catalog pedal's identity, tags and dimensions", async ({
	page,
}) => {
	await page.goto("/");
	await addBoard(page, "boss-bcb-1000");
	await addPedal(page, "boss-bd-2-blues-driver");

	const panel = page.getByTestId("info-panel");
	await expect(panel).toBeVisible();
	await expect(page.getByTestId("info-name")).toHaveText("BD-2 Blues Driver");
	await expect(page.getByTestId("info-brand")).toHaveText("BOSS");
	// The catalog seed has no power/jacks yet → those sections are absent
	// (graceful omission, never empty scaffolding).
	await expect(page.getByTestId("info-power")).toHaveCount(0);
	await expect(page.getByTestId("info-jacks")).toHaveCount(0);

	// Dimensions + effects live in the expanded readout (the mobile peek shows
	// dimensions in its status row); expand so both are visible.
	await expandDetails(page);
	await expect(page.getByTestId("info-dims")).toContainText("cm");
	await expect(page.getByTestId("info-effects")).toContainText("Overdrive");
});

test("the cm/in toggle switches the displayed dimensions", async ({ page }) => {
	await page.goto("/");
	await addBoard(page, "boss-bcb-1000");
	await addPedal(page, "boss-bd-2-blues-driver");
	await expect(page.getByTestId("info-panel")).toBeVisible();
	await expandDetails(page);

	const dims = page.getByTestId("info-dims");
	await expect(dims).toHaveText("7.3 × 13.02 cm");
	await page.getByTestId("info-units-in").click();
	await expect(dims).toHaveText("2.87 × 5.13 in");
	await page.getByTestId("info-units-cm").click();
	await expect(dims).toHaveText("7.3 × 13.02 cm");
});

test("shows the selected catalog pedal's image in the specimen preview", async ({
	page,
}) => {
	await page.goto("/");
	await addBoard(page, "boss-bcb-1000");
	await addPedal(page, "boss-bd-2-blues-driver");
	await expect(page.getByTestId("info-panel")).toBeVisible();

	// On mobile the plate is only revealed when the sheet is expanded.
	await expandDetails(page);
	const preview = page.getByTestId("info-preview");
	await expect(preview).toBeVisible();
	await expect(preview.locator("img")).toBeVisible();
	await expect(preview).toContainText("Specimen");
});

test("shows a drawing (no image) as a custom part's preview", async ({
	page,
}) => {
	await page.goto("/");
	await openPicker(page, "custom");
	await fillMinimalPart(page, { name: "My Fuzz", width: "6", depth: "12" });
	await page.getByTestId("custom-submit").click();

	await expect(page.getByTestId("info-panel")).toBeVisible();
	await expandDetails(page);
	const preview = page.getByTestId("info-preview");
	await expect(preview).toBeVisible();
	await expect(preview).toHaveAttribute("data-preview", "custom");
	// Custom parts are text-only — no image element.
	await expect(preview.locator("img")).toHaveCount(0);
});

test("shows power and jack sections for a custom part", async ({ page }) => {
	await page.goto("/");
	await openPicker(page, "custom");
	await page.getByTestId("custom-category-supply").click();
	await fillMinimalPart(page, { name: "Power Brick", width: "20", depth: "8" });
	await page.getByTestId("custom-voltage").fill("9");
	await page.getByTestId("custom-current").fill("500");
	await page.getByTestId("custom-add-jack").click();
	await page.getByTestId("custom-submit").click();

	await expect(page.getByTestId("info-panel")).toBeVisible();
	await expect(page.getByTestId("info-name")).toHaveText("Power Brick");
	await expandDetails(page);
	await expect(page.getByTestId("info-power")).toBeVisible();
	await expect(page.getByTestId("info-power-value")).toContainText(
		"9 V · DC · 500 mA",
	);
	await expect(page.getByTestId("info-jacks")).toBeVisible();
});

test("warns about an overlapping pedal but keeps it placed", async ({
	page,
}) => {
	await page.goto("/");
	const stage = page.getByTestId("stage");
	await addBoard(page, "boss-bcb-1000");
	await addPedal(page, "boss-bd-2-blues-driver");
	await expect(page.getByTestId("info-panel")).toBeVisible();
	await expect(page.getByTestId("info-warning")).toHaveCount(0);

	// The source pedal's stored (board-local) position, before the overlap.
	const sourcePosition = (
		(await stage.getAttribute("data-item-positions")) ?? ""
	).split(";")[0];

	// Duplicating offsets the clone 1.5 cm — it overlaps its source.
	await page.getByTestId("duplicate-item").click();
	await expect(stage).toHaveAttribute("data-items", "2");

	// The compact chip shows on the mobile peek; the full sentence band shows
	// when the sheet is expanded (and always on the desktop rail).
	await expandDetails(page);
	const warning = page.getByTestId("info-warning");
	await expect(warning).toBeVisible();
	await expect(warning).toContainText("Overlaps");
	// Warn — but still allow: the placement stands and nothing moved.
	await expect(stage).toHaveAttribute("data-items", "2");
	expect(
		((await stage.getAttribute("data-item-positions")) ?? "").split(";")[0],
	).toBe(sourcePosition);
});

test("the mobile peek shows the cover sleeve and warning chip, then expands to the banner", async ({
	page,
}, testInfo) => {
	test.skip(testInfo.project.name !== "mobile-chromium", "mobile-only layout");
	await page.goto("/");
	await addBoard(page, "boss-bcb-1000");
	await addPedal(page, "boss-bd-2-blues-driver");
	await expect(page.getByTestId("info-panel")).toBeVisible();

	// Collapsed peek: sleeve + dimensions in the status row, no banner.
	await expect(page.getByTestId("info-cover")).toBeVisible();
	await expect(page.getByTestId("info-peek-dims")).toBeVisible();
	await expect(page.getByTestId("info-preview")).toBeHidden();

	// An overlap surfaces the compact chip in the peek (and NOT the full band,
	// which is the expanded/desktop form) — exactly one live region is shown.
	await page.getByTestId("duplicate-item").click();
	await expect(page.getByTestId("info-warning-chip")).toBeVisible();
	await expect(page.getByTestId("info-warning")).toBeHidden();

	// Expand: the banner (hero) replaces the sleeve + status row.
	await page.getByTestId("info-expand").click();
	await expect(page.getByTestId("info-preview")).toBeVisible();
	await expect(page.getByTestId("info-cover")).toBeHidden();
	await expect(page.getByTestId("info-units")).toBeVisible();
	await expect(page.getByTestId("info-warning")).toBeVisible();
	await expect(page.getByTestId("info-warning-chip")).toBeHidden();
});

test("clearing the selection hides the panel", async ({ page }) => {
	await page.goto("/");
	await addPedal(page, "boss-bd-2-blues-driver");
	await expect(page.getByTestId("info-panel")).toBeVisible();
	await page.getByTestId("info-close").click();
	await expect(page.getByTestId("info-panel")).toHaveCount(0);
});
