import { expect, type Page, test } from "@playwright/test";

/** The blues-driver fixture (seed dims 7.3 × 13.02 cm). */
const PEDAL_CM = { width: 7.3, height: 13.02 };
const PX_PER_CM = 4;

/** Board origin (world cm) and rotation from the stage's debug attributes. */
async function readBoard(stage: ReturnType<Page["getByTestId"]>) {
	const positions = (await stage.getAttribute("data-positions")) ?? "";
	const [first] = positions.split(";");
	const [x, y] = first.split(",").map(Number);
	const rotation = Number(
		((await stage.getAttribute("data-rotations")) ?? "0").split(",")[0],
	);
	return { x, y, rotation };
}

/** The single item's board-local origin (cm) and rotation. */
async function readItem(stage: ReturnType<Page["getByTestId"]>) {
	const [origin] = (
		(await stage.getAttribute("data-item-positions")) ?? ""
	).split(";");
	const [x, y] = origin.split(",").map(Number);
	const rotation = Number(
		((await stage.getAttribute("data-item-rotations")) ?? "0").split(",")[0],
	);
	return { x, y, rotation };
}

function rotatePoint(
	point: { x: number; y: number },
	deg: number,
): { x: number; y: number } {
	const rad = (deg * Math.PI) / 180;
	const cos = Math.cos(rad);
	const sin = Math.sin(rad);
	return {
		x: point.x * cos - point.y * sin,
		y: point.x * sin + point.y * cos,
	};
}

/** The item's geometric centre in world cm (board transform + item rotation). */
async function itemCentreWorld(
	stage: ReturnType<Page["getByTestId"]>,
): Promise<{ x: number; y: number }> {
	const board = await readBoard(stage);
	const item = await readItem(stage);
	const half = rotatePoint(
		{ x: PEDAL_CM.width / 2, y: PEDAL_CM.height / 2 },
		item.rotation,
	);
	const local = { x: item.x + half.x, y: item.y + half.y };
	const rotated = rotatePoint(local, board.rotation);
	return { x: rotated.x + board.x, y: rotated.y + board.y };
}

test("the action bar rotates a pedal in place across repeated presses", async ({
	page,
}) => {
	await page.goto("/");
	const stage = page.getByTestId("stage");
	await expect(stage).toBeVisible();
	await page.getByTestId("add-board-boss-bcb-1000").click();
	await page.getByTestId("add-pedal-boss-bd-2-blues-driver").click();
	await expect(stage).toHaveAttribute("data-items", "1");
	await expect(stage).toHaveAttribute("data-item-rotations", "0.00");

	const bar = page.getByTestId("item-action-bar");
	await expect(bar).toBeVisible();

	const centreBefore = await itemCentreWorld(stage);
	await page.getByTestId("rotate-item").click();
	await expect(stage).toHaveAttribute("data-item-rotations", "45.00");
	// A second press must spin about the same centre (not translate): the
	// unrotated-centre bug only shows from the second press on.
	await page.getByTestId("rotate-item").click();
	await expect(stage).toHaveAttribute("data-item-rotations", "90.00");
	const centreAfter = await itemCentreWorld(stage);
	expect(centreAfter.x).toBeCloseTo(centreBefore.x, 4);
	expect(centreAfter.y).toBeCloseTo(centreBefore.y, 4);
	// The board is unaffected by rotating a pedal on it.
	await expect(stage).toHaveAttribute("data-rotations", "0");

	// Duplicate keeps the clone selected; delete removes it and clears selection.
	await page.getByTestId("duplicate-item").click();
	await expect(stage).toHaveAttribute("data-items", "2");
	const cloneSelected = await stage.getAttribute("data-selected-item");
	expect(cloneSelected).toBeTruthy();
	await page.getByTestId("delete-item").click();
	await expect(stage).toHaveAttribute("data-items", "1");
	await expect(stage).toHaveAttribute("data-selected-item", "");
});

test("dragging the Transformer rotate handle spins a loose pedal", async ({
	page,
}) => {
	await page.goto("/");
	const stage = page.getByTestId("stage");
	await expect(stage).toBeVisible();
	// No board → the pedal drops loose at the viewport centre.
	await page.getByTestId("add-pedal-boss-bd-2-blues-driver").click();
	await expect(stage).toHaveAttribute("data-items", "1");
	await expect(stage).toHaveAttribute("data-item-parents", "loose");
	await expect(stage).toHaveAttribute("data-item-rotations", "0.00");
	await page.waitForTimeout(150);

	const box = await stage.boundingBox();
	if (!box) throw new Error("stage has no bounding box");
	const cx = box.x + box.width / 2;
	const cy = box.y + box.height / 2;

	// The rotate handle sits 26 px above the pedal's top edge (zoom 1).
	const halfHeightPx = (PEDAL_CM.height / 2) * PX_PER_CM;
	const handleY = cy - halfHeightPx - 26;
	await page.mouse.move(cx, handleY);
	await page.mouse.down();
	await page.mouse.move(cx + 120, cy - 10, { steps: 12 });
	await page.mouse.up();

	await expect
		.poll(async () => Number(await stage.getAttribute("data-item-rotations")))
		.not.toBe(0);
});

test("rotating a pedal on a rotated board is relative to the pedal (S3)", async ({
	page,
}) => {
	await page.goto("/");
	const stage = page.getByTestId("stage");
	await expect(stage).toBeVisible();

	await page.getByTestId("add-board-boss-bcb-1000").click();
	await expect(stage).toHaveAttribute("data-boards", "1");
	await page.waitForTimeout(150);

	const box = await stage.boundingBox();
	if (!box) throw new Error("stage has no bounding box");
	const cx = box.x + box.width / 2;
	const cy = box.y + box.height / 2;

	// Select + rotate the board via its handle (same geometry as the P1-03 test).
	await page.mouse.click(cx, cy);
	await expect(page.getByTestId("remove-board")).toBeVisible();
	await page.mouse.move(cx, cy - 98);
	await page.mouse.down();
	await page.mouse.move(cx + 130, cy - 30, { steps: 12 });
	await page.mouse.up();
	await expect
		.poll(async () => Number(await stage.getAttribute("data-rotations")))
		.not.toBe(0);

	const boardBefore = await readBoard(stage);

	// Add a pedal to the (still selected) board, then rotate it via the handle.
	await page.getByTestId("add-pedal-boss-bd-2-blues-driver").click();
	await expect(stage).toHaveAttribute("data-items", "1");
	await expect(stage).toHaveAttribute("data-item-parents", "0");
	await page.waitForTimeout(150);
	const item = await readItem(stage);

	// The pedal's rotate handle, in world/screen px: pedal origin + the local
	// (w/2, -26) handle offset rotated by the composed board+item rotation.
	const itemOriginWorldCm = rotatePoint(
		{ x: item.x, y: item.y },
		boardBefore.rotation,
	);
	const originPx = {
		x: (itemOriginWorldCm.x + boardBefore.x) * PX_PER_CM,
		y: (itemOriginWorldCm.y + boardBefore.y) * PX_PER_CM,
	};
	const composed = boardBefore.rotation + item.rotation;
	const handleOffset = rotatePoint(
		{ x: (PEDAL_CM.width / 2) * PX_PER_CM, y: -26 },
		composed,
	);
	const handleX = box.x + originPx.x + handleOffset.x;
	const handleY = box.y + originPx.y + handleOffset.y;

	await page.mouse.move(handleX, handleY);
	await page.mouse.down();
	await page.mouse.move(handleX + 90, handleY + 70, { steps: 12 });
	await page.mouse.up();

	await expect
		.poll(async () => (await readItem(stage)).rotation)
		.not.toBe(item.rotation);
	// The board transform is unaffected by rotating its pedal.
	const boardAfter = await readBoard(stage);
	expect(boardAfter.rotation).toBeCloseTo(boardBefore.rotation, 5);
	expect(boardAfter.x).toBeCloseTo(boardBefore.x, 5);
	expect(boardAfter.y).toBeCloseTo(boardBefore.y, 5);
	// The pedal stayed attached to the board.
	await expect(stage).toHaveAttribute("data-item-parents", "0");
});

test("hovering a pedal sets the hover target (desktop outline wiring)", async ({
	page,
}) => {
	await page.goto("/");
	const stage = page.getByTestId("stage");
	await expect(stage).toBeVisible();
	await page.getByTestId("add-pedal-boss-bd-2-blues-driver").click();
	await expect(stage).toHaveAttribute("data-items", "1");
	const selected = await stage.getAttribute("data-selected-item");
	await page.waitForTimeout(150);

	const box = await stage.boundingBox();
	if (!box) throw new Error("stage has no bounding box");
	const cx = box.x + box.width / 2;
	const cy = box.y + box.height / 2;

	// Deselect (tap empty canvas well clear of the pedal)…
	await page.mouse.click(cx + 320, cy + 220);
	await expect(stage).toHaveAttribute("data-selected-item", "");
	// …then hover the pedal: the outline target is the item under the pointer.
	await page.mouse.move(cx, cy);
	await expect(stage).toHaveAttribute("data-hovered-item", selected ?? "");
	// Moving off the pedal clears it.
	await page.mouse.move(cx + 320, cy + 220);
	await expect(stage).toHaveAttribute("data-hovered-item", "");
});
