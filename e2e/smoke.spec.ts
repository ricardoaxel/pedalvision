import { expect, test } from "@playwright/test";

test("app loads and renders the canvas stage", async ({ page }) => {
	await page.goto("/");
	const stage = page.getByTestId("stage");
	await expect(stage).toBeVisible();
	await expect(stage.locator("canvas")).toBeVisible();
});

test("wheel zooms to the pointer (stage transform changes)", async ({
	page,
}) => {
	await page.goto("/");
	const stage = page.getByTestId("stage");
	const canvas = stage.locator("canvas");
	await expect(canvas).toBeVisible();

	const before = Number(await stage.getAttribute("data-scale"));
	await canvas.hover();
	await page.mouse.wheel(0, -300);

	await expect
		.poll(async () => Number(await stage.getAttribute("data-scale")))
		.toBeGreaterThan(before);
});

test("dragging the empty canvas pans the stage", async ({ page }) => {
	await page.goto("/");
	const stage = page.getByTestId("stage");
	await expect(stage).toBeVisible();

	const before = {
		x: Number(await stage.getAttribute("data-x")),
		y: Number(await stage.getAttribute("data-y")),
	};

	const box = await stage.boundingBox();
	if (!box) throw new Error("stage has no bounding box");
	const startX = box.x + box.width / 2;
	const startY = box.y + box.height / 2;

	await page.mouse.move(startX, startY);
	await page.mouse.down();
	await page.mouse.move(startX + 120, startY + 80, { steps: 5 });
	await page.mouse.up();

	const after = {
		x: Number(await stage.getAttribute("data-x")),
		y: Number(await stage.getAttribute("data-y")),
	};
	expect(after.x - before.x).toBeGreaterThan(100);
	expect(after.y - before.y).toBeGreaterThan(70);
});
