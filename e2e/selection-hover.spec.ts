import { expect, type Page, test } from "@playwright/test";
import { addBoard, addPedal } from "./picker.ts";
import { board, item, shareHash } from "./share.ts";
import { boardScreenCentre, firstItemScreenCentre } from "./stage.ts";

const PEDAL_CM = { widthCm: 7.3, heightCm: 13.02 };
const BOARD_CM = { widthCm: 55.88, heightCm: 35.23 };
const PX_PER_CM = 4;

async function stageBox(page: Page) {
	const box = await page.getByTestId("stage").boundingBox();
	if (!box) throw new Error("stage has no bounding box");
	return box;
}

async function clearSelection(page: Page) {
	const box = await stageBox(page);
	await page.mouse.click(box.x + box.width - 40, box.y + box.height - 120);
}

/** Connections are off by default (owner decision): opt in via the Patch popover. */
async function showPatch(page: Page) {
	await page.getByTestId("endpoint-open").click();
	const toggle = page.getByTestId("toggle-cables");
	if (!(await toggle.isChecked())) await toggle.check();
	await page.keyboard.press("Escape");
}

async function anchorScreenPoint(page: Page, key: string) {
	const stage = page.getByTestId("stage");
	const box = await stage.boundingBox();
	if (!box) throw new Error("stage has no bounding box");
	const scale = Number(await stage.getAttribute("data-scale")) || 1;
	const vx = Number(await stage.getAttribute("data-x")) || 0;
	const vy = Number(await stage.getAttribute("data-y")) || 0;
	const anchors = (await stage.getAttribute("data-jack-anchors")) ?? "";
	const entry = anchors
		.split(";")
		.find((candidate) => candidate.startsWith(`${key}@`));
	if (!entry) throw new Error(`anchor ${key} not found in ${anchors}`);
	const [x, y] = entry
		.slice(key.length + 1)
		.split(",")
		.map(Number);
	return {
		x: box.x + x * PX_PER_CM * scale + vx,
		y: box.y + y * PX_PER_CM * scale + vy,
	};
}

async function endpointScreenPoint(page: Page, index = 0) {
	const stage = page.getByTestId("stage");
	const box = await stage.boundingBox();
	if (!box) throw new Error("stage has no bounding box");
	const scale = Number(await stage.getAttribute("data-scale")) || 1;
	const vx = Number(await stage.getAttribute("data-x")) || 0;
	const vy = Number(await stage.getAttribute("data-y")) || 0;
	const entry = (
		(await stage.getAttribute("data-endpoint-positions")) ?? ""
	).split(";")[index];
	if (!entry) throw new Error("endpoint position missing");
	const [x, y] = entry.split(",").map(Number);
	return {
		x: box.x + x * PX_PER_CM * scale + vx,
		y: box.y + y * PX_PER_CM * scale + vy,
	};
}

async function firstTwoItemJacks(page: Page) {
	const stage = page.getByTestId("stage");
	const anchors = (await stage.getAttribute("data-jack-anchors")) ?? "";
	const keys = anchors
		.split(";")
		.filter((entry) => entry.startsWith("item:"))
		.map((entry) => entry.split("@")[0]);
	const uidA = keys.find((key) => key.startsWith("item:"))?.split(":")[1];
	const second = keys.find((key) => !key.startsWith(`item:${uidA}:`));
	if (!uidA || !second) throw new Error("expected two jacked items");
	const uidB = second.split(":")[1];
	return { outA: `item:${uidA}:1`, inB: `item:${uidB}:0` };
}

async function dragBetween(
	page: Page,
	from: { x: number; y: number },
	to: { x: number; y: number },
) {
	await page.mouse.move(from.x, from.y);
	await page.mouse.down();
	await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, {
		steps: 6,
	});
	await page.mouse.move(to.x, to.y, { steps: 6 });
	await page.mouse.up();
}

test.describe("F-07 selection hover", () => {
	test.beforeEach(() => {
		test.skip(test.info().project.name !== "chromium", "desktop viewport only");
	});

	test("board and pedal hover previews are distinct (desktop)", async ({
		page,
	}) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.goto("/");
		const stage = page.getByTestId("stage");
		await addBoard(page, "boss-bcb-1000");
		await addPedal(page, "boss-bd-2-blues-driver");
		await expect(stage).toHaveAttribute("data-items", "1");
		await clearSelection(page);
		await expect(stage).toHaveAttribute("data-hovered-kind", "");

		// A board corner (clear of the pedal and the read-only stamp).
		const boardCentre = await boardScreenCentre(page, BOARD_CM);
		const box = await stageBox(page);
		await page.mouse.move(boardCentre.x + 60, boardCentre.y - 40);
		await expect(stage).toHaveAttribute("data-hovered-kind", "board");
		const boardUid = await stage.getAttribute("data-hovered-target");
		expect(boardUid).toBeTruthy();

		// Hovering the pedal on the board shows the pedal, never the deck.
		const pedal = await firstItemScreenCentre(page, PEDAL_CM);
		await page.mouse.move(pedal.x, pedal.y);
		await expect(stage).toHaveAttribute("data-hovered-kind", "item");

		// Selecting the pedal suppresses its preview.
		await page.mouse.click(pedal.x, pedal.y);
		await expect(stage).toHaveAttribute("data-selected-kind", "item");
		await page.mouse.move(box.x + box.width - 40, box.y + box.height - 40);
		await page.mouse.move(pedal.x, pedal.y);
		await expect(stage).toHaveAttribute("data-hovered-kind", "");

		// Selecting the board suppresses its preview too.
		await clearSelection(page);
		await page.mouse.click(boardCentre.x - 90, boardCentre.y + 70);
		await expect(stage).toHaveAttribute("data-selected-kind", "board");
		await page.mouse.move(box.x + box.width - 40, box.y + box.height - 40);
		await page.mouse.move(boardCentre.x - 90, boardCentre.y + 70);
		await expect(stage).toHaveAttribute("data-hovered-kind", "");

		// Moving off the content clears the preview.
		await page.mouse.move(box.x + box.width - 40, box.y + box.height - 40);
		await expect(stage).toHaveAttribute("data-hovered-kind", "");
	});

	test("cable hover previews selection without dimming other cables", async ({
		page,
	}) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.goto("/");
		const stage = page.getByTestId("stage");
		await addPedal(page, "boss-bd-2-blues-driver");
		await addPedal(page, "boss-da-2-adaptive-distortion");
		await showPatch(page);
		const { outA, inB } = await firstTwoItemJacks(page);
		await clearSelection(page);
		await expect(stage).toHaveAttribute("data-selected-uid", "");
		const from = await anchorScreenPoint(page, outA);
		const to = await anchorScreenPoint(page, inB);
		await dragBetween(page, from, to);
		await expect(stage).toHaveAttribute("data-cables", "1");
		// Let the graph's reveal tween finish (the layer is non-listening mid-reveal).
		await page.waitForTimeout(400);
		// The jack press selects the source pedal; clear it so the cable hover is
		// tested in isolation (no selected item to dim the graph).
		await clearSelection(page);
		await expect(stage).toHaveAttribute("data-selected-uid", "");
		await expect(stage).toHaveAttribute("data-cable-dim-focus", "");

		await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2);
		await expect(stage).toHaveAttribute("data-hovered-kind", "cable");
		await expect(stage).toHaveAttribute("data-hovered-target", /.+/);
		// Hovering a cable never dims the graph (item-only dim focus).
		await expect(stage).toHaveAttribute("data-cable-dim-focus", "");

		// Hovering a pedal feeds the item-only dim focus.
		const pedal = await firstItemScreenCentre(page, PEDAL_CM);
		await page.mouse.move(pedal.x, pedal.y);
		await expect(stage).toHaveAttribute("data-hovered-kind", "item");
		const itemUid = await stage.getAttribute("data-hovered-target");
		await expect(stage).toHaveAttribute("data-cable-dim-focus", itemUid ?? "");

		const box = await stageBox(page);
		await page.mouse.move(box.x + box.width - 40, box.y + box.height - 40);
		await expect(stage).toHaveAttribute("data-hovered-kind", "");
	});

	test("endpoint hover previews selection (desktop)", async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.goto("/");
		const stage = page.getByTestId("stage");
		const box = await stageBox(page);
		const point = { x: box.x + 150, y: box.y + box.height - 150 };

		await page.getByTestId("endpoint-open").click();
		await page.getByTestId("endpoint-add-instrument").click();
		await expect(page.getByTestId("endpoint-placement")).toBeVisible();
		await page.mouse.click(point.x, point.y);
		await expect(stage).toHaveAttribute("data-endpoints", "1");
		await expect(page.getByTestId("endpoint-placement")).toHaveCount(0);
		// Let the endpoint's reveal tween finish (non-listening mid-reveal).
		await page.waitForTimeout(400);

		// Hover the tag's exact world position (the placement click is offset by
		// the overlay rect, so the click point is not always the tag centre).
		await page.mouse.move(box.x + 20, box.y + 20);
		const tag = await endpointScreenPoint(page);
		await page.mouse.move(tag.x, tag.y);
		await expect(stage).toHaveAttribute("data-hovered-kind", "endpoint");
	});

	test("Patch popover focus in, Escape return and Escape scoping", async ({
		page,
	}) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.goto("/");
		const trigger = page.getByTestId("endpoint-open");
		const popover = page.getByTestId("endpoint-popover");

		await trigger.click();
		await expect(popover).toBeVisible();
		await expect(page.getByTestId("endpoint-add-amp")).toBeFocused();
		await expect(trigger).toHaveAttribute(
			"aria-controls",
			(await popover.getAttribute("id")) ?? "endpoint-popover",
		);

		await page.keyboard.press("Escape");
		await expect(popover).toHaveCount(0);
		await expect(trigger).toBeFocused();

		// Arm placement, reopen the popover, then Escape: only the popover closes.
		await trigger.click();
		await page.getByTestId("endpoint-add-instrument").click();
		await expect(page.getByTestId("endpoint-placement")).toBeVisible();
		await trigger.click();
		await expect(popover).toBeVisible();
		await page.keyboard.press("Escape");
		await expect(popover).toHaveCount(0);
		await expect(page.getByTestId("endpoint-placement")).toBeVisible();
		await expect(trigger).toHaveAttribute("aria-pressed", "true");

		// A second Escape now disarms placement.
		await page.keyboard.press("Escape");
		await expect(page.getByTestId("endpoint-placement")).toHaveCount(0);

		// Outside tap closes and returns focus (focus was inside).
		await trigger.click();
		await expect(popover).toBeVisible();
		await expect(page.getByTestId("endpoint-add-amp")).toBeFocused();
		const box = await stageBox(page);
		await page.mouse.click(box.x + box.width - 40, box.y + box.height - 40);
		await expect(popover).toHaveCount(0);
		await expect(trigger).toBeFocused();

		// Tabbing out closes (non-modal, no trap).
		await trigger.click();
		await expect(popover).toBeVisible();
		await expect(page.getByTestId("endpoint-add-amp")).toBeFocused();
		for (let index = 0; index < 4; index += 1) {
			await page.keyboard.press("Tab");
		}
		await expect(popover).toHaveCount(0);
	});

	test("read-only share previews pedals and boards only", async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		const hash = shareHash({
			name: "F-07 read-only",
			boards: [board("b1", { x: 20, y: 20 })],
			items: [
				item("i1", { boardUid: "b1", x: 5, y: 5 }),
				item("i2", { boardUid: "b1", x: 20, y: 5 }),
			],
			endpoints: [{ uid: "e1", kind: "instrument", x: 0, y: 20 }],
			cables: [
				{
					uid: "c1",
					from: { itemUid: "i1", jack: "1" },
					to: { itemUid: "i2", jack: "0" },
				},
			],
		});
		await page.goto(`/${hash}`);
		const stage = page.getByTestId("stage");
		await expect(stage).toHaveAttribute("data-boards", "1");
		await expect(stage).toHaveAttribute("data-cables", "1");

		// Pedal + board are selectable in a share, so they preview on hover.
		const pedal = await firstItemScreenCentre(page, PEDAL_CM);
		await page.mouse.move(pedal.x, pedal.y);
		await expect(stage).toHaveAttribute("data-hovered-kind", "item");

		await page.waitForTimeout(300);
		const box = await stageBox(page);
		const scale = Number(await stage.getAttribute("data-scale")) || 1;
		const vx = Number(await stage.getAttribute("data-x")) || 0;
		const vy = Number(await stage.getAttribute("data-y")) || 0;
		const [bx, by] = ((await stage.getAttribute("data-positions")) ?? "")
			.split(";")[0]
			.split(",")
			.map(Number);
		// The board's top-right area, clear of the two pedals at x 5/20, y 5.
		await page.mouse.move(
			box.x + (bx + 50) * PX_PER_CM * scale + vx,
			box.y + (by + 2) * PX_PER_CM * scale + vy,
		);
		await expect(stage).toHaveAttribute("data-hovered-kind", "board");

		// Cables and endpoints are not selectable in a share, so they never hover.
		const { outA, inB } = await firstTwoItemJacks(page);
		const from = await anchorScreenPoint(page, outA);
		const to = await anchorScreenPoint(page, inB);
		await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2);
		await expect(stage).not.toHaveAttribute("data-hovered-kind", "cable");
		const tag = await endpointScreenPoint(page);
		await page.mouse.move(tag.x, tag.y);
		await expect(stage).not.toHaveAttribute("data-hovered-kind", "endpoint");
	});

	test("hover follows the pointer at zoomed-out and zoomed-in scales", async ({
		page,
	}) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.goto("/");
		const stage = page.getByTestId("stage");
		await addPedal(page, "boss-bd-2-blues-driver");
		await clearSelection(page);

		const pedal = await firstItemScreenCentre(page, PEDAL_CM);
		await page.mouse.move(pedal.x, pedal.y);
		for (let index = 0; index < 2; index += 1) {
			await page.mouse.wheel(0, 600);
		}
		await expect
			.poll(async () => Number(await stage.getAttribute("data-scale")))
			.toBeLessThan(0.6);
		const box = await stageBox(page);
		await page.mouse.move(box.x + 20, box.y + 20);
		const zoomedOut = await firstItemScreenCentre(page, PEDAL_CM);
		await page.mouse.move(zoomedOut.x, zoomedOut.y);
		await expect(stage).toHaveAttribute("data-hovered-kind", "item");

		for (let index = 0; index < 3; index += 1) {
			await page.mouse.wheel(0, -600);
		}
		await expect
			.poll(async () => Number(await stage.getAttribute("data-scale")))
			.toBeGreaterThan(1.5);
		await page.mouse.move(box.x + 20, box.y + 20);
		const zoomed = await firstItemScreenCentre(page, PEDAL_CM);
		await page.mouse.move(zoomed.x, zoomed.y);
		await expect(stage).toHaveAttribute("data-hovered-kind", "item");
	});

	test("organization color popover wires aria-controls", async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.goto("/");
		await addPedal(page, "boss-bd-2-blues-driver");
		const trigger = page.getByTestId("item-color-trigger");
		await expect(trigger).toBeVisible();
		await trigger.click();
		const popover = page.getByTestId("item-color-popover");
		await expect(popover).toBeVisible();
		await expect(trigger).toHaveAttribute(
			"aria-controls",
			"item-color-popover",
		);
		await expect(popover).toHaveAttribute("id", "item-color-popover");
		await page.keyboard.press("Escape");
		await expect(popover).toHaveCount(0);
	});
});

test.describe("F-07 selection hover (mobile)", () => {
	test.beforeEach(() => {
		test.skip(
			test.info().project.name !== "mobile-chromium",
			"mobile viewport only",
		);
	});

	test("no sticky hover after a tap; Patch popover focus works", async ({
		page,
	}) => {
		await page.goto("/");
		const stage = page.getByTestId("stage");
		await addPedal(page, "boss-bd-2-blues-driver");
		await expect(stage).toHaveAttribute("data-items", "1");
		await expect(stage).toHaveAttribute("data-hovered-kind", "");

		const pedal = await firstItemScreenCentre(page, PEDAL_CM);
		await page.touchscreen.tap(pedal.x, pedal.y);
		await expect(stage).toHaveAttribute("data-hovered-kind", "");

		const trigger = page.getByTestId("endpoint-open");
		await trigger.click();
		await expect(page.getByTestId("endpoint-popover")).toBeVisible();
		await expect(page.getByTestId("endpoint-add-amp")).toBeFocused();
		await page.keyboard.press("Escape");
		await expect(page.getByTestId("endpoint-popover")).toHaveCount(0);
		await expect(trigger).toBeFocused();
	});
});
