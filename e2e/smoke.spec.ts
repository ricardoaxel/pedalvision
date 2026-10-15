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

test("a second pointer during rotation commits the rotation (no lost transform)", async ({
	page,
}) => {
	await page.goto("/");
	const stage = page.getByTestId("stage");
	await expect(stage).toBeVisible();

	await page.getByTestId("add-board-boss-bcb-1000").click();
	await expect(stage).toHaveAttribute("data-boards", "1");
	await page.waitForTimeout(150);
	await expect(stage).toHaveAttribute("data-rotations", "0");

	const box = await stage.boundingBox();
	if (!box) throw new Error("stage has no bounding box");
	const cx = box.x + box.width / 2;
	const cy = box.y + box.height / 2;

	// Select, then start a rotation and hold it (handle ~98px above centre).
	await page.mouse.click(cx, cy);
	await expect(page.getByTestId("remove-board")).toBeVisible();
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
	await page.getByTestId("add-board-boss-bcb-1000").click();
	await expect(stage).toHaveAttribute("data-boards", "1");

	await page.getByTestId("add-pedal-boss-bd-2-blues-driver").click();
	await expect(stage).toHaveAttribute("data-items", "1");
	// Parent index 0 = the only board.
	await expect(stage).toHaveAttribute("data-item-parents", "0");
	// The new pedal is selected (Transformer visible on canvas).
	await expect(stage).not.toHaveAttribute("data-selected-item", "");
});

test("a pedal drags across boards; the Transformer follows and selection is clean", async ({
	page,
}) => {
	await page.goto("/");
	const stage = page.getByTestId("stage");
	await expect(stage).toBeVisible();

	// Two small boards, both dropped at the viewport centre.
	await page.getByTestId("add-board-d-addario-xpnd-1").click();
	await page.getByTestId("add-board-boardmods-b").click();
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
	await page.getByTestId("add-pedal-boss-bd-2-blues-driver").click();
	await expect(stage).toHaveAttribute("data-items", "1");
	await expect(stage).toHaveAttribute("data-item-parents", "0");
	const selected = await stage.getAttribute("data-selected-item");
	expect(selected).toBeTruthy();

	// Drag the pedal from A's centre towards board B.
	await page.mouse.move(cx, cy);
	await page.mouse.down();
	await page.mouse.move(cx + 120, cy, { steps: 6 });

	// Mid-drag the pedal is lifted into the DragLayer; its Transformer travels
	// with it and the selection is preserved.
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

	await page.getByTestId("add-board-boss-bcb-1000").click();
	await expect(stage).toHaveAttribute("data-boards", "1");
	await page.getByTestId("add-pedal-boss-bd-2-blues-driver").click();
	await expect(stage).toHaveAttribute("data-items", "1");
	await expect(stage).toHaveAttribute("data-item-parents", "0");
	const selected = await stage.getAttribute("data-selected-item");
	const before = await stage.getAttribute("data-item-positions");

	const box = await stage.boundingBox();
	if (!box) throw new Error("stage has no bounding box");
	const cx = box.x + box.width / 2;
	const cy = box.y + box.height / 2;

	// Drag the pedal well outside the board (to the right).
	await page.mouse.move(cx, cy);
	await page.mouse.down();
	await page.mouse.move(cx + 320, cy, { steps: 10 });
	await expect(stage).toHaveAttribute("data-lifted-item", selected ?? "");

	// A second finger turns it into a viewport gesture: the lifted pedal must
	// drop in place — here, outside the board, so it becomes loose (NOT dragged
	// back to where it started).
	const cdp = await page.context().newCDPSession(page);
	await cdp.send("Input.dispatchTouchEvent", {
		type: "touchStart",
		touchPoints: [
			{ id: 0, x: cx + 320, y: cy },
			{ id: 1, x: cx + 400, y: cy + 80 },
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
	await page.getByTestId("add-board-boss-bcb-1000").click();
	await page.getByTestId("add-pedal-boss-bd-2-blues-driver").click();
	const before = await stage.getAttribute("data-item-positions");

	const box = await stage.boundingBox();
	if (!box) throw new Error("stage has no bounding box");
	const cx = box.x + box.width / 2;
	const cy = box.y + box.height / 2;

	const cdp = await page.context().newCDPSession(page);
	// One finger pans on empty canvas, so the viewport owns the gesture. Moving
	// +40px pans the stage +40px, putting the pedal (board centre) at cx+40.
	await cdp.send("Input.dispatchTouchEvent", {
		type: "touchStart",
		touchPoints: [{ id: 0, x: cx + 420, y: cy }],
	});
	await cdp.send("Input.dispatchTouchEvent", {
		type: "touchMove",
		touchPoints: [{ id: 0, x: cx + 460, y: cy }],
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
	await page.getByTestId("add-board-boss-bcb-1000").click();
	await page.getByTestId("add-pedal-boss-bd-2-blues-driver").click();
	const selected = await stage.getAttribute("data-selected-item");

	const box = await stage.boundingBox();
	if (!box) throw new Error("stage has no bounding box");
	const cx = box.x + box.width / 2;
	const cy = box.y + box.height / 2;

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
