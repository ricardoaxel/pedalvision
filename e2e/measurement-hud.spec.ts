import { expect, type Page, test } from "@playwright/test";
import { addBoard, addPedal, openPicker } from "./picker.ts";
import { board, item, shareHash } from "./share.ts";
import { firstItemScreenCentre } from "./stage.ts";

/**
 * F-03 — viewport + grid readout and the transient measure tool.
 * "view W × H · grid N cm" says how much canvas is visible and the dot pitch.
 */

const PX_PER_CM = 4;

async function stageBox(page: Page) {
	const box = await page.getByTestId("stage").boundingBox();
	if (!box) throw new Error("stage has no bounding box");
	return box;
}

async function readView(page: Page) {
	const readout = page.getByTestId("scale-readout");
	return {
		readout,
		width: Number(await readout.getAttribute("data-view-width-cm")),
		height: Number(await readout.getAttribute("data-view-height-cm")),
		grid: Number(await readout.getAttribute("data-grid-cm")),
	};
}

async function firstBoardScreen(page: Page) {
	const stage = page.getByTestId("stage");
	const box = await stage.boundingBox();
	if (!box) throw new Error("stage has no bounding box");
	const scale = Number(await stage.getAttribute("data-scale")) || 1;
	const vx = Number(await stage.getAttribute("data-x")) || 0;
	const vy = Number(await stage.getAttribute("data-y")) || 0;
	const [widthCm] = ((await stage.getAttribute("data-board-sizes")) ?? "")
		.split(",")[0]
		.split("x")
		.map(Number);
	const [x, y] = ((await stage.getAttribute("data-positions")) ?? "")
		.split(";")[0]
		.split(",")
		.map(Number);
	const left = box.x + x * PX_PER_CM * scale + vx;
	const top = box.y + y * PX_PER_CM * scale + vy;
	return { left, top, widthPx: widthCm * PX_PER_CM * scale, widthCm };
}

async function expandDetails(page: Page): Promise<void> {
	const expand = page.getByTestId("info-expand");
	if (await expand.isVisible()) await expand.click();
}

test("an empty sheet already shows the view/dots readout", async ({ page }) => {
	await page.goto("/");
	const readout = page.getByTestId("scale-readout");
	await expect(readout).toBeVisible();
	await expect(readout).toContainText("view");
	await expect(readout).toContainText("grid");
	await expect(readout).toHaveAttribute("data-grid-cm", "5");
});

test("desktop readout reports the visible cm and dot pitch, and follows zoom", async ({
	page,
}, testInfo) => {
	test.skip(testInfo.project.name.startsWith("mobile"));
	await page.goto("/");
	await addBoard(page, "boss-bcb-1000");

	const { readout, width, height, grid } = await readView(page);
	await expect(readout).toBeVisible();
	const box = await stageBox(page);
	const scale = Number(
		await page.getByTestId("stage").getAttribute("data-scale"),
	);
	expect(width).toBeCloseTo(box.width / (PX_PER_CM * scale), 1);
	expect(height).toBeCloseTo(box.height / (PX_PER_CM * scale), 1);
	expect(grid).toBe(5);
	const viewport = page.viewportSize();
	expect(box.height).toBeCloseTo((viewport?.height ?? 720) - 26, 0);
	const readoutBox = await readout.boundingBox();
	expect(readoutBox?.x ?? 0).toBeCloseTo(16, 0);
	expect((readoutBox?.y ?? 0) + (readoutBox?.height ?? 0)).toBeCloseTo(
		viewport?.height ?? 720,
		0,
	);

	// Pan doesn't change the viewport area.
	await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.7);
	await page.mouse.down();
	await page.mouse.move(
		box.x + box.width * 0.2 + 220,
		box.y + box.height * 0.7 + 80,
		{ steps: 6 },
	);
	await page.mouse.up();
	await expect(readout).toHaveAttribute("data-view-width-cm", String(width));

	// Zooming in shows less cm; the dot pitch re-steps on the LOD.
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	await page.mouse.wheel(0, -400);
	await expect
		.poll(async () => Number(await readout.getAttribute("data-view-width-cm")))
		.toBeLessThan(width);
	const zoomed = await readView(page);
	expect(zoomed.width).toBeGreaterThan(0);
	expect(zoomed.grid).toBeGreaterThanOrEqual(5);
});

test("desktop readout units and the info rail update the view", async ({
	page,
}, testInfo) => {
	test.skip(testInfo.project.name.startsWith("mobile"));
	await page.goto("/");
	await addBoard(page, "boss-bcb-1000");
	const before = await readView(page);
	await addPedal(page, "boss-bd-2-blues-driver");
	const after = await readView(page);
	await expect(after.readout).toBeVisible();
	expect(after.width).toBeLessThan(before.width);
	await expect(after.readout).toHaveAttribute("data-units", "cm");

	await page.getByTestId("scale-readout-unit-in").click();
	await expect(after.readout).toHaveAttribute("data-units", "in");
	await expect(after.readout).toContainText("grid");
	await expect(after.readout).toContainText("grid 2 in");
	await page.getByTestId("scale-readout-unit-cm").click();
	await expect(after.readout).toHaveAttribute("data-units", "cm");
});

test("mobile readout sits above the info peek and stays while editing", async ({
	page,
}, testInfo) => {
	test.skip(!testInfo.project.name.startsWith("mobile"));
	await page.goto("/");
	await addBoard(page, "boss-bcb-1000");
	const { readout } = await readView(page);
	await expect(readout).toBeVisible();
	await expect(readout).toHaveAttribute("data-mobile", "true");
	await addPedal(page, "boss-bd-2-blues-driver");
	const panel = page.getByTestId("info-panel");
	await expect(panel).toBeVisible();
	await expect(readout).toBeVisible();
	const peek = await panel.boundingBox();
	const floating = await readout.boundingBox();
	expect((floating?.y ?? 0) + (floating?.height ?? 0)).toBeLessThanOrEqual(
		(peek?.y ?? 0) - 12,
	);
	await expandDetails(page);
	await page.getByTestId("info-units-in").click();
	await expect(readout).toHaveAttribute("data-units", "in");
	await page.getByTestId("info-close").click();
	await expect(readout).toBeVisible();
	// Modals cover it but do not remove the readout.
	await openPicker(page, "pedals");
	await expect(readout).toHaveCount(1);
	await page.getByTestId("picker-close").click();
	await expect(readout).toBeVisible();
});

test("mobile readout stays with a custom board action bar", async ({
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
	await expect(page.getByTestId("scale-readout")).toBeVisible();
});

test("measure mode snaps a board edge and switches units", async ({ page }) => {
	await page.goto("/");
	await addBoard(page, "boss-bcb-1000");
	const rect = await firstBoardScreen(page);

	await page.getByTestId("measure-toggle").click();
	await expect(page.getByTestId("measure-overlay")).toBeVisible();
	await expect(page.getByTestId("measure-status")).toContainText(
		"Drag to measure",
	);

	await page.mouse.move(rect.left + 2, rect.top + 2);
	await page.mouse.down();
	await page.mouse.move(rect.left + 30, rect.top + 10, { steps: 4 });
	await page.mouse.move(rect.left + rect.widthPx, rect.top, { steps: 8 });
	await page.mouse.up();
	await expect(page.getByTestId("measure-chip")).toHaveText(
		`${Math.round(rect.widthCm * 10) / 10} cm`,
	);

	await page.getByTestId("scale-readout-unit-in").click();
	await expect(page.getByTestId("scale-readout")).toHaveAttribute(
		"data-units",
		"in",
	);
	await expect(page.getByTestId("measure-chip")).toContainText("in");

	await page.getByTestId("measure-clear").click();
	await expect(page.getByTestId("measure-chip")).toHaveCount(0);
	await expect(page.getByTestId("measure-overlay")).toBeVisible();
	await page.getByTestId("measure-toggle").click();
	await expect(page.getByTestId("measure-overlay")).toHaveCount(0);
});

test("measure snaps a pedal corner and Esc exits", async ({ page }) => {
	await page.goto("/");
	await addBoard(page, "boss-bcb-1000");
	await addPedal(page, "boss-bd-2-blues-driver");
	await page.getByTestId("measure-toggle").click();
	await expect(page.getByTestId("measure-overlay")).toBeVisible();
	const centre = await firstItemScreenCentre(page, {
		widthCm: 7.3,
		heightCm: 13.02,
	});
	const halfW = (7.3 * PX_PER_CM) / 2;
	const halfH = (13.02 * PX_PER_CM) / 2;
	await page.mouse.move(centre.x - halfW + 2, centre.y - halfH + 2);
	await page.mouse.down();
	await page.mouse.move(centre.x + halfW, centre.y - halfH, { steps: 8 });
	await page.mouse.up();
	await expect(page.getByTestId("measure-chip")).toHaveText("7.3 cm");
	await page.keyboard.press("Escape");
	await expect(page.getByTestId("measure-overlay")).toHaveCount(0);
});

test("readout dot pitch follows the zoom LOD", async ({ page }) => {
	await page.goto("/");
	await addBoard(page, "boss-bcb-1000");
	const { readout } = await readView(page);
	await expect(readout).toHaveAttribute("data-grid-cm", "5");
	const box = await stageBox(page);
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	for (let index = 0; index < 8; index++) {
		const current = Number(
			await page.getByTestId("stage").getAttribute("data-scale"),
		);
		if (current < 0.3) break;
		await page.mouse.wheel(0, 900);
		await page.waitForTimeout(80);
	}
	await expect
		.poll(async () =>
			Number(await page.getByTestId("stage").getAttribute("data-scale")),
		)
		.toBeLessThan(0.3);
	await expect(readout).toHaveAttribute("data-grid-cm", "20");
	await expect(readout).toContainText("grid");
});

test("read-only shares can measure without mutating the scene", async ({
	page,
}) => {
	const hash = shareHash({ boards: [board("b1")], items: [] });
	await page.goto(`/?share=1${hash}`);
	await expect(page.getByTestId("share-stamp")).toBeVisible();
	const rect = await firstBoardScreen(page);
	await page.getByTestId("measure-toggle").click();
	await page.mouse.move(rect.left + 2, rect.top + 2);
	await page.mouse.down();
	await page.mouse.move(rect.left + rect.widthPx, rect.top, { steps: 8 });
	await page.mouse.up();
	await expect(page.getByTestId("measure-chip")).toHaveText(
		`${Math.round(rect.widthCm * 10) / 10} cm`,
	);
	await expect(page.getByTestId("stage")).toHaveAttribute("data-boards", "1");
});

test("read-only shares keep the view readout", async ({ page }, testInfo) => {
	const hash = shareHash({
		boards: [board("b1")],
		items: [item("i1", { boardUid: "b1" })],
	});
	await page.goto(`/?share=1${hash}`);
	await expect(page.getByTestId("share-stamp")).toBeVisible();
	const readout = page.getByTestId("scale-readout");
	await expect(readout).toBeVisible();
	await expect(readout).toHaveAttribute("data-units", "cm");
	if (testInfo.project.name.startsWith("mobile")) {
		await expect(readout).toHaveAttribute("data-mobile", "true");
	}
});
