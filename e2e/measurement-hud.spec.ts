import { expect, type Page, test } from "@playwright/test";
import { addBoard, addPedal, openPicker } from "./picker.ts";
import { board, item, shareHash } from "./share.ts";

/**
 * F-03 — "Pencil Margin": a 10/22 px outside margin, one faint bottom axis
 * (`0` + 100/200/300), and a tiny mobile `[bar] 10 cm` readout. Units live in
 * the info panel.
 */

async function stageBox(page: Page) {
	const box = await page.getByTestId("stage").boundingBox();
	if (!box) throw new Error("stage has no bounding box");
	return box;
}

async function expandDetails(page: Page): Promise<void> {
	const expand = page.getByTestId("info-expand");
	if (await expand.isVisible()) await expand.click();
}

test("desktop pencil margins sit outside the canvas and follow pan + zoom", async ({
	page,
}, testInfo) => {
	test.skip(testInfo.project.name.startsWith("mobile"));
	await page.goto("/");
	await addBoard(page, "boss-bcb-1000");

	const rules = page.getByTestId("edge-rules");
	await expect(rules).toBeVisible();
	await expect(rules).toHaveAttribute("data-units", "cm");
	await expect(rules).toHaveAttribute("data-gutter-x", "10");
	await expect(rules).toHaveAttribute("data-gutter-y", "22");
	await expect(rules).toHaveAttribute("data-major-label", "100");
	await expect(rules).toHaveAttribute("data-minor-label", "50");
	await expect(rules.locator('[data-axis="left"]')).toHaveCount(0);

	// The stage is inset; chrome keeps its base offsets (no shift).
	const box = await stageBox(page);
	expect(box.x).toBeGreaterThanOrEqual(10);
	expect(box.y).toBeCloseTo(0, 0);
	const scene = await page.getByTestId("scene-open").boundingBox();
	expect(scene?.x ?? 0).toBeLessThanOrEqual(24);
	expect(scene?.y ?? 0).toBeLessThanOrEqual(24);
	// The origin tick is exactly the stage's left edge (no label-air offset).
	expect(Number(await rules.getAttribute("data-origin-x"))).toBeCloseTo(
		box.x,
		0,
	);
	await expect(page.getByTestId("scale-a11y")).toHaveText("Scale: 20 cm");

	// Bottom labels are world coordinates, sparse, and match the data hook.
	const bottomLabels = ((await rules.getAttribute("data-bottom-labels")) ?? "")
		.split(",")
		.filter(Boolean);
	expect(bottomLabels.length).toBeLessThanOrEqual(4);
	expect(bottomLabels[0]).toBe("0");
	expect(bottomLabels[1]).toBe("100");
	await expect(rules.locator('[data-axis="bottom"]')).toHaveText(bottomLabels);

	// Pan on empty canvas: world labels move.
	const before = await rules.getAttribute("data-bottom-labels");
	await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.7);
	await page.mouse.down();
	await page.mouse.move(
		box.x + box.width * 0.2 + 520,
		box.y + box.height * 0.7 + 90,
		{ steps: 8 },
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
		.toBeLessThan(100);
	const major = Number(await rules.getAttribute("data-major-label"));
	const minor = Number(await rules.getAttribute("data-minor-label"));
	expect(minor * 2).toBe(major);
});

test("desktop axis units follow the info panel; no duplicate bar", async ({
	page,
}, testInfo) => {
	test.skip(testInfo.project.name.startsWith("mobile"));
	await page.goto("/");
	await addBoard(page, "boss-bcb-1000");
	await addPedal(page, "boss-bd-2-blues-driver");

	const rules = page.getByTestId("edge-rules");
	await expect(rules).toBeVisible();
	await expect(rules).toHaveAttribute("data-units", "cm");
	await expect(page.getByTestId("scale-tag")).toHaveCount(0);
	await expect(page.getByTestId("edge-rules-unit")).toHaveText("cm");

	await expandDetails(page);
	await page.getByTestId("info-units-in").click();
	await expect(rules).toHaveAttribute("data-units", "in");
	await expect(page.getByTestId("edge-rules-unit")).toHaveText("in");
	await page.getByTestId("info-units-cm").click();
	await expect(page.getByTestId("edge-rules-unit")).toHaveText("cm");
});

test("mobile is a tiny bottom-right readout, hidden while editing", async ({
	page,
}, testInfo) => {
	test.skip(!testInfo.project.name.startsWith("mobile"));
	await page.goto("/");
	await addBoard(page, "boss-bcb-1000");

	await expect(page.getByTestId("edge-rules")).toHaveCount(0);
	const tag = page.getByTestId("scale-tag");
	await expect(tag).toBeVisible();
	await expect(tag).toHaveAttribute("data-mobile", "true");
	await expect(tag).toHaveAttribute("data-length-label", "10");
	const mobileScale = Number(
		await page.getByTestId("stage").getAttribute("data-scale"),
	);
	const barCm = Number(await tag.getAttribute("data-length-cm"));
	const barPx = Number(await tag.getAttribute("data-bar-px"));
	expect(barPx).toBeCloseTo(barCm * 4 * mobileScale, 5);
	await addPedal(page, "boss-bd-2-blues-driver");
	await expect(page.getByTestId("info-panel")).toBeVisible();
	await expect(tag).toBeHidden();

	// Units change in the info panel; the readout follows on clear.
	await expandDetails(page);
	await page.getByTestId("info-units-in").click();
	await page.getByTestId("info-close").click();
	await expect(tag).toBeVisible();
	await expect(tag).toHaveAttribute("data-units", "in");
});

test("mobile readout yields to a custom board action bar", async ({
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

test("read-only shares keep the pencil margin and the readout", async ({
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
		await expect(tag).toBeVisible();
	} else {
		await expect(rules).toBeVisible();
		await expect(tag).toHaveCount(0);
		await expect(page.getByTestId("edge-rules-unit")).toHaveText("cm");
	}
});
