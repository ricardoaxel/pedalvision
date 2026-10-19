import { expect, type Page, test } from "@playwright/test";
import { addPedal } from "./picker.ts";

const STORAGE_KEY = "pedalvision.firstRun.v1";

/** True on the desktop layout (≥1024px), where the toolbar Add buttons show. */
function isDesktop(page: Page): boolean {
	return (page.viewportSize()?.width ?? 1280) >= 1024;
}

test("the first-run note is small, clear of the canvas centre, and non-blocking", async ({
	page,
}) => {
	await page.goto("/");
	const hint = page.getByTestId("first-run-hint");
	await expect(hint).toBeVisible();
	await expect(hint).toContainText("Start with a board.");
	await expect(hint).toContainText("Then place pedals on it — true to scale.");

	const stage = page.getByTestId("stage");
	const stageBox = await stage.boundingBox();
	const hintBox = await hint.boundingBox();
	if (!stageBox || !hintBox) throw new Error("missing box");

	// The note never sits over the working centre of the canvas.
	const centre = {
		x: stageBox.x + stageBox.width / 2,
		y: stageBox.y + stageBox.height / 2,
	};
	const coversCentre =
		centre.x >= hintBox.x &&
		centre.x <= hintBox.x + hintBox.width &&
		centre.y >= hintBox.y &&
		centre.y <= hintBox.y + hintBox.height;
	expect(coversCentre).toBe(false);
	// Small chrome: a compact note on desktop, an even smaller single-line chip
	// above the mobile tab bar.
	expect(hintBox.height).toBeLessThan(isDesktop(page) ? 160 : 100);
	expect(hintBox.width).toBeLessThan(stageBox.width);

	// Canvas gestures still work while the note is visible.
	const before = Number(await stage.getAttribute("data-x"));
	await page.mouse.move(centre.x, centre.y);
	await page.mouse.down();
	await page.mouse.move(centre.x + 80, centre.y + 40, { steps: 4 });
	await page.mouse.up();
	await expect
		.poll(async () => Number(await stage.getAttribute("data-x")))
		.not.toBe(before);
});

test("the first-run CTA opens the board picker but keeps the note", async ({
	page,
}) => {
	await page.goto("/");
	await expect(page.getByTestId("first-run-hint")).toBeVisible();
	await page.getByTestId("first-run-cta").click();
	await expect(page.getByTestId("picker-panel")).toBeVisible();
	await expect(page.getByTestId("picker-panel")).toHaveAttribute(
		"aria-label",
		"Add a board",
	);
	await expect(page.getByTestId("picker-panel")).toContainText(
		"Catalog — Boards",
	);
	await page.getByTestId("picker-close").click();
	// Closing without placing leaves the empty-scene guidance in place.
	await expect(page.getByTestId("first-run-hint")).toBeVisible();
	await expect
		.poll(() => page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY))
		.toBeNull();
});

test("dismissing the note hides it for good", async ({ page }) => {
	await page.goto("/");
	await page.getByTestId("first-run-dismiss").click();
	await expect(page.getByTestId("first-run-hint")).toHaveCount(0);

	// Focus is handed to the visible Add-board trigger, not dropped to <body>.
	const trigger = page.getByTestId(
		isDesktop(page) ? "picker-open-board" : "picker-bar-boards",
	);
	await expect(trigger).toBeFocused();

	await expect
		.poll(() => page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY))
		.toBe("dismissed");

	await page.reload();
	await expect(page.getByTestId("first-run-hint")).toHaveCount(0);
});

test("placing the first board from the note retires it and keeps focus", async ({
	page,
}) => {
	await page.goto("/");
	await expect(page.getByTestId("first-run-hint")).toBeVisible();
	await page.getByTestId("first-run-cta").click();
	await page.getByTestId("add-board-boss-bcb-1000").click();
	await expect(page.getByTestId("stage")).toHaveAttribute("data-boards", "1");
	await expect(page.getByTestId("first-run-hint")).toHaveCount(0);

	// The opener (the note) unmounted with the placement; focus must land on the
	// stable Add-board trigger rather than dropping to <body>.
	await expect(
		page.getByTestId(
			isDesktop(page) ? "picker-open-board" : "picker-bar-boards",
		),
	).toBeFocused();

	// A restored non-empty scene never flashes it either.
	await page.reload();
	await expect(page.getByTestId("first-run-hint")).toHaveCount(0);
});

test("a loose pedal also retires the note", async ({ page }) => {
	await page.goto("/");
	await expect(page.getByTestId("first-run-hint")).toBeVisible();
	await addPedal(page, "boss-bd-2-blues-driver");
	await expect(page.getByTestId("stage")).toHaveAttribute("data-items", "1");
	await expect(page.getByTestId("first-run-hint")).toHaveCount(0);
});
