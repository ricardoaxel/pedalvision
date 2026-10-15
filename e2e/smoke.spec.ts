import { expect, test } from "@playwright/test";

test("app loads and renders the canvas stage", async ({ page }) => {
	await page.goto("/");
	const stage = page.getByTestId("stage");
	await expect(stage).toBeVisible();
	// The stage has one canvas per Konva layer (grid, boards).
	await expect(stage.locator("canvas").first()).toBeVisible();
});

test("wheel zooms to the pointer (stage transform changes)", async ({
	page,
}) => {
	await page.goto("/");
	const stage = page.getByTestId("stage");
	await expect(stage).toBeVisible();
	await expect(stage.locator("canvas").first()).toBeVisible();

	const before = Number(await stage.getAttribute("data-scale"));
	const box = await stage.boundingBox();
	if (!box) throw new Error("stage has no bounding box");
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
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

test("wheel during a drag is ignored (no stale-baseline jump)", async ({
	page,
}) => {
	await page.goto("/");
	const stage = page.getByTestId("stage");
	await expect(stage).toBeVisible();

	const box = await stage.boundingBox();
	if (!box) throw new Error("stage has no bounding box");
	const startX = box.x + box.width / 2;
	const startY = box.y + box.height / 2;

	await page.mouse.move(startX, startY);
	await page.mouse.down();
	await page.mouse.move(startX + 60, startY + 40, { steps: 4 });

	const scaleDuringDrag = Number(await stage.getAttribute("data-scale"));
	// The wheel is suppressed while a gesture is in flight, so it must not zoom…
	await page.mouse.wheel(0, -400);
	expect(Number(await stage.getAttribute("data-scale"))).toBe(scaleDuringDrag);

	// …and the pan must continue from where it was (no revert/jump).
	const xBefore = Number(await stage.getAttribute("data-x"));
	await page.mouse.move(startX + 140, startY + 100, { steps: 4 });
	expect(Number(await stage.getAttribute("data-x"))).toBeGreaterThan(xBefore);
	expect(Number(await stage.getAttribute("data-scale"))).toBe(scaleDuringDrag);

	await page.mouse.up();
});

test("adding a board places a selectable node at the viewport centre", async ({
	page,
}) => {
	await page.goto("/");
	const stage = page.getByTestId("stage");
	await expect(stage).toBeVisible();
	await expect(stage).toHaveAttribute("data-boards", "0");

	await page.getByTestId("add-board-boss-bcb-1000").click();
	await expect(stage).toHaveAttribute("data-boards", "1");

	// The board lands at the viewport centre, so a click there must hit the
	// Konva node (selecting it and revealing the remove control). A click on
	// empty canvas would clear selection instead.
	const box = await stage.boundingBox();
	if (!box) throw new Error("stage has no bounding box");
	await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
	await expect(page.getByTestId("remove-board")).toBeVisible();
});

test("rotating a selected board via the Transformer handle changes its rotation", async ({
	page,
}) => {
	await page.goto("/");
	const stage = page.getByTestId("stage");
	await expect(stage).toBeVisible();

	await page.getByTestId("add-board-boss-bcb-1000").click();
	await expect(stage).toHaveAttribute("data-boards", "1");
	await expect(stage).toHaveAttribute("data-rotations", "0");
	await page.waitForTimeout(150);

	const box = await stage.boundingBox();
	if (!box) throw new Error("stage has no bounding box");
	const cx = box.x + box.width / 2;
	const cy = box.y + box.height / 2;

	// Select the board (placed at the viewport centre).
	await page.mouse.click(cx, cy);
	await expect(page.getByTestId("remove-board")).toBeVisible();

	// Drag the rotate handle (28 px above the board's top edge at zoom 1;
	// PX_PER_CM 4 × heightCm 35.23 / 2 ≈ 70 px).
	await page.mouse.move(cx, cy - 98);
	await page.mouse.down();
	await page.mouse.move(cx + 130, cy - 30, { steps: 12 });
	await page.mouse.up();

	await expect
		.poll(async () => Number(await stage.getAttribute("data-rotations")))
		.not.toBe(0);
});
