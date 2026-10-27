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
	// The BOSS batch replaces the seed BD-2 with verified specs: 9 V / 20 mA and
	// right-input/left-output jacks (positions are edge-only, so approximate).
	// Power + jacks live in the expanded readout on mobile; expand first.
	await expandDetails(page);
	await expect(page.getByTestId("info-power")).toBeVisible();
	await expect(page.getByTestId("info-power-value")).toHaveText(
		"9 V · DC · 20 mA",
	);
	await expect(page.getByTestId("info-jacks")).toBeVisible();
	await expect(page.getByTestId("info-jacks")).toContainText(
		"I · Right · ~0.50",
	);
	await expect(page.getByTestId("info-jacks")).toContainText(
		"O · Left · ~0.50",
	);
	await expect(page.getByTestId("info-jacks")).toContainText(
		"Power · Top · ~0.50",
	);
	await expect(page.getByTestId("info-jacks")).toContainText(
		"Some jack positions are approximate.",
	);
	await expect(page.getByTestId("info-dims")).toContainText("cm");
	await expect(page.getByTestId("info-effects")).toContainText("Overdrive");
});

test("shows the independent-planner notice and removal link", async ({
	page,
}) => {
	await page.goto("/");
	await addBoard(page, "boss-bcb-1000");
	await addPedal(page, "boss-bd-2-blues-driver");
	await expandDetails(page);
	const legal = page.getByTestId("info-legal");
	await expect(legal).toBeVisible();
	await expect(legal).toContainText("not affiliated with or endorsed by BOSS");
	await expect(
		legal.getByRole("link", { name: "Image credits & removal" }),
	).toHaveAttribute("href", "/attribution.html");
});

test("the attribution page offers a removal contact", async ({ page }) => {
	await page.goto("/attribution.html");
	await expect(
		page.getByRole("heading", { name: "Catalog image credits & removal" }),
	).toBeVisible();
	await expect(
		page.getByRole("link", { name: "ricardoaxelgd@gmail.com" }),
	).toHaveAttribute("href", /^mailto:/);
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
	// The specimen/banner is a master surface — always the 800 rendition.
	await expect(preview.locator("img")).toHaveAttribute(
		"src",
		"/pedal-assets/pedals/800/boss-bd-2-blues-driver.avif",
	);
	await expect(preview).toContainText("Specimen");
	// The hidden mobile sleeve does not mount its 350 img outside the peek.
	await expect(page.getByTestId("info-cover").locator("img")).toHaveCount(0);
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
	const assetRequests: string[] = [];
	page.on("request", (request) => {
		const path = new URL(request.url()).pathname;
		if (path.startsWith("/pedal-assets/")) assetRequests.push(path);
	});
	await page.goto("/");
	await addBoard(page, "boss-bcb-1000");
	await addPedal(page, "boss-bd-2-blues-driver");
	await expect(page.getByTestId("info-panel")).toBeVisible();

	// Collapsed peek: sleeve + dimensions in the status row, no banner.
	const sleeve = page.getByTestId("info-cover");
	await expect(sleeve).toBeVisible();
	const sleeveImg = sleeve.locator("img");
	await expect(sleeveImg).toHaveAttribute(
		"src",
		"/pedal-assets/pedals/350/boss-bd-2-blues-driver.avif",
	);
	await expect
		.poll(() =>
			sleeveImg.evaluate((element: HTMLImageElement) => element.naturalWidth),
		)
		.toBeGreaterThan(0);
	expect(assetRequests).toContain(
		"/pedal-assets/pedals/350/boss-bd-2-blues-driver.avif",
	);
	await expect(page.getByTestId("info-peek-dims")).toBeVisible();
	await expect(page.getByTestId("info-preview")).toBeHidden();
	// Only the sleeve's 350 is mounted while collapsed (no hidden 800 fetch).
	await expect(page.getByTestId("info-preview").locator("img")).toHaveCount(0);

	// An overlap surfaces the compact chip in the peek (and NOT the full band,
	// which is the expanded/desktop form) — exactly one live region is shown.
	await page.getByTestId("duplicate-item").click();
	await expect(page.getByTestId("info-warning-chip")).toBeVisible();
	await expect(page.getByTestId("info-warning")).toBeHidden();

	// Expand: the banner (hero, 800 master) replaces the sleeve (350).
	await page.getByTestId("info-expand").click();
	const banner = page.getByTestId("info-preview");
	await expect(banner).toBeVisible();
	const bannerImg = banner.locator("img");
	await expect(bannerImg).toHaveAttribute(
		"src",
		"/pedal-assets/pedals/800/boss-bd-2-blues-driver.avif",
	);
	await expect
		.poll(() =>
			bannerImg.evaluate((element: HTMLImageElement) => element.naturalWidth),
		)
		.toBeGreaterThan(0);
	expect(assetRequests).toContain(
		"/pedal-assets/pedals/800/boss-bd-2-blues-driver.avif",
	);
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
