import { expect, type Page, test } from "@playwright/test";
import { waitForSavedScene } from "./persistence.ts";
import { addBoard, addPedal } from "./picker.ts";
import { board, shareHash } from "./share.ts";
import { firstItemScreenCentre } from "./stage.ts";

/**
 * F-04 — viewport focus ("Scope Frame").
 *
 * Viewport state is deliberately not persisted, so the assertions read the
 * stage transform (`data-scale` / `data-x` / `data-y`) and the focus bounds
 * (`data-focus-bounds`, world cm) rather than pixels. Sheet content is placed
 * through the real picker flows; the board focus path is asserted against the
 * board's own footprint, and the used-area path against the full scene bounds.
 */

const PX_PER_CM = 4;

async function stageBox(page: Page) {
	const box = await page.getByTestId("stage").boundingBox();
	if (!box) throw new Error("stage has no bounding box");
	return box;
}

async function stageTransform(page: Page) {
	const stage = page.getByTestId("stage");
	return {
		scale: Number(await stage.getAttribute("data-scale")) || 1,
		x: Number(await stage.getAttribute("data-x")) || 0,
		y: Number(await stage.getAttribute("data-y")) || 0,
	};
}

/** Mirror of `focusInsets` for a no-info-sheet state. */
async function expectedSafeCenter(page: Page) {
	const box = await stageBox(page);
	const mobile = (page.viewportSize()?.width ?? 1280) < 1024;
	const top = Math.min(72, Math.max(0, box.height * 0.15));
	const side = mobile ? 16 : 24;
	const strip = await page.locator(".scale-strip").boundingBox();
	const stripHeight = strip?.height ?? 114;
	const bottom = mobile
		? Math.max(0, Math.min(56 + 16 + stripHeight + 12, box.height * 0.45))
		: 24;
	return {
		x: box.x + side + (box.width - side * 2) / 2,
		y: box.y + top + (box.height - top - bottom) / 2,
	};
}

/** The first/only board's visible centre in screen px (rotation-aware). */
async function boardCentreScreen(page: Page, index = 0) {
	const stage = page.getByTestId("stage");
	const box = await stageBox(page);
	const { scale, x: vx, y: vy } = await stageTransform(page);
	const [widthCm, heightCm] = (
		((await stage.getAttribute("data-board-sizes")) ?? "").split(",")[index] ??
		""
	)
		.split("x")
		.map(Number);
	const [x, y] = (
		((await stage.getAttribute("data-positions")) ?? "").split(";")[index] ?? ""
	)
		.split(",")
		.map(Number);
	const rotationDeg =
		Number(
			((await stage.getAttribute("data-rotations")) ?? "").split(",")[index],
		) || 0;
	const rad = (rotationDeg * Math.PI) / 180;
	const centreX =
		x + Math.cos(rad) * (widthCm / 2) - Math.sin(rad) * (heightCm / 2);
	const centreY =
		y + Math.sin(rad) * (widthCm / 2) + Math.cos(rad) * (heightCm / 2);
	return {
		x: box.x + centreX * PX_PER_CM * scale + vx,
		y: box.y + centreY * PX_PER_CM * scale + vy,
	};
}

async function focusBounds(page: Page) {
	const raw = await page.getByTestId("stage").getAttribute("data-focus-bounds");
	if (!raw) throw new Error("no focus bounds");
	const [x, y, widthCm, heightCm] = raw.split(",").map(Number);
	return { x, y, widthCm, heightCm };
}

async function focusBoundsCentreScreen(page: Page) {
	const box = await stageBox(page);
	const { scale, x: vx, y: vy } = await stageTransform(page);
	const bounds = await focusBounds(page);
	return {
		x: box.x + (bounds.x + bounds.widthCm / 2) * PX_PER_CM * scale + vx,
		y: box.y + (bounds.y + bounds.heightCm / 2) * PX_PER_CM * scale + vy,
	};
}

async function expectFocusedInsideSafeArea(page: Page) {
	const box = await stageBox(page);
	const mobile = (page.viewportSize()?.width ?? 1280) < 1024;
	const top = Math.min(72, Math.max(0, box.height * 0.15));
	const side = mobile ? 16 : 24;
	const strip = await page.locator(".scale-strip").boundingBox();
	const stripHeight = strip?.height ?? 114;
	const bottom = mobile
		? Math.max(0, Math.min(56 + 16 + stripHeight + 12, box.height * 0.45))
		: 24;
	const { scale, x: vx, y: vy } = await stageTransform(page);
	const bounds = await focusBounds(page);
	const left = box.x + bounds.x * PX_PER_CM * scale + vx;
	const right = box.x + (bounds.x + bounds.widthCm) * PX_PER_CM * scale + vx;
	const topPx = box.y + bounds.y * PX_PER_CM * scale + vy;
	const bottomPx =
		box.y + (bounds.y + bounds.heightCm) * PX_PER_CM * scale + vy;
	expect(left).toBeGreaterThanOrEqual(box.x + side - 2);
	expect(right).toBeLessThanOrEqual(box.x + box.width - side + 2);
	expect(topPx).toBeGreaterThanOrEqual(box.y + top - 2);
	expect(bottomPx).toBeLessThanOrEqual(box.y + box.height - bottom + 2);

	// Anchor the insets to the real chrome (not just the copied formula).
	const toolbar = await page.locator(".app-toolbar").boundingBox();
	if (strip) expect(bottomPx).toBeLessThanOrEqual(strip.y - 4);
	if (toolbar) {
		expect(topPx).toBeGreaterThanOrEqual(toolbar.y + toolbar.height + 4);
	}
}

async function expectAtSafeCentre(page: Page, point: { x: number; y: number }) {
	const safe = await expectedSafeCenter(page);
	expect(Math.abs(point.x - safe.x)).toBeLessThan(1);
	expect(Math.abs(point.y - safe.y)).toBeLessThan(1);
}

/** Drag empty canvas (away from the scene plate and centre content). */
async function panBy(page: Page, dx: number, dy: number) {
	const box = await stageBox(page);
	// Above the focus safe rect and left of the scene plate, so a framed
	// neighbour board can never be the drag target.
	const startX = box.x + 4;
	const startY = box.y + 40;
	await page.mouse.move(startX, startY);
	await page.mouse.down();
	await page.mouse.move(startX + dx, startY + dy, { steps: 6 });
	await page.mouse.up();
}

async function stageSnapshot(page: Page) {
	const stage = page.getByTestId("stage");
	return {
		boards: await stage.getAttribute("data-boards"),
		items: await stage.getAttribute("data-items"),
		cables: await stage.getAttribute("data-cables"),
		undo: await stage.getAttribute("data-undo-depth"),
		redo: await stage.getAttribute("data-redo-depth"),
		hash: await page.evaluate(() => window.location.hash),
	};
}

async function focusEpoch(page: Page): Promise<number> {
	return (
		Number(await page.getByTestId("stage").getAttribute("data-focus-epoch")) ||
		0
	);
}

async function dockSnapshot(page: Page) {
	const dock = page.getByTestId("board-view-dock");
	return {
		index: Number(await dock.getAttribute("data-index")),
		total: Number(await dock.getAttribute("data-total")),
		locked: (await dock.getAttribute("data-locked")) === "true",
		counter: (await page.getByTestId("board-counter").innerText()).trim(),
		lockPressed: await page
			.getByTestId("board-lock")
			.getAttribute("aria-pressed"),
		prevDisabled: await page.getByTestId("board-prev").isDisabled(),
		nextDisabled: await page.getByTestId("board-next").isDisabled(),
	};
}

/** Two distinct boards, both visible, none camera-framed. */
async function twoBoards(page: Page) {
	await addBoard(page, "boss-bcb-1000");
	await panBy(page, 200, 0);
	await addBoard(page, "boss-bcb-1000");
}

async function doubleClickBoard(page: Page, index: number) {
	const centre = await boardCentreScreen(page, index);
	await page.mouse.dblclick(centre.x, centre.y);
}

async function clickEmpty(page: Page) {
	const box = await stageBox(page);
	// Above the focus safe rect and left of the scene plate. The left gutter at
	// mid-height can be covered by another board once one board fills the view.
	await page.mouse.click(box.x + 4, box.y + 40);
}

async function waitForDockIndex(page: Page, index: number) {
	await expect(page.getByTestId("board-view-dock")).toHaveAttribute(
		"data-index",
		String(index),
	);
}

async function openScenes(page: Page) {
	await page.getByTestId("scene-open").click();
	await expect(page.getByTestId("scene-panel")).toBeVisible();
}

async function closeScenes(page: Page) {
	await page.getByTestId("scene-close").click();
	await expect(page.getByTestId("scene-panel")).toHaveCount(0);
}

async function newScene(page: Page) {
	await openScenes(page);
	await page.getByTestId("scene-new").click();
	await closeScenes(page);
}

async function switchSceneAt(page: Page, index: number) {
	await openScenes(page);
	await page.locator("[data-scene-open]").nth(index).click();
	await closeScenes(page);
}

test("an empty sheet has a disabled Scope Frame control and does not move", async ({
	page,
}) => {
	await page.goto("/");
	const stage = page.getByTestId("stage");
	await expect(stage).toBeVisible();
	const trigger = page.getByTestId("frame-trigger");
	await expect(trigger).toBeVisible();
	await expect(trigger).toHaveAttribute("data-target", "scene");
	await expect(trigger).toHaveAttribute("aria-disabled", "true");
	await expect(trigger).toHaveAttribute("title", "Nothing to frame yet");

	const before = await stageTransform(page);
	await trigger.click({ force: true });
	const after = await stageTransform(page);
	expect(after).toEqual(before);
	await expect(stage).toHaveAttribute("data-framed", "false");

	const dock = await dockSnapshot(page);
	expect(dock).toMatchObject({
		index: -1,
		total: 0,
		counter: "0 / 0",
		locked: false,
		prevDisabled: true,
		nextDisabled: true,
	});
	await expect(page.getByTestId("board-lock")).toHaveAttribute(
		"aria-disabled",
		"true",
	);
});

test("frames the used area after a pan/zoom, via the control and F", async ({
	page,
}) => {
	await page.goto("/");
	await addBoard(page, "boss-bcb-1000");
	await addPedal(page, "boss-bd-2-blues-driver");
	await clickEmpty(page);

	await panBy(page, 140, 90);
	await page.mouse.wheel(0, 300);
	const stage = page.getByTestId("stage");
	await expect(stage).toHaveAttribute("data-framed", "false");

	const trigger = page.getByTestId("frame-trigger");
	await expect(trigger).toHaveAttribute("data-target", "scene");
	const beforeFocus = await stageSnapshot(page);
	await trigger.click();
	await expect(stage).toHaveAttribute("data-framed", "true");
	await expect(stage).toHaveAttribute("data-focus-target", "scene");
	await expectAtSafeCentre(page, await focusBoundsCentreScreen(page));
	await expectFocusedInsideSafeArea(page);
	// View-only: focus never changes the scene, undo history or share hash.
	expect(await stageSnapshot(page)).toEqual(beforeFocus);

	// An ordinary edit must NOT re-frame or move the camera.
	const epochAfterFocus = await focusEpoch(page);
	const transformAfterFocus = await stageTransform(page);
	await addPedal(page, "boss-bd-2-blues-driver");
	await expect(stage).toHaveAttribute("data-framed", "false");
	expect(await stageTransform(page)).toEqual(transformAfterFocus);
	expect(await focusEpoch(page)).toBe(epochAfterFocus);

	// Any pan clears the framed tint; `F` re-frames the same used area.
	await panBy(page, -80, -60);
	await expect(stage).toHaveAttribute("data-framed", "false");
	await page.keyboard.press("f");
	await expect(stage).toHaveAttribute("data-framed", "true");
	await expectAtSafeCentre(page, await focusBoundsCentreScreen(page));
});

test("frames only the selected board, not the whole used area", async ({
	page,
}) => {
	await page.goto("/");
	await addBoard(page, "boss-bcb-1000");
	// A loose pedal is placed away from the board, so board focus and used-area
	// focus have visibly different bounds.
	await clickEmpty(page);
	await panBy(page, 160, 120);
	await addPedal(page, "boss-bd-2-blues-driver");
	await clickEmpty(page);

	const stage = page.getByTestId("stage");
	const boardPoint = await boardCentreScreen(page);
	await page.mouse.click(boardPoint.x, boardPoint.y);
	await expect(stage).toHaveAttribute("data-selected-kind", "board");

	const trigger = page.getByTestId("frame-trigger");
	await expect(trigger).toHaveAttribute("data-target", "board");
	await trigger.click();
	await expect(stage).toHaveAttribute("data-framed", "true");
	await expect(stage).toHaveAttribute("data-focus-target", "board");

	// Board focus must use the board's own footprint, not the loose pedal.
	const bounds = await focusBounds(page);
	const [widthCm, heightCm] = (
		((await stage.getAttribute("data-board-sizes")) ?? "").split(",")[0] ?? ""
	)
		.split("x")
		.map(Number);
	expect(bounds.widthCm).toBeCloseTo(widthCm, 1);
	expect(bounds.heightCm).toBeCloseTo(heightCm, 1);
	await expectAtSafeCentre(page, await focusBoundsCentreScreen(page));
	await expectFocusedInsideSafeArea(page);

	// Deselecting returns the same control to the used area.
	await clickEmpty(page);
	await expect(trigger).toHaveAttribute("data-target", "scene");
});

test("switching scenes frames each incoming document (no stale x/y)", async ({
	page,
}) => {
	await page.goto("/");
	const stage = page.getByTestId("stage");
	await expect(stage).toBeVisible();
	// Boot snaps: no camera tween has run yet.
	expect(
		Number((await stage.getAttribute("data-motion-viewport-seq")) ?? "0"),
	).toBe(0);

	await addBoard(page, "boss-bcb-1000");
	await panBy(page, 150, 100);

	await newScene(page);
	await panBy(page, -200, -150);
	await addBoard(page, "boss-bcb-1000");

	// A scene switch runs the 240 ms camera tween before marking the frame.
	const tweenBefore = Number(
		(await stage.getAttribute("data-motion-viewport-seq")) ?? "0",
	);
	await switchSceneAt(page, 0);
	await expect
		.poll(async () =>
			Number((await stage.getAttribute("data-motion-viewport-seq")) ?? "0"),
		)
		.toBeGreaterThan(tweenBefore);
	await expect(stage).toHaveAttribute("data-framed", "true");
	await expect(stage).toHaveAttribute("data-focus-target", "scene");
	await expectAtSafeCentre(page, await boardCentreScreen(page));
	await expectFocusedInsideSafeArea(page);
	const first = await stageTransform(page);

	await switchSceneAt(page, 1);
	await expect(stage).toHaveAttribute("data-framed", "true");
	await expectAtSafeCentre(page, await boardCentreScreen(page));
	await expectFocusedInsideSafeArea(page);
	const second = await stageTransform(page);

	// Different world positions must produce different stage x/y offsets.
	expect(
		Math.abs(second.x - first.x) + Math.abs(second.y - first.y),
	).toBeGreaterThan(20);
});

test("a pan during a scene-load tween settles the frame instead of freezing it", async ({
	page,
}) => {
	await page.goto("/");
	const stage = page.getByTestId("stage");
	await expect(stage).toBeVisible();
	await addBoard(page, "boss-bcb-1000");
	await newScene(page);
	await addBoard(page, "boss-bcb-1000");

	await openScenes(page);
	const beforeEpoch = await focusEpoch(page);
	const before = await stageTransform(page);
	await page.locator("[data-scene-open]").nth(0).click();

	// The scene sheet is still open; the left gutter at mid-height is empty.
	// A press there must finish the running camera tween at its target, then pan.
	const box = await page.getByTestId("stage").boundingBox();
	if (!box) throw new Error("stage has no floor");
	const startX = box.x + 12;
	const startY = box.y + box.height / 2;
	await page.mouse.move(startX, startY);
	await page.mouse.down();
	await page.mouse.move(startX + 50, startY + 30, { steps: 6 });
	await page.mouse.up();

	// The tween marked the F-04 frame (epoch) instead of freezing half-way, and
	// the deliberate pan then moved the camera from that settled transform.
	await expect.poll(() => focusEpoch(page)).toBeGreaterThan(beforeEpoch);
	const after = await stageTransform(page);
	expect(
		Math.abs(after.x - before.x) + Math.abs(after.y - before.y),
	).toBeGreaterThan(5);
});

test("double-click a board toggles board focus ↔ all", async ({ page }) => {
	await page.goto("/");
	await twoBoards(page);
	const stage = page.getByTestId("stage");
	const uids = ((await stage.getAttribute("data-board-uids")) ?? "").split(",");

	await doubleClickBoard(page, 0);
	await waitForDockIndex(page, 0);
	await expect(stage).toHaveAttribute("data-focus-target", "board");
	await expect(stage).toHaveAttribute("data-selected-board", uids[0] ?? "");
	await expect(stage).toHaveAttribute("data-framed", "true");
	let dock = await dockSnapshot(page);
	expect(dock).toMatchObject({ index: 0, total: 2, counter: "1 / 2" });

	// Second double-click on the same board → frame all.
	await doubleClickBoard(page, 0);
	await waitForDockIndex(page, -1);
	await expect(stage).toHaveAttribute("data-focus-target", "scene");
	await expect(stage).toHaveAttribute("data-selected-board", "");
	dock = await dockSnapshot(page);
	expect(dock).toMatchObject({ index: -1, total: 2, counter: "all / 2" });

	// Double-clicking another board focuses that one.
	await doubleClickBoard(page, 1);
	await waitForDockIndex(page, 1);
	await expect(stage).toHaveAttribute("data-focus-target", "board");
	await expect(stage).toHaveAttribute("data-selected-board", uids[1] ?? "");
	dock = await dockSnapshot(page);
	expect(dock).toMatchObject({ index: 1, total: 2, counter: "2 / 2" });

	// Back to all, then double-click a pedal and empty canvas: no view action.
	await doubleClickBoard(page, 1);
	await waitForDockIndex(page, -1);
	await expect(stage).toHaveAttribute("data-focus-target", "scene");
	await addPedal(page, "boss-bd-2-blues-driver");
	const pedal = await firstItemScreenCentre(page, {
		widthCm: 7.3,
		heightCm: 13.02,
	});
	const beforePedal = await stageTransform(page);
	await page.mouse.dblclick(pedal.x, pedal.y);
	expect(await stageTransform(page)).toEqual(beforePedal);
	await expect(stage).toHaveAttribute("data-focus-target", "scene");

	const beforeEmpty = await stageTransform(page);
	const emptyBox = await stageBox(page);
	await page.mouse.dblclick(emptyBox.x + 4, emptyBox.y + 40);
	expect(await stageTransform(page)).toEqual(beforeEmpty);
	await expect(stage).toHaveAttribute("data-focus-target", "scene");
});

test("double-click after a first select toggles the board off", async ({
	page,
}) => {
	await page.goto("/");
	await addBoard(page, "boss-bcb-1000");
	await clickEmpty(page);
	const stage = page.getByTestId("stage");
	const uid = ((await stage.getAttribute("data-board-uids")) ?? "").split(
		",",
	)[0];

	// First click selects the board (blue border) but does not frame it.
	const board = await boardCentreScreen(page, 0);
	await page.mouse.click(board.x, board.y);
	await expect(stage).toHaveAttribute("data-selected-board", uid ?? "");

	// The following quick double-click must toggle board focus ↔ all and leave
	// the board unselected (no trailing click re-selects it).
	await page.mouse.dblclick(board.x, board.y);
	await waitForDockIndex(page, -1);
	await expect(stage).toHaveAttribute("data-focus-target", "scene");
	await expect(stage).toHaveAttribute("data-selected-board", "");
	await expect(stage).toHaveAttribute("data-framed", "true");
});

test("the board dock paginator selects and frames every board, with wrap", async ({
	page,
}) => {
	await page.goto("/");
	await twoBoards(page);
	const stage = page.getByTestId("stage");
	const uids = ((await stage.getAttribute("data-board-uids")) ?? "").split(",");
	let dock = await dockSnapshot(page);
	expect(dock).toMatchObject({
		index: -1,
		total: 2,
		counter: "all / 2",
		prevDisabled: false,
		nextDisabled: false,
	});

	// From all view, next starts at board 1.
	await page.getByTestId("board-next").click();
	await waitForDockIndex(page, 0);
	await expect(stage).toHaveAttribute("data-selected-board", uids[0] ?? "");
	await expect(stage).toHaveAttribute("data-focus-target", "board");
	dock = await dockSnapshot(page);
	expect(dock).toMatchObject({ index: 0, counter: "1 / 2" });
	await expectAtSafeCentre(page, await boardCentreScreen(page, 0));

	await page.getByTestId("board-next").click();
	await waitForDockIndex(page, 1);
	await expect(stage).toHaveAttribute("data-selected-board", uids[1] ?? "");
	dock = await dockSnapshot(page);
	expect(dock).toMatchObject({ index: 1, counter: "2 / 2" });
	await expectAtSafeCentre(page, await boardCentreScreen(page, 1));

	// Wrap forward and backward.
	await page.getByTestId("board-next").click();
	await waitForDockIndex(page, 0);
	dock = await dockSnapshot(page);
	expect(dock).toMatchObject({ index: 0, counter: "1 / 2" });
	await page.getByTestId("board-prev").click();
	await waitForDockIndex(page, 1);
	dock = await dockSnapshot(page);
	expect(dock).toMatchObject({ index: 1, counter: "2 / 2" });
});

test("one board disables the paginator but still focuses", async ({ page }) => {
	await page.goto("/");
	await addBoard(page, "boss-bcb-1000");
	await clickEmpty(page);
	let dock = await dockSnapshot(page);
	expect(dock).toMatchObject({
		total: 1,
		index: -1,
		prevDisabled: true,
		nextDisabled: true,
		counter: "all / 1",
	});
	await doubleClickBoard(page, 0);
	await waitForDockIndex(page, 0);
	dock = await dockSnapshot(page);
	expect(dock).toMatchObject({ index: 0, counter: "1 / 1" });
	await expect(page.getByTestId("board-lock")).not.toHaveAttribute(
		"aria-disabled",
		"true",
	);
});

test("the camera lock blocks pan/zoom, survives pedal selection, and unlocks on exit", async ({
	page,
}) => {
	await page.goto("/");
	await twoBoards(page);
	const stage = page.getByTestId("stage");
	await page.getByTestId("board-next").click();
	await waitForDockIndex(page, 0);
	await page.getByTestId("board-lock").click();
	await expect(page.getByTestId("board-lock")).toHaveAttribute(
		"aria-pressed",
		"true",
	);
	const locked = await stageTransform(page);
	const positionsBefore = await stage.getAttribute("data-positions");

	// Wheel + empty-drag pan are ignored while the camera is pinned; the drag
	// must not land on a neighbour board either.
	await page.mouse.move(640, 300);
	await page.mouse.wheel(0, -300);
	await panBy(page, 140, 90);
	expect(await stageTransform(page)).toEqual(locked);
	expect(await stage.getAttribute("data-positions")).toBe(positionsBefore);
	await expect(stage).toHaveAttribute("data-lifted-item", "");

	// Selecting a pedal on the pinned board keeps the lock and the board view.
	await addPedal(page, "boss-bd-2-blues-driver");
	await expect(page.getByTestId("board-lock")).toHaveAttribute(
		"aria-pressed",
		"true",
	);
	expect((await dockSnapshot(page)).locked).toBe(true);
	expect((await dockSnapshot(page)).index).toBe(0);

	// `frame all` (chip target scene while a pedal is selected) releases it.
	await expect(page.getByTestId("frame-trigger")).toHaveAttribute(
		"data-target",
		"scene",
	);
	await page.getByTestId("frame-trigger").click();
	await expect(page.getByTestId("board-lock")).toHaveAttribute(
		"aria-pressed",
		"false",
	);
	await expect(stage).toHaveAttribute("data-focus-target", "scene");
	await waitForDockIndex(page, -1);

	// Empty-canvas click also releases the lock. Drop the pedal selection first
	// so the paginator starts from a clean all view.
	await clickEmpty(page);
	await page.getByTestId("board-next").click();
	await waitForDockIndex(page, 0);
	await page.getByTestId("board-lock").click();
	await expect(page.getByTestId("board-lock")).toHaveAttribute(
		"aria-pressed",
		"true",
	);
	await clickEmpty(page);
	await expect(page.getByTestId("board-lock")).toHaveAttribute(
		"aria-pressed",
		"false",
	);

	// A scene load resets the ephemeral lock. The camera is still on the board
	// after the empty click, so next moves to the other board.
	await page.getByTestId("board-next").click();
	await waitForDockIndex(page, 1);
	await page.getByTestId("board-lock").click();
	await expect(page.getByTestId("board-lock")).toHaveAttribute(
		"aria-pressed",
		"true",
	);
	await newScene(page);
	await expect(page.getByTestId("board-lock")).toHaveAttribute(
		"aria-pressed",
		"false",
	);
});

test("L toggles the camera lock and dock arrow keys page", async ({ page }) => {
	await page.goto("/");
	await twoBoards(page);
	await doubleClickBoard(page, 0);
	await waitForDockIndex(page, 0);

	await page.keyboard.press("l");
	await expect(page.getByTestId("board-lock")).toHaveAttribute(
		"aria-pressed",
		"true",
	);
	await page.keyboard.press("l");
	await expect(page.getByTestId("board-lock")).toHaveAttribute(
		"aria-pressed",
		"false",
	);

	await page.getByTestId("board-next").focus();
	await page.keyboard.press("ArrowRight");
	await waitForDockIndex(page, 1);
	await page.keyboard.press("ArrowLeft");
	await waitForDockIndex(page, 0);
});

test("double-click an attached pedal never toggles its board", async ({
	page,
}) => {
	await page.goto("/");
	await addBoard(page, "boss-bcb-1000");
	await addPedal(page, "boss-bd-2-blues-driver");
	await clickEmpty(page);
	const stage = page.getByTestId("stage");
	const pedal = await firstItemScreenCentre(page, {
		widthCm: 7.3,
		heightCm: 13.02,
	});
	const before = await stageTransform(page);
	await page.mouse.dblclick(pedal.x, pedal.y);
	expect(await stageTransform(page)).toEqual(before);
	await expect(stage).toHaveAttribute("data-focus-target", "");
	await expect(stage).toHaveAttribute("data-selected-board", "");
});

test("a read-only share opens framed and can be re-framed", async ({
	page,
}) => {
	const hash = shareHash({
		boards: [board("shared-board", { x: 300, y: 220 })],
		items: [],
	});
	await page.goto(`/?share=1${hash}`);
	const stage = page.getByTestId("stage");
	await expect(stage).toBeVisible();
	await expect(page.locator("main")).toHaveAttribute("data-readonly", "true");

	const trigger = page.getByTestId("frame-trigger");
	await expect(trigger).not.toHaveAttribute("aria-disabled", "true");
	await expect(stage).toHaveAttribute("data-framed", "true");
	await expect(stage).toHaveAttribute("data-focus-target", "scene");
	await expectAtSafeCentre(page, await boardCentreScreen(page));
	await expectFocusedInsideSafeArea(page);

	await trigger.click();
	await expect(stage).toHaveAttribute("data-framed", "true");
	await expectAtSafeCentre(page, await focusBoundsCentreScreen(page));

	// Read-only shares get the same dock: double-click frames the board and
	// the camera lock disables wheel zoom.
	await doubleClickBoard(page, 0);
	await waitForDockIndex(page, 0);
	await expect(stage).toHaveAttribute("data-focus-target", "board");
	await expect(page.getByTestId("board-lock")).not.toHaveAttribute(
		"aria-disabled",
		"true",
	);
	await page.getByTestId("board-lock").click();
	await expect(page.getByTestId("board-lock")).toHaveAttribute(
		"aria-pressed",
		"true",
	);
	const locked = await stageTransform(page);
	await page.mouse.move(640, 300);
	await page.mouse.wheel(0, -300);
	expect(await stageTransform(page)).toEqual(locked);
});

test("saving a share copy frames the new document", async ({ page }) => {
	const hash = shareHash({
		boards: [board("shared-board", { x: 300, y: 220 })],
		items: [],
	});
	await page.goto(`/?share=1${hash}`);
	const stage = page.getByTestId("stage");
	await expect(stage).toBeVisible();
	await expect(stage).toHaveAttribute("data-framed", "true");

	// Move away from the preview frame, then save a copy.
	await panBy(page, 180, 120);
	await page.mouse.wheel(0, 240);
	await expect(stage).toHaveAttribute("data-framed", "false");
	const epochBefore = await focusEpoch(page);

	await page.getByTestId("share-save-copy").click();
	await expect(page.getByTestId("share-saved")).toBeVisible();
	await expect(page.getByTestId("share-stamp")).toHaveCount(0);
	await expect(page.locator("main")).not.toHaveAttribute(
		"data-readonly",
		"true",
	);
	await expect(stage).toHaveAttribute("data-framed", "true");
	expect(await focusEpoch(page)).toBe(epochBefore + 1);
	await expectAtSafeCentre(page, await boardCentreScreen(page));
	await expectFocusedInsideSafeArea(page);
});

test("leaving a shared preview frames the recipient scene again", async ({
	page,
}) => {
	// The recipient starts with a board of their own; the share link carries a
	// different board far away.
	await page.goto("/");
	await addBoard(page, "boss-bcb-1000");
	await expect(page.getByTestId("stage")).toHaveAttribute("data-boards", "1");
	await waitForSavedScene(page, (document) => document.boards.length === 1);

	const hash = shareHash({
		boards: [board("shared-board", { x: 300, y: 220 })],
		items: [],
	});
	await page.goto(`/?share=1${hash}`);
	const stage = page.getByTestId("stage");
	await expect(page.getByTestId("share-stamp")).toBeVisible();
	await expect(stage).toHaveAttribute("data-framed", "true");
	const epochBefore = await focusEpoch(page);

	await page.getByTestId("share-exit").click();
	await expect(page.getByTestId("share-stamp")).toHaveCount(0);
	await expect(page.locator("main")).not.toHaveAttribute(
		"data-readonly",
		"true",
	);
	await expect(stage).toHaveAttribute("data-framed", "true");
	expect(await focusEpoch(page)).toBe(epochBefore + 1);
	await expectAtSafeCentre(page, await boardCentreScreen(page));
	await expectFocusedInsideSafeArea(page);
});
