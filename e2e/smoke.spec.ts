import { expect, test } from "@playwright/test";
import {
	addBoard,
	addPedal,
	openPicker,
	removeSelectedBoard,
} from "./picker.ts";
import { firstItemScreenCentre } from "./stage.ts";

/** The blues-driver fixture footprint (seed dims). */
const PEDAL_CM = { widthCm: 7.3, heightCm: 13.02 };

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

	await addBoard(page, "boss-bcb-1000");
	await expect(stage).toHaveAttribute("data-boards", "1");

	// The board lands at the viewport centre, so a click there must hit the
	// Konva node (selecting it). A click on empty canvas would clear the
	// selection instead.
	const box = await stage.boundingBox();
	if (!box) throw new Error("stage has no bounding box");
	await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
	await expect(stage).not.toHaveAttribute("data-selected-board", "");
});

test("rotating a selected board via the Transformer handle changes its rotation", async ({
	page,
}) => {
	await page.goto("/");
	const stage = page.getByTestId("stage");
	await expect(stage).toBeVisible();

	await addBoard(page, "boss-bcb-1000");
	await expect(stage).toHaveAttribute("data-boards", "1");
	await expect(stage).toHaveAttribute("data-rotations", "0");
	await page.waitForTimeout(150);

	const box = await stage.boundingBox();
	if (!box) throw new Error("stage has no bounding box");
	const cx = box.x + box.width / 2;
	const cy = box.y + box.height / 2;

	// Select the board (placed at the viewport centre).
	await page.mouse.click(cx, cy);
	await expect(stage).not.toHaveAttribute("data-selected-board", "");

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

test("a second pointer during rotation commits the rotation (no lost transform)", async ({
	page,
}) => {
	await page.goto("/");
	const stage = page.getByTestId("stage");
	await expect(stage).toBeVisible();

	await addBoard(page, "boss-bcb-1000");
	await expect(stage).toHaveAttribute("data-boards", "1");
	await page.waitForTimeout(150);
	await expect(stage).toHaveAttribute("data-rotations", "0");

	const box = await stage.boundingBox();
	if (!box) throw new Error("stage has no bounding box");
	const cx = box.x + box.width / 2;
	const cy = box.y + box.height / 2;

	// Select, then start a rotation and hold it (handle ~98px above centre).
	await page.mouse.click(cx, cy);
	await expect(stage).not.toHaveAttribute("data-selected-board", "");
	await page.mouse.move(cx, cy - 98);
	await page.mouse.down();
	await page.mouse.move(cx + 70, cy - 40, { steps: 8 });

	// A second pointer (CDP touch) turns it into a viewport gesture: the live
	// rotation must be committed (not silently dropped when the Transformer stops).
	const cdp = await page.context().newCDPSession(page);
	await cdp.send("Input.dispatchTouchEvent", {
		type: "touchStart",
		touchPoints: [
			{ id: 0, x: cx + 70, y: cy - 40 },
			{ id: 1, x: cx + 140, y: cy + 40 },
		],
	});
	await page.waitForTimeout(150);
	await cdp.send("Input.dispatchTouchEvent", {
		type: "touchEnd",
		touchPoints: [],
	});
	await page.mouse.up();

	await expect
		.poll(async () => Number(await stage.getAttribute("data-rotations")))
		.not.toBe(0);
});

test("adding a board and a pedal places both on the canvas", async ({
	page,
}) => {
	await page.goto("/");
	const stage = page.getByTestId("stage");
	await expect(stage).toBeVisible();
	await expect(stage).toHaveAttribute("data-boards", "0");
	await expect(stage).toHaveAttribute("data-items", "0");

	// Adding a board auto-selects it, so the pedal picker targets it.
	await addBoard(page, "boss-bcb-1000");
	await expect(stage).toHaveAttribute("data-boards", "1");

	await addPedal(page, "boss-bd-2-blues-driver");
	await expect(stage).toHaveAttribute("data-items", "1");
	// Parent index 0 = the only board.
	await expect(stage).toHaveAttribute("data-item-parents", "0");
	// The new pedal is selected (Transformer visible on canvas).
	await expect(stage).not.toHaveAttribute("data-selected-item", "");
});

test("a pedal drags across boards; selection stays clean and the Transformer re-attaches", async ({
	page,
}) => {
	await page.goto("/");
	const stage = page.getByTestId("stage");
	await expect(stage).toBeVisible();

	// Two small boards, both dropped at the viewport centre.
	await addBoard(page, "d-addario-xpnd-1");
	await addBoard(page, "boardmods-b");
	await expect(stage).toHaveAttribute("data-boards", "2");

	const box = await stage.boundingBox();
	if (!box) throw new Error("stage has no bounding box");
	const cx = box.x + box.width / 2;
	const cy = box.y + box.height / 2;

	// Move the top board (added last) to the right, leaving the two apart.
	await page.mouse.move(cx, cy);
	await page.mouse.down();
	await page.mouse.move(cx + 240, cy, { steps: 10 });
	await page.mouse.up();

	// Select board A (still at the centre) and add a pedal onto it.
	await page.mouse.click(cx, cy);
	await addPedal(page, "boss-bd-2-blues-driver");
	await expect(stage).toHaveAttribute("data-items", "1");
	await expect(stage).toHaveAttribute("data-item-parents", "0");
	const selected = await stage.getAttribute("data-selected-item");
	expect(selected).toBeTruthy();

	// Drag the pedal from A's centre towards board B.
	await page.mouse.move(cx, cy);
	await page.mouse.down();
	await page.mouse.move(cx + 120, cy, { steps: 6 });

	// Mid-drag the pedal is lifted into the DragLayer; the single top-level
	// Transformer is detached (not shown) but the selection is preserved.
	await expect(stage).toHaveAttribute("data-lifted-item", selected ?? "");
	await expect(stage).toHaveAttribute("data-selected-item", selected ?? "");

	await page.mouse.move(cx + 240, cy, { steps: 6 });
	await page.mouse.up();

	// Dropped on board B: re-parented, lift cleared, selection intact (no stale
	// Transformer, no dropped selection).
	await expect(stage).toHaveAttribute("data-item-parents", "1");
	await expect(stage).toHaveAttribute("data-lifted-item", "");
	await expect(stage).toHaveAttribute("data-selected-item", selected ?? "");
});

test("a two-finger pan mid-drag drops the lifted pedal in place (pan interrupt)", async ({
	page,
}) => {
	await page.goto("/");
	const stage = page.getByTestId("stage");
	await expect(stage).toBeVisible();

	await addBoard(page, "boss-bcb-1000");
	await expect(stage).toHaveAttribute("data-boards", "1");
	await addPedal(page, "boss-bd-2-blues-driver");
	await expect(stage).toHaveAttribute("data-items", "1");
	await expect(stage).toHaveAttribute("data-item-parents", "0");
	const selected = await stage.getAttribute("data-selected-item");
	const before = await stage.getAttribute("data-item-positions");

	// Locate the pedal from the stage state (the P2-03 info rail narrowed the
	// canvas when the pedal was selected).
	const { x: cx, y: cy } = await firstItemScreenCentre(page, PEDAL_CM);

	// Drag the pedal just outside the board (to the right), staying within the
	// canvas pane so the second finger lands on the stage, not the info rail.
	await page.mouse.move(cx, cy);
	await page.mouse.down();
	await page.mouse.move(cx + 160, cy, { steps: 10 });
	await expect(stage).toHaveAttribute("data-lifted-item", selected ?? "");

	// A second finger turns it into a viewport gesture: the lifted pedal must
	// drop in place — here, outside the board, so it becomes loose (NOT dragged
	// back to where it started).
	const cdp = await page.context().newCDPSession(page);
	await cdp.send("Input.dispatchTouchEvent", {
		type: "touchStart",
		touchPoints: [
			{ id: 0, x: cx + 160, y: cy },
			{ id: 1, x: cx + 240, y: cy + 80 },
		],
	});
	await expect(stage).toHaveAttribute("data-lifted-item", "");
	await expect(stage).toHaveAttribute("data-item-parents", "loose");
	expect(await stage.getAttribute("data-item-positions")).not.toBe(before);

	await cdp.send("Input.dispatchTouchEvent", {
		type: "touchEnd",
		touchPoints: [],
	});
	await page.mouse.up();
});

test("a press on a pedal during an active viewport gesture does not start a drag", async ({
	page,
}) => {
	await page.goto("/");
	const stage = page.getByTestId("stage");
	await expect(stage).toBeVisible();
	await addBoard(page, "boss-bcb-1000");
	await addPedal(page, "boss-bd-2-blues-driver");
	const before = await stage.getAttribute("data-item-positions");

	// Locate the pedal from the stage state (the P2-03 info rail narrowed the
	// canvas when the pedal was selected).
	const { x: cx, y: cy } = await firstItemScreenCentre(page, PEDAL_CM);

	const cdp = await page.context().newCDPSession(page);
	// One finger pans on empty canvas (left of the board), so the viewport owns
	// the gesture. Moving +40px pans the stage +40px, putting the pedal at cx+40.
	await cdp.send("Input.dispatchTouchEvent", {
		type: "touchStart",
		touchPoints: [{ id: 0, x: 80, y: cy }],
	});
	await cdp.send("Input.dispatchTouchEvent", {
		type: "touchMove",
		touchPoints: [{ id: 0, x: 120, y: cy }],
	});

	// While navigating, a press on the pedal must NOT start a drag (the idle→
	// navigating cancellation edge already passed). Konva does not dispatch a
	// shape touchstart for a second finger, so the press is injected via the mouse
	// to reach the same candidate path.
	await page.mouse.move(cx + 40, cy);
	await page.mouse.down();
	await page.mouse.move(cx + 90, cy + 10, { steps: 5 });

	await expect(stage).toHaveAttribute("data-lifted-item", "");
	expect(await stage.getAttribute("data-item-positions")).toBe(before);

	await page.mouse.up();
	await cdp.send("Input.dispatchTouchEvent", {
		type: "touchEnd",
		touchPoints: [],
	});
});

test("a stray pointer or a button-less move ends the pedal drag", async ({
	page,
}) => {
	await page.goto("/");
	const stage = page.getByTestId("stage");
	await expect(stage).toBeVisible();
	await addBoard(page, "boss-bcb-1000");
	await addPedal(page, "boss-bd-2-blues-driver");
	const selected = await stage.getAttribute("data-selected-item");

	// Locate the pedal from the stage state (the P2-03 info rail narrowed the
	// canvas when the pedal was selected).
	const { x: cx, y: cy } = await firstItemScreenCentre(page, PEDAL_CM);

	// Record the real mouse pointerId so synthetic events can match/mismatch it.
	await page.evaluate(() => {
		(window as unknown as { __pid?: number }).__pid = undefined;
		window.addEventListener("pointermove", (event) => {
			(window as unknown as { __pid?: number }).__pid = event.pointerId;
		});
	});

	await page.mouse.move(cx, cy);
	await page.mouse.down();
	await page.mouse.move(cx + 60, cy, { steps: 6 });
	await expect(stage).toHaveAttribute("data-lifted-item", selected ?? "");

	const pid = await page.evaluate(
		() => (window as unknown as { __pid?: number }).__pid,
	);
	if (typeof pid !== "number") throw new Error("no pointerId captured");
	const liftedBefore = await stage.getAttribute("data-lifted-position");
	// The imperative debug attribute is populated mid-drag.
	expect(liftedBefore).toMatch(/^-?\d/);

	// A DIFFERENT pointer moving must not move the lifted pedal (finding #4).
	await page.evaluate(
		({ pid, cx, cy }) => {
			window.dispatchEvent(
				new PointerEvent("pointermove", {
					pointerId: pid + 1000,
					pointerType: "touch",
					buttons: 1,
					clientX: cx + 320,
					clientY: cy + 220,
					bubbles: true,
				}),
			);
		},
		{ pid, cx, cy },
	);
	await page.waitForTimeout(50);
	expect(await stage.getAttribute("data-lifted-position")).toBe(liftedBefore);

	// The owning pointer with no buttons held (released off-window) ends the drag
	// (finding #3).
	await page.evaluate(
		({ pid, cx, cy }) => {
			window.dispatchEvent(
				new PointerEvent("pointermove", {
					pointerId: pid,
					pointerType: "mouse",
					buttons: 0,
					clientX: cx + 61,
					clientY: cy,
					bubbles: true,
				}),
			);
		},
		{ pid, cx, cy },
	);
	await expect(stage).toHaveAttribute("data-lifted-item", "");
	await page.mouse.up();
});

test("the picker stays usable on short/narrow viewports", async ({ page }) => {
	// Portrait + short landscape phones: the persistent bottom tab bar is the
	// small mobile chrome, the sheet is dismissible, and a canvas strip remains.
	const stage = page.getByTestId("stage");
	for (const { width, height } of [
		{ width: 320, height: 568 },
		{ width: 568, height: 320 },
		{ width: 667, height: 320 },
	]) {
		await page.setViewportSize({ width, height });
		await page.goto("/");
		await expect(stage).toBeVisible();

		// The tab bar is always there (the small mobile footprint).
		const barTab = page.getByTestId("picker-bar-boards");
		await expect(barTab).toBeVisible();

		// Opening the sheet leaves a canvas strip + the tab bar visible.
		await barTab.click();
		const panel = page.getByTestId("picker-panel");
		await expect(panel).toBeVisible();
		expect(
			(await panel.boundingBox())?.height ?? 0,
			`sheet covers the whole viewport at ${width}×${height}`,
		).toBeLessThan(height - 40);
		await expect(page.getByTestId("picker-bar-boards")).toBeVisible();

		// Place a board, then remove it via the boards tab.
		await page.getByTestId("add-board-boss-bcb-1000").click();
		await expect(page.getByTestId("picker-panel")).toHaveCount(0);
		await expect(stage).toHaveAttribute("data-boards", "1");
		await removeSelectedBoard(page);
		await expect(stage).toHaveAttribute("data-boards", "0");

		// The pedal results list has a real scrollable height.
		await openPicker(page, "pedals");
		const results = page.getByTestId("picker-results");
		await expect(results).toBeVisible();
		expect(
			(await results.boundingBox())?.height ?? 0,
			`pedal list empty at ${width}×${height}`,
		).toBeGreaterThan(40);
	}
});
