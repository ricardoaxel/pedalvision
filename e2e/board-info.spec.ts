import { expect, type Page, test } from "@playwright/test";
import { addBoard, addPedal, openPicker } from "./picker.ts";
import { board, shareHash } from "./share.ts";
import { firstItemScreenCentre } from "./stage.ts";

/** Click a point near the selected board's top-left corner (away from pedals). */
async function clickBoardCorner(page: Page) {
	const stage = page.getByTestId("stage");
	const box = await stage.boundingBox();
	if (!box) throw new Error("stage has no box");
	const positions = (await stage.getAttribute("data-positions")) ?? "";
	const [bx, by] = positions.split(";")[0].split(",").map(Number);
	const scale = Number(await stage.getAttribute("data-scale")) || 1;
	const vx = Number(await stage.getAttribute("data-x")) || 0;
	const vy = Number(await stage.getAttribute("data-y")) || 0;
	// Bottom-right is clear of the read-only review stamp at the top-left.
	await page.mouse.click(
		box.x + (bx + 55.88 - 3) * 4 * scale + vx,
		box.y + (by + 35.23 - 3) * 4 * scale + vy,
	);
}

async function selectBoardByCorner(page: Page) {
	// Clear any item selection first: its action bar floats under the pedal and
	// can sit over the board corner we click. Empty-canvas top-left is clear of
	// the centred board and the corner toolbar.
	const stage = page.getByTestId("stage");
	const box = await stage.boundingBox();
	if (!box) throw new Error("stage has no box");
	await page.mouse.click(box.x + 12, box.y + 12);
	await expect(page.getByTestId("item-action-bar")).toHaveCount(0);
	await expect(page.getByTestId("info-panel")).toHaveCount(0);
	await clickBoardCorner(page);
	await expect(page.getByTestId("board-action-bar")).toBeVisible();
}

test.describe("F-06 board info", () => {
	test("desktop board readout follows units and closes with the pedal rail", async ({
		page,
	}) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.goto("/");
		await addBoard(page, "boss-bcb-1000");
		await addPedal(page, "boss-bd-2-blues-driver");
		// The pedal is selected after placement; select the board again.
		await selectBoardByCorner(page);

		const panel = page.getByTestId("board-info-panel");
		await expect(panel).toBeVisible();
		await expect(panel).toContainText("BCB-1000");
		await expect(panel).toContainText("BOSS");
		await expect(page.getByTestId("board-info-kind")).toHaveText("Catalog");
		await expect(page.getByTestId("board-info-dims")).toHaveText(
			/55\.88 × 35\.23 cm/,
		);

		// Units follow the app-wide setting without a reload.
		await page.getByTestId("board-info-units-in").click();
		await expect(page.getByTestId("board-info-dims")).toHaveText(
			/22 × 13\.87 in/,
		);
		await page.getByTestId("board-info-units-cm").click();
		await expect(page.getByTestId("board-info-dims")).toHaveText(
			/55\.88 × 35\.23 cm/,
		);

		// Selecting the pedal swaps the rail in place (only one rail mounted).
		const pedal = await firstItemScreenCentre(page, {
			widthCm: 7.3,
			heightCm: 13.02,
		});
		await page.mouse.click(pedal.x, pedal.y);
		await expect(page.getByTestId("info-panel")).toBeVisible();
		await expect(page.getByTestId("board-info-panel")).toHaveCount(0);

		// Closing the selection removes the rail.
		await page.getByTestId("info-close").click();
		await expect(page.getByTestId("info-panel")).toHaveCount(0);
	});

	test("mobile board readout docks above the tab bar without covering the Margin Rule", async ({
		page,
	}) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await page.goto("/");
		await addBoard(page, "boss-bcb-1000");
		await selectBoardByCorner(page);

		const strip = page.getByTestId("board-info-strip");
		const bar = page.getByTestId("board-action-bar");
		await expect(strip).toBeVisible();
		await expect(strip).toContainText("BCB-1000");
		await expect(strip).toContainText("BOSS");
		await expect(strip).toContainText("55.88 × 35.23 cm");
		await expect(page.getByTestId("board-info-panel")).toHaveCount(0);

		// Docked above the tab bar, with the Margin Rule + nav row kept visible.
		await expect(page.locator("main")).toHaveAttribute(
			"data-board-readout",
			"open",
		);
		await expect(page.getByTestId("board-counter")).toBeVisible();
		await expect(page.locator(".scale-strip")).toHaveCSS(
			"--scale-peek-lift",
			"0px",
		);
		const stripBox = await strip.boundingBox();
		const barBox = await bar.boundingBox();
		const scaleBox = await page.locator(".scale-strip").boundingBox();
		if (!stripBox || !barBox || !scaleBox) throw new Error("missing boxes");
		// The bar clears the docked strip, and the strip clears the Margin Rule.
		expect(stripBox.y).toBeGreaterThanOrEqual(barBox.y + barBox.height);
		expect(stripBox.y).toBeGreaterThanOrEqual(scaleBox.y + scaleBox.height);
		expect(stripBox.y + stripBox.height).toBeLessThanOrEqual(844 - 56);
	});

	test("pedal → board swap clears the mobile sheet lift and never overlaps", async ({
		page,
	}) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await page.goto("/");
		await addBoard(page, "boss-bcb-1000");
		await addPedal(page, "boss-bd-2-blues-driver");
		// The pedal opens the mobile sheet and reports a lift.
		await expect(page.getByTestId("info-panel")).toBeVisible();
		await expect
			.poll(() =>
				page.evaluate(() =>
					getComputedStyle(
						document.querySelector(".scale-strip") as HTMLElement,
					).getPropertyValue("--scale-peek-lift"),
				),
			)
			.not.toBe("0px");
		await selectBoardByCorner(page);
		await expect(page.getByTestId("board-info-strip")).toBeVisible();
		await expect(page.locator(".scale-strip")).toHaveCSS(
			"--scale-peek-lift",
			"0px",
		);
		const stripBox = await page.getByTestId("board-info-strip").boundingBox();
		const scaleBox = await page.locator(".scale-strip").boundingBox();
		if (!stripBox || !scaleBox) throw new Error("missing boxes");
		expect(stripBox.y).toBeGreaterThanOrEqual(scaleBox.y + scaleBox.height);
	});

	test("read-only share shows the readout but no edit chrome", async ({
		page,
	}) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		const hash = shareHash({
			name: "Shared rig",
			boards: [board("b1")],
			items: [],
		});
		await page.goto(`/?share=1${hash}`);
		await expect(page.getByTestId("share-stamp")).toBeVisible();
		await clickBoardCorner(page);
		await expect(page.getByTestId("board-info-panel")).toBeVisible();
		await expect(page.getByTestId("board-action-bar")).toHaveCount(0);
		await expect(page.getByTestId("board-info-close")).toBeVisible();
	});

	test("read-only mobile pins the strip without an action bar", async ({
		page,
	}) => {
		await page.setViewportSize({ width: 390, height: 844 });
		const hash = shareHash({
			name: "Shared rig",
			boards: [board("b1")],
			items: [],
		});
		await page.goto(`/?share=1${hash}`);
		await expect(page.getByTestId("share-stamp")).toBeVisible();
		await page.waitForTimeout(350);
		await clickBoardCorner(page);
		await expect(page.locator("main")).toHaveAttribute(
			"data-board-readout",
			"open",
		);
		const strip = page.getByTestId("board-info-strip");
		await expect(strip).toBeVisible();
		await expect(strip).toContainText("BCB-1000");
		await expect(page.getByTestId("board-counter")).toBeVisible();
		await expect(page.getByTestId("board-action-bar")).toHaveCount(0);
		await expect(page.getByTestId("board-info-panel")).toHaveCount(0);
	});

	test("custom board reads its name, brand and finish", async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.goto("/");
		await openPicker(page, "custom");
		await page.getByTestId("custom-category-board").click();
		await page.getByTestId("board-name").fill("Big Rig");
		await page.getByTestId("board-brand").fill("Ashel");
		await page.getByTestId("board-width").fill("80");
		await page.getByTestId("board-depth").fill("40");
		await page.getByTestId("board-finish-wood").click();
		await page.getByTestId("board-submit").click();
		await expect(page.getByTestId("picker-panel")).toHaveCount(0);

		const panel = page.getByTestId("board-info-panel");
		await expect(panel).toContainText("Big Rig");
		await expect(page.getByTestId("board-info-brand")).toHaveText("Ashel");
		await expect(page.getByTestId("board-info-kind")).toHaveText("Custom");
		await expect(page.getByTestId("board-info-finish")).toHaveText("Wood");
		await expect(panel).toContainText("80 × 40 cm");
	});
});
