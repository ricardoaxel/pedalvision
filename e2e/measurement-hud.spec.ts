import { expect, type Page, test } from "@playwright/test";
import { addBoard, addPedal, openPicker } from "./picker.ts";
import { board, item, shareHash } from "./share.ts";

/**
 * F-03 — "Sheet Margin": left + bottom outside-gutter rulers and the flat
 * bottom-right scale block. Desktop runs the sheet; mobile runs the compact
 * bottom-right readout only.
 */

const PX_PER_CM = 4;

async function stageBox(page: Page) {
	const box = await page.getByTestId("stage").boundingBox();
	if (!box) throw new Error("stage has no bounding box");
	return box;
}

test("desktop rulers sit outside the canvas and follow pan + zoom", async ({
	page,
}, testInfo) => {
	test.skip(testInfo.project.name.startsWith("mobile"));
	await page.goto("/");
	await addBoard(page, "boss-bcb-1000");

	const rules = page.getByTestId("edge-rules");
	await expect(rules).toBeVisible();
	await expect(rules).toHaveAttribute("data-units", "cm");
	await expect(rules).toHaveAttribute("data-gutter-x", "24");
	await expect(rules).toHaveAttribute("data-gutter-y", "24");
	await expect(rules).toHaveAttribute("data-major-label", "50");
	await expect(rules).toHaveAttribute("data-minor-label", "25");

	// The stage is inset; chrome keeps its base offsets (no shift).
	const box = await stageBox(page);
	expect(box.x).toBeGreaterThanOrEqual(24);
	expect(box.y).toBeCloseTo(0, 0);
	const scene = await page.getByTestId("scene-open").boundingBox();
	expect(scene?.x ?? 0).toBeLessThanOrEqual(32);
	expect(scene?.y ?? 0).toBeLessThanOrEqual(24);

	// Rendered labels are the same per-axis list the data hooks expose.
	const leftLabels = ((await rules.getAttribute("data-left-labels")) ?? "")
		.split(",")
		.filter(Boolean);
	const bottomLabels = ((await rules.getAttribute("data-bottom-labels")) ?? "")
		.split(",")
		.filter(Boolean);
	await expect(rules.locator('[data-axis="left"]')).toHaveText(leftLabels);
	await expect(rules.locator('[data-axis="bottom"]')).toHaveText(bottomLabels);

	// Pan on empty canvas: world labels move.
	const before = await rules.getAttribute("data-bottom-labels");
	await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.7);
	await page.mouse.down();
	await page.mouse.move(
		box.x + box.width * 0.2 + 140,
		box.y + box.height * 0.7 + 90,
		{ steps: 5 },
	);
	await page.mouse.up();
	await expect
		.poll(async () => rules.getAttribute("data-bottom-labels"))
		.not.toBe(before);

	// Zoom in: the sparse cadence steps and minors stay half-major.
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	await page.mouse.wheel(0, -400);
	await expect
		.poll(async () => Number(await rules.getAttribute("data-major-label")))
		.toBeLessThan(50);
	const major = Number(await rules.getAttribute("data-major-label"));
	const minor = Number(await rules.getAttribute("data-minor-label"));
	expect(minor * 2).toBe(major);
});

test("desktop title block is true-length and the unit toggle is quiet", async ({
	page,
}, testInfo) => {
	test.skip(testInfo.project.name.startsWith("mobile"));
	await page.goto("/");
	await addBoard(page, "boss-bcb-1000");

	const tag = page.getByTestId("scale-tag");
	await expect(tag).toBeVisible();
	await expect(tag).toHaveAttribute("data-zoom", "100");
	await expect(tag).toHaveAttribute("data-units", "cm");
	await expect(tag).toHaveAttribute("data-length-label", "20");
	await expect(tag).toHaveAttribute("data-length-cm", "20");
	await expect(tag).toHaveAttribute("data-bar-px", "80");
	await expect(tag).toHaveAttribute("data-grid-cm", "6");
	await expect(page.getByTestId("scale-tag-grid")).toContainText("grid 6 cm");

	// The drawn rule never lies about the scale.
	const scale = Number(
		await page.getByTestId("stage").getAttribute("data-scale"),
	);
	const barCm = Number(await tag.getAttribute("data-length-cm"));
	const barPx = Number(await tag.getAttribute("data-bar-px"));
	expect(barPx).toBeCloseTo(barCm * PX_PER_CM * scale, 5);

	await page.getByTestId("scale-tag-unit-in").click();
	await expect(tag).toHaveAttribute("data-units", "in");
	await expect(tag).toHaveAttribute("data-length-label", "10");
	await expect(tag).toHaveAttribute("data-length-cm", "25.4");
	await expect(tag).toHaveAttribute("data-grid-cm", "6");
	await expect(page.getByTestId("scale-tag-grid")).toContainText(
		"grid 2.36 in",
	);

	await page.getByTestId("scale-tag-unit-cm").click();
	await expect(tag).toHaveAttribute("data-units", "cm");
});

test("mobile is a compact bottom-right readout, hidden while editing", async ({
	page,
}, testInfo) => {
	test.skip(!testInfo.project.name.startsWith("mobile"));
	await page.goto("/");
	await addBoard(page, "boss-bcb-1000");

	await expect(page.getByTestId("edge-rules")).toHaveCount(0);
	const tag = page.getByTestId("scale-tag");
	await expect(tag).toBeVisible();
	await expect(tag).toHaveAttribute("data-mobile", "true");
	await expect(page.getByTestId("scale-tag-unit-in")).toBeVisible();
	await page.getByTestId("scale-tag-unit-in").click();
	await expect(tag).toHaveAttribute("data-units", "in");
	await page.getByTestId("scale-tag-unit-cm").click();
	await expect(tag).toHaveAttribute("data-units", "cm");

	await addPedal(page, "boss-bd-2-blues-driver");
	await expect(page.getByTestId("info-panel")).toBeVisible();
	await expect(tag).toBeHidden();

	await page.getByTestId("info-close").click();
	await expect(tag).toBeVisible();
});

test("mobile tag yields to a custom board action bar", async ({
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
	await expect(page.getByTestId("scale-tag")).toBeHidden();
});

test("read-only shares keep the sheet margins and the scale block", async ({
	page,
}, testInfo) => {
	const hash = shareHash({
		boards: [board("b1")],
		items: [item("i1", { boardUid: "b1" })],
	});
	await page.goto(`/?share=1${hash}`);
	await expect(page.getByTestId("share-stamp")).toBeVisible();

	const rules = page.getByTestId("edge-rules");
	const tag = page.getByTestId("scale-tag");
	if (testInfo.project.name.startsWith("mobile")) {
		await expect(rules).toHaveCount(0);
		await page.getByTestId("scale-tag-unit-in").click();
		await expect(tag).toHaveAttribute("data-units", "in");
	} else {
		await expect(rules).toBeVisible();
		await page.getByTestId("scale-tag-unit-in").click();
		await expect(tag).toHaveAttribute("data-units", "in");
	}
	await expect(tag).toBeVisible();
	await expect(tag).toHaveAttribute("data-zoom", "100");
});
