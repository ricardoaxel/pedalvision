import { expect, type Page, test } from "@playwright/test";
import { addBoard, addPedal, openPicker } from "./picker.ts";
import { board, item, shareHash } from "./share.ts";

/**
 * F-03 — "Drafting Scale": one true-length bar in the caption strip, the same
 * artifact as the export scale bar. Desktop bottom-left, mobile bottom-right.
 */

const PX_PER_CM = 4;

async function stageBox(page: Page) {
	const box = await page.getByTestId("stage").boundingBox();
	if (!box) throw new Error("stage has no bounding box");
	return box;
}

async function expandDetails(page: Page): Promise<void> {
	const expand = page.getByTestId("info-expand");
	if (await expand.isVisible()) await expand.click();
}

test("an empty sheet has no scale bar", async ({ page }) => {
	await page.goto("/");
	await expect(page.getByTestId("scale-bar")).toHaveCount(0);
});

test("desktop drawing scale is true-length, ignores pan, and re-steps on zoom", async ({
	page,
}, testInfo) => {
	test.skip(testInfo.project.name.startsWith("mobile"));
	await page.goto("/");
	await addBoard(page, "boss-bcb-1000");

	const tag = page.getByTestId("scale-bar");
	const rules = page.getByTestId("edge-rules");
	await expect(tag).toBeVisible();
	await expect(rules).toHaveCount(0);
	await expect(tag).toHaveAttribute("data-units", "cm");
	await expect(tag).toHaveAttribute("data-length-label", "20");
	await expect(tag).toHaveAttribute("data-length-cm", "20");
	await expect(tag).toHaveAttribute("data-bar-px", "80");

	const box = await stageBox(page);
	expect(box.x).toBe(0);
	expect(box.y).toBeCloseTo(0, 0);
	expect(box.height).toBeLessThan(700);

	const scale = Number(
		await page.getByTestId("stage").getAttribute("data-scale"),
	);
	const barCm = Number(await tag.getAttribute("data-length-cm"));
	const barPx = Number(await tag.getAttribute("data-bar-px"));
	expect(barPx).toBeCloseTo(barCm * PX_PER_CM * scale, 5);
	const trackWidth = await page
		.locator(".scale-bar__track")
		.evaluate((el) => el.getBoundingClientRect().width);
	expect(trackWidth).toBeCloseTo(barPx, 0);
	const viewport = page.viewportSize();
	const barBox = await tag.boundingBox();
	expect(box.height).toBeCloseTo((viewport?.height ?? 720) - 22, 0);
	expect(barBox?.x ?? 0).toBeCloseTo(16, 0);
	expect((barBox?.y ?? 0) + (barBox?.height ?? 0)).toBeCloseTo(
		viewport?.height ?? 720,
		0,
	);

	// Pan must not touch the measurement chrome (no world-origin readout).
	const beforePan = await tag.getAttribute("data-bar-px");
	await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.7);
	await page.mouse.down();
	await page.mouse.move(
		box.x + box.width * 0.2 + 220,
		box.y + box.height * 0.7 + 80,
		{ steps: 6 },
	);
	await page.mouse.up();
	await expect(tag).toHaveAttribute("data-bar-px", beforePan ?? "");

	// Zoom re-steps the round label/bar, still true length.
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	await page.mouse.wheel(0, -400);
	await expect
		.poll(async () => Number(await tag.getAttribute("data-bar-px")))
		.not.toBe(Number(beforePan));
	const zoomedScale = Number(
		await page.getByTestId("stage").getAttribute("data-scale"),
	);
	const zoomedCm = Number(await tag.getAttribute("data-length-cm"));
	const zoomedPx = Number(await tag.getAttribute("data-bar-px"));
	expect(zoomedPx).toBeCloseTo(zoomedCm * PX_PER_CM * zoomedScale, 5);
});

test("desktop drawing scale follows the info-panel units", async ({
	page,
}, testInfo) => {
	test.skip(testInfo.project.name.startsWith("mobile"));
	await page.goto("/");
	await addBoard(page, "boss-bcb-1000");
	await addPedal(page, "boss-bd-2-blues-driver");

	const tag = page.getByTestId("scale-bar");
	await expect(tag).toBeVisible();
	await expect(tag).toHaveAttribute("data-units", "cm");
	await expect(tag).toContainText("= 20 cm");

	await expandDetails(page);
	await page.getByTestId("info-units-in").click();
	await expect(tag).toHaveAttribute("data-units", "in");
	await expect(tag).toHaveAttribute("data-length-label", "10");
	await expect(tag).toContainText("= 10 in");
	await page.getByTestId("info-units-cm").click();
	await expect(tag).toHaveAttribute("data-units", "cm");
});

test("mobile drawing scale sits bottom-right and hides while editing", async ({
	page,
}, testInfo) => {
	test.skip(!testInfo.project.name.startsWith("mobile"));
	await page.goto("/");
	await addBoard(page, "boss-bcb-1000");

	await expect(page.getByTestId("edge-rules")).toHaveCount(0);
	const tag = page.getByTestId("scale-bar");
	await expect(tag).toBeVisible();
	await expect(tag).toHaveAttribute("data-mobile", "true");
	await expect(tag).toHaveAttribute("data-length-label", "10");
	const scale = Number(
		await page.getByTestId("stage").getAttribute("data-scale"),
	);
	const barCm = Number(await tag.getAttribute("data-length-cm"));
	const barPx = Number(await tag.getAttribute("data-bar-px"));
	expect(barPx).toBeCloseTo(barCm * PX_PER_CM * scale, 5);
	const trackWidth = await page
		.locator(".scale-bar__track")
		.evaluate((el) => el.getBoundingClientRect().width);
	expect(trackWidth).toBeCloseTo(barPx, 0);
	const viewport = page.viewportSize();
	const barBox = await tag.boundingBox();
	expect((barBox?.x ?? 0) + (barBox?.width ?? 0)).toBeCloseTo(
		(viewport?.width ?? 412) - 16,
		0,
	);
	expect((barBox?.y ?? 0) + (barBox?.height ?? 0)).toBeCloseTo(
		(viewport?.height ?? 839) - 72,
		0,
	);

	await addPedal(page, "boss-bd-2-blues-driver");
	const panel = page.getByTestId("info-panel");
	await expect(panel).toBeVisible();
	// The scale stays visible while editing, lifted above the info peek.
	await expect(tag).toBeVisible();
	const peek = await panel.boundingBox();
	const floating = await tag.boundingBox();
	expect((floating?.y ?? 0) + (floating?.height ?? 0)).toBeLessThanOrEqual(
		(peek?.y ?? 0) - 12,
	);

	// Units change in the info panel; the bar follows without hiding.
	await expandDetails(page);
	await page.getByTestId("info-units-in").click();
	await expect(tag).toHaveAttribute("data-units", "in");
	await expect(tag).toContainText("= 2 in");
	await page.getByTestId("info-close").click();
	await expect(tag).toBeVisible();

	// The picker/tray still yields; editing does not.
	await openPicker(page, "pedals");
	await expect(tag).toBeHidden();
	await page.getByTestId("picker-close").click();
	await expect(tag).toBeVisible();
});

test("mobile drawing scale yields to a custom board action bar", async ({
	page,
}, testInfo) => {
	test.skip(!testInfo.project.name.startsWith("mobile"));
	await page.goto("/");
	await openPicker(page, "custom");
	await page.getByTestId("custom-category-board").click();
	await page.getByTestId("board-name").fill("HUD board");
	await page.getByTestId("board-width").fill("60");
	await page.getByTestId("board-depth").fill("40");
	await page.getByTestId("board-submit").click();
	await expect(page.getByTestId("picker-panel")).toHaveCount(0);
	const box = await stageBox(page);
	await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
	await expect(page.getByTestId("board-action-bar")).toBeVisible();
	await expect(page.getByTestId("scale-bar")).toBeVisible();
});

test("read-only shares keep the drawing scale", async ({ page }, testInfo) => {
	const hash = shareHash({
		boards: [board("b1")],
		items: [item("i1", { boardUid: "b1" })],
	});
	await page.goto(`/?share=1${hash}`);
	await expect(page.getByTestId("share-stamp")).toBeVisible();

	const tag = page.getByTestId("scale-bar");
	await expect(tag).toBeVisible();
	await expect(tag).toHaveAttribute("data-units", "cm");
	if (testInfo.project.name.startsWith("mobile")) {
		await expect(tag).toHaveAttribute("data-mobile", "true");
	}
});
