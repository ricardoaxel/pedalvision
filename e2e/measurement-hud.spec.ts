import { expect, type Page, test } from "@playwright/test";
import { addBoard, addPedal, openPicker } from "./picker.ts";
import { board, item, shareHash } from "./share.ts";

/**
 * F-03 — "Edge Rule": reactive top/left rulers + the bottom-right Scale Tag.
 * Desktop runs the full frame; mobile runs the corner-only simplification.
 */

const PX_PER_CM = 4;

async function stageBox(page: Page) {
	const box = await page.getByTestId("stage").boundingBox();
	if (!box) throw new Error("stage has no bounding box");
	return box;
}

test("desktop rulers show world cm and follow pan + zoom", async ({
	page,
}, testInfo) => {
	test.skip(testInfo.project.name.startsWith("mobile"));
	await page.goto("/");
	await addBoard(page, "boss-bcb-1000");

	const rules = page.getByTestId("edge-rules");
	await expect(rules).toBeVisible();
	await expect(rules).toHaveAttribute("data-units", "cm");
	await expect(rules).toHaveAttribute("data-major-label", "20");
	await expect(rules).toHaveAttribute("data-minor-label", "5");
	await expect(rules).toHaveAttribute("data-major-cm", "20");

	// The rendered labels use the same visibility list the data hook exposes.
	const topLabels = ((await rules.getAttribute("data-top-labels")) ?? "")
		.split(",")
		.filter(Boolean);
	const domLabels = await rules.locator(".edge-rules__label").allTextContents();
	for (const label of topLabels) expect(domLabels).toContain(label);

	// Pan on empty canvas: labels are world coordinates, so they move.
	const before = await rules.getAttribute("data-top-labels");
	const box = await stageBox(page);
	await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.7);
	await page.mouse.down();
	await page.mouse.move(
		box.x + box.width * 0.2 + 140,
		box.y + box.height * 0.7 + 90,
		{ steps: 5 },
	);
	await page.mouse.up();
	await expect
		.poll(async () => rules.getAttribute("data-top-labels"))
		.not.toBe(before);

	// Zoom in: the 1-2-5 cadence steps 20 cm → 10 cm.
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	await page.mouse.wheel(0, -400);
	await expect
		.poll(async () => Number(await rules.getAttribute("data-major-label")))
		.toBeLessThan(20);
	await expect
		.poll(async () => Number(await rules.getAttribute("data-minor-label")))
		.toBe(2);
});

test("desktop Scale Tag is true-length and the unit toggle is quiet", async ({
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
	await expect(page.getByTestId("scale-tag-grid")).toContainText("Grid 6 cm");

	// The drawn rule never lies about the scale.
	const scale = Number(
		await page.getByTestId("stage").getAttribute("data-scale"),
	);
	const barCm = Number(await tag.getAttribute("data-length-cm"));
	const barPx = Number(await tag.getAttribute("data-bar-px"));
	expect(barPx).toBeCloseTo(barCm * PX_PER_CM * scale, 5);

	await page.getByTestId("scale-tag-units").click();
	await expect(tag).toHaveAttribute("data-units", "in");
	await expect(tag).toHaveAttribute("data-length-label", "10");
	await expect(tag).toHaveAttribute("data-length-cm", "25.4");
	await expect(tag).toHaveAttribute("data-grid-cm", "6");
	await expect(page.getByTestId("scale-tag-grid")).toContainText(
		"Grid 2.36 in",
	);

	await page.getByTestId("scale-tag-units").click();
	await expect(tag).toHaveAttribute("data-units", "cm");
});

test("mobile is corner-only: rulers hidden, tag yields to the info peek", async ({
	page,
}, testInfo) => {
	test.skip(!testInfo.project.name.startsWith("mobile"));
	await page.goto("/");
	await addBoard(page, "boss-bcb-1000");

	await expect(page.getByTestId("edge-rules")).toBeHidden();
	const tag = page.getByTestId("scale-tag");
	await expect(tag).toBeVisible();

	await addPedal(page, "boss-bd-2-blues-driver");
	await expect(page.getByTestId("info-panel")).toBeVisible();
	await expect(tag).toBeHidden();

	await page.getByTestId("info-close").click();
	await expect(tag).toBeVisible();

	// The quiet cm/in toggle still has a comfortable touch target.
	const unitBox = await page.getByTestId("scale-tag-units").boundingBox();
	expect(unitBox?.width ?? 0).toBeGreaterThanOrEqual(44);
	expect(unitBox?.height ?? 0).toBeGreaterThanOrEqual(44);
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

test("read-only shares keep the scale frame and the quiet unit toggle", async ({
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
		await expect(rules).toBeHidden();
	} else {
		await expect(rules).toBeVisible();
	}
	await expect(tag).toBeVisible();
	await expect(tag).toHaveAttribute("data-zoom", "100");
	await page.getByTestId("scale-tag-units").click();
	await expect(tag).toHaveAttribute("data-units", "in");
});
