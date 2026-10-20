import { expect, type Page, test } from "@playwright/test";
import { addBoard, addPedal } from "./picker.ts";
import { firstItemScreenCentre } from "./stage.ts";

/** The blues-driver fixture (seed dims 7.3 × 13.02 cm). */
const PEDAL_CM = { widthCm: 7.3, heightCm: 13.02 };
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
		{ x: PEDAL_CM.widthCm / 2, y: PEDAL_CM.heightCm / 2 },
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
	await addBoard(page, "boss-bcb-1000");
	await addPedal(page, "boss-bd-2-blues-driver");
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
	await addPedal(page, "boss-bd-2-blues-driver");
	await expect(stage).toHaveAttribute("data-items", "1");
	await expect(stage).toHaveAttribute("data-item-parents", "loose");
	await expect(stage).toHaveAttribute("data-item-rotations", "0.00");
	await page.waitForTimeout(150);

	// The info rail (P2-03) narrows the canvas when the pedal is selected, so
	// locate the pedal from the stage state rather than the window centre.
	const { x: cx, y: cy } = await firstItemScreenCentre(page, PEDAL_CM);

	// The rotate handle sits 30 px above the pedal's top edge (zoom 1).
	const halfHeightPx = (PEDAL_CM.heightCm / 2) * PX_PER_CM;
	const handleY = cy - halfHeightPx - 30;
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

	await addBoard(page, "boss-bcb-1000");
	await expect(stage).toHaveAttribute("data-boards", "1");
	await page.waitForTimeout(150);

	const box = await stage.boundingBox();
	if (!box) throw new Error("stage has no bounding box");
	const cx = box.x + box.width / 2;
	const cy = box.y + box.height / 2;

	// Select + rotate the board via its handle (same geometry as the P1-03 test).
	await page.mouse.click(cx, cy);
	await expect(stage).not.toHaveAttribute("data-selected-board", "");
	await page.mouse.move(cx, cy - 98);
	await page.mouse.down();
	await page.mouse.move(cx + 130, cy - 30, { steps: 12 });
	await page.mouse.up();
	await expect
		.poll(async () => Number(await stage.getAttribute("data-rotations")))
		.not.toBe(0);

	const boardBefore = await readBoard(stage);

	// Add a pedal to the (still selected) board, then rotate it via the handle.
	await addPedal(page, "boss-bd-2-blues-driver");
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
		{ x: (PEDAL_CM.widthCm / 2) * PX_PER_CM, y: -30 },
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

test("a second pointer during a pedal rotation commits it (no lost rotation)", async ({
	page,
}) => {
	await page.goto("/");
	const stage = page.getByTestId("stage");
	await expect(stage).toBeVisible();
	await addBoard(page, "boss-bcb-1000");
	await addPedal(page, "boss-bd-2-blues-driver");
	await expect(stage).toHaveAttribute("data-item-rotations", "0.00");
	await page.waitForTimeout(150);

	const box = await stage.boundingBox();
	if (!box) throw new Error("stage has no bounding box");
	const board = await readBoard(stage);
	const item = await readItem(stage);
	const origin = rotatePoint({ x: item.x, y: item.y }, board.rotation);
	const originPx = {
		x: box.x + (origin.x + board.x) * PX_PER_CM,
		y: box.y + (origin.y + board.y) * PX_PER_CM,
	};
	const handle = rotatePoint(
		{ x: (PEDAL_CM.widthCm / 2) * PX_PER_CM, y: -30 },
		board.rotation + item.rotation,
	);
	const hx = originPx.x + handle.x;
	const hy = originPx.y + handle.y;

	// Start a rotation and hold it mid-drag.
	await page.mouse.move(hx, hy);
	await page.mouse.down();
	await page.mouse.move(hx + 60, hy + 40, { steps: 8 });

	// A second pointer turns it into a viewport gesture: the live rotation must
	// be committed (not dropped when the Transformer stops).
	const cdp = await page.context().newCDPSession(page);
	await cdp.send("Input.dispatchTouchEvent", {
		type: "touchStart",
		touchPoints: [
			{ id: 0, x: hx + 60, y: hy + 40 },
			{ id: 1, x: hx + 140, y: hy + 120 },
		],
	});
	await page.waitForTimeout(150);
	await cdp.send("Input.dispatchTouchEvent", {
		type: "touchEnd",
		touchPoints: [],
	});
	await page.mouse.up();

	await expect
		.poll(async () => Number(await stage.getAttribute("data-item-rotations")))
		.not.toBe(0);
});

test("picking a pedal off a rotated board keeps its visible rotation (no snap-back)", async ({
	page,
}) => {
	await page.goto("/");
	const stage = page.getByTestId("stage");
	await expect(stage).toBeVisible();
	await addBoard(page, "boss-bcb-1000");
	await expect(stage).toHaveAttribute("data-boards", "1");
	await page.waitForTimeout(150);

	const box = await stage.boundingBox();
	if (!box) throw new Error("stage has no bounding box");
	const cx = box.x + box.width / 2;
	const cy = box.y + box.height / 2;

	// Rotate the board (same geometry as the P1-03 test).
	await page.mouse.click(cx, cy);
	await expect(stage).not.toHaveAttribute("data-selected-board", "");
	await page.mouse.move(cx, cy - 98);
	await page.mouse.down();
	await page.mouse.move(cx + 130, cy - 30, { steps: 12 });
	await page.mouse.up();
	await expect
		.poll(async () => Number(await stage.getAttribute("data-rotations")))
		.not.toBe(0);
	const board = await readBoard(stage);

	// Add a pedal to the board, then start dragging it.
	await addPedal(page, "boss-bd-2-blues-driver");
	await expect(stage).toHaveAttribute("data-item-parents", "0");
	await page.waitForTimeout(150);
	const item = await readItem(stage);
	const localCentre = {
		x:
			item.x +
			rotatePoint(
				{ x: PEDAL_CM.widthCm / 2, y: PEDAL_CM.heightCm / 2 },
				item.rotation,
			).x,
		y:
			item.y +
			rotatePoint(
				{ x: PEDAL_CM.widthCm / 2, y: PEDAL_CM.heightCm / 2 },
				item.rotation,
			).y,
	};
	const worldCentre = rotatePoint(localCentre, board.rotation);
	const px = box.x + (worldCentre.x + board.x) * PX_PER_CM;
	const py = box.y + (worldCentre.y + board.y) * PX_PER_CM;

	await page.mouse.move(px, py);
	await page.mouse.down();
	await page.mouse.move(px + 40, py + 20, { steps: 6 });

	// The lifted pedal shows its composed rotation (board + own), not the raw
	// item rotation — i.e. it does NOT snap back to the canvas frame.
	await expect(stage).not.toHaveAttribute("data-lifted-item", "");
	const lifted = Number(await stage.getAttribute("data-lifted-rotation"));
	expect(Math.abs(lifted - (board.rotation + item.rotation))).toBeLessThan(0.5);

	// Drop back on the same board: it re-attaches and the stored rotation returns
	// to its pre-drag value (the visible orientation is preserved end to end).
	await page.mouse.up();
	await expect(stage).toHaveAttribute("data-lifted-item", "");
	await expect(stage).toHaveAttribute("data-item-parents", "0");
	await expect
		.poll(async () => (await readItem(stage)).rotation)
		.toBeCloseTo(item.rotation, 4);
});

test("the action bar stays inside a narrow portrait viewport", async ({
	page,
}) => {
	await page.setViewportSize({ width: 320, height: 568 });
	await page.goto("/");
	const stage = page.getByTestId("stage");
	await expect(stage).toBeVisible();
	await addBoard(page, "boss-bcb-1000");
	await addPedal(page, "boss-bd-2-blues-driver");

	const bar = page.getByTestId("item-action-bar");
	await expect(bar).toBeVisible();
	const box = await bar.boundingBox();
	if (!box) throw new Error("action bar has no box");
	const viewport = page.viewportSize();
	if (!viewport) throw new Error("no viewport");
	expect(box.x).toBeGreaterThanOrEqual(0);
	expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
	// Delete is on-screen and usable.
	await page.getByTestId("delete-item").click();
	await expect(stage).toHaveAttribute("data-items", "0");
});

test("hovering a pedal sets the hover target (desktop outline wiring)", async ({
	page,
}) => {
	await page.goto("/");
	const stage = page.getByTestId("stage");
	await expect(stage).toBeVisible();
	await addPedal(page, "boss-bd-2-blues-driver");
	await expect(stage).toHaveAttribute("data-items", "1");
	const selected = await stage.getAttribute("data-selected-item");
	await page.waitForTimeout(150);

	const box = await stage.boundingBox();
	if (!box) throw new Error("stage has no bounding box");
	const centre = await firstItemScreenCentre(page, PEDAL_CM);

	// Deselect (tap empty canvas well clear of the pedal and the top-left/
	// top-right chrome)…
	await page.mouse.click(box.x + box.width - 40, box.y + box.height - 40);
	await expect(stage).toHaveAttribute("data-selected-item", "");
	// …then hover the pedal: the outline target is the item under the pointer.
	await page.mouse.move(centre.x, centre.y);
	await expect(stage).toHaveAttribute("data-hovered-item", selected ?? "");
	// Moving off the pedal clears it.
	await page.mouse.move(box.x + box.width - 40, box.y + box.height - 40);
	await expect(stage).toHaveAttribute("data-hovered-item", "");
});
