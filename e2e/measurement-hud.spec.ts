import { expect, type Page, test } from "@playwright/test";
import { addBoard, addPedal } from "./picker.ts";
import { item, shareHash } from "./share.ts";

/**
 * F-03 — Measurement HUD ("Scale Rule"). Runs on the desktop project and the
 * `mobile-chromium` project: the rule is anchored bottom-left on both, rides the
 * mobile info peek, and must stay true-length at every zoom.
 */

const PX_PER_CM = 4;

async function expandDetails(page: Page): Promise<void> {
	const expand = page.getByTestId("info-expand");
	if (await expand.isVisible()) await expand.click();
}

test("reads the selected part's real size and follows the cm/in setting", async ({
	page,
}, testInfo) => {
	const mobile = testInfo.project.name.startsWith("mobile");
	await page.goto("/");
	await addBoard(page, "boss-bcb-1000");
	await addPedal(page, "boss-bd-2-blues-driver");

	const hud = page.getByTestId("measurement-hud");
	const size = page.getByTestId("measurement-size");
	await expect(hud).toBeVisible();
	if (mobile) {
		// The mobile info peek already prints the size right below the rule; the
		// HUD deliberately drops the duplicate row.
		await expect(size).toBeHidden();
	} else {
		await expect(size).toContainText("7.3 × 13.02 cm");
	}

	// The HUD shares the app-wide unit setting with the info panel.
	await expandDetails(page);
	if (mobile) await expect(hud).toBeHidden();
	await page.getByTestId("info-units-in").click();
	await expect(hud).toHaveAttribute("data-unit", "in");
	await expect(page.getByTestId("info-dims")).toContainText("2.87 × 5.13 in");
	if (!mobile) await expect(size).toContainText("2.87 × 5.13 in");

	await page.getByTestId("info-units-cm").click();
	await expect(page.getByTestId("info-dims")).toContainText("7.3 × 13.02 cm");
	if (!mobile) await expect(size).toContainText("7.3 × 13.02 cm");

	if (mobile) {
		await page.getByTestId("info-expand").click();
		await expect(hud).toBeVisible();
	}
});

test("draws a true-length rule and reports the live zoom", async ({ page }) => {
	await page.goto("/");
	// An empty mobile scene shows the first-run note, which deliberately
	// outranks the HUD; add a board so the ambient rule is visible.
	await addBoard(page, "boss-bcb-1000");
	const stage = page.getByTestId("stage");
	const hud = page.getByTestId("measurement-hud");
	await expect(stage.locator("canvas").first()).toBeVisible();
	await expect(hud).toBeVisible();

	const zoomBefore = Number(await hud.getAttribute("data-zoom"));
	expect(zoomBefore).toBe(100);

	const box = await stage.boundingBox();
	if (!box) throw new Error("stage has no bounding box");
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	await page.mouse.wheel(0, -400);

	await expect
		.poll(async () => Number(await hud.getAttribute("data-zoom")))
		.toBeGreaterThan(zoomBefore);

	const scale = Number(await stage.getAttribute("data-scale"));
	const zoom = Number(await hud.getAttribute("data-zoom"));
	const barCm = Number(await hud.getAttribute("data-bar-cm"));
	const barPx = Number(await hud.getAttribute("data-bar-px"));

	expect(zoom).toBe(Math.round(scale * 100));
	// The rule is always drawn at its true length: cm × PX_PER_CM × scale.
	expect(barPx).toBeCloseTo(barCm * PX_PER_CM * scale, 1);
	expect(barPx).toBeGreaterThan(0);
	expect(barPx).toBeLessThanOrEqual(120);
});

test("read-only shares keep the measurement readout", async ({ page }) => {
	await page.goto(`/?share=1${shareHash({ boards: [], items: [item("i1")] })}`);
	await expect(page.getByTestId("share-stamp")).toBeVisible();
	const hud = page.getByTestId("measurement-hud");
	await expect(hud).toBeVisible();
	await expect(hud).toHaveAttribute("data-zoom", "100");
	// A read-only share measures exactly the same way; no edit controls appear.
	await expect(hud.locator("button")).toHaveCount(0);
});
