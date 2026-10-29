import { expect, type Page, test } from "@playwright/test";
import {
	activeSceneId,
	readSceneDocument,
	waitForSavedScene,
} from "./persistence.ts";
import { addPedal } from "./picker.ts";
import { item, shareHash } from "./share.ts";

const PX_PER_CM = 4;

/** Screen coordinates of a debug jack/endpoint anchor (`key@xCm,yCm`). */
async function anchorScreenPoint(
	page: Page,
	key: string,
): Promise<{ x: number; y: number }> {
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

async function clearSelection(page: Page): Promise<void> {
	const stage = page.getByTestId("stage");
	const box = await stage.boundingBox();
	if (!box) return;
	await page.mouse.click(box.x + 16, box.y + 120);
}

async function showPatch(page: Page): Promise<void> {
	await page.getByTestId("endpoint-open").click();
	const toggle = page.getByTestId("toggle-cables");
	if (!(await toggle.isChecked())) await toggle.check();
	await page.keyboard.press("Escape");
}

async function dragBetween(
	page: Page,
	from: { x: number; y: number },
	to: { x: number; y: number },
): Promise<void> {
	await page.mouse.move(from.x, from.y);
	await page.mouse.down();
	await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, {
		steps: 6,
	});
	await page.mouse.move(to.x, to.y, { steps: 6 });
	await page.mouse.up();
}

/** The first two item uids + their in/out jack keys. */
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
	return {
		outA: `item:${uidA}:1`,
		inB: `item:${uidB}:0`,
		uidA,
		uidB,
	};
}

async function connectFirstTwo(page: Page): Promise<void> {
	await addPedal(page, "boss-bd-2-blues-driver");
	await addPedal(page, "boss-da-2-adaptive-distortion");
	const { outA, inB } = await firstTwoItemJacks(page);
	await showPatch(page);
	await clearSelection(page);
	await dragBetween(
		page,
		await anchorScreenPoint(page, outA),
		await anchorScreenPoint(page, inB),
	);
	await expect(page.getByTestId("stage")).toHaveAttribute("data-cables", "1");
}

async function openSchedule(page: Page): Promise<void> {
	// A selected item's HTML action bar can sit over the top-right popover.
	await clearSelection(page);
	await page.getByTestId("endpoint-open").click();
	await page.getByTestId("schedule-open").click();
	await expect(page.getByTestId("cable-schedule")).toBeVisible();
}

test("shows the ordered signal path, lengths, totals and unconnected flags", async ({
	page,
}) => {
	await page.goto("/");
	await connectFirstTwo(page);
	// A third pedal stays unconnected and must be flagged.
	await addPedal(page, "mxr-bass-distortion");
	await openSchedule(page);

	const panel = page.getByTestId("cable-schedule");
	await expect(panel.getByTestId("cable-schedule-row")).toHaveCount(1);
	const row = panel.getByTestId("cable-schedule-row").first();
	await expect(row).toContainText("OUT");
	await expect(row).toContainText("IN");
	await expect(row).toContainText("Mono");
	await expect(panel).toContainText("Signal path");
	await expect(panel).toContainText("Totals");
	await expect(panel).toContainText("Unconnected");
	await expect(panel).toContainText("Bass Distortion");
	await expect(panel).toContainText("Total 1 cable");

	// Escape closes and returns focus to the Patch trigger.
	await page.keyboard.press("Escape");
	await expect(panel).toHaveCount(0);
	await expect(page.getByTestId("endpoint-open")).toBeFocused();
});

test("the schedule stays closed while the patch is hidden until opened", async ({
	page,
}) => {
	await page.goto("/");
	await connectFirstTwo(page);
	// Turn the view preference off again; the hidden-patch cue is the canvas cue.
	await page.getByTestId("endpoint-open").click();
	await page.getByTestId("toggle-cables").uncheck();
	await page.keyboard.press("Escape");
	await expect(page.getByTestId("patch-hidden")).toBeVisible();
	await expect(page.getByTestId("cable-schedule")).toHaveCount(0);

	await openSchedule(page);
	const panel = page.getByTestId("cable-schedule");
	await expect(panel).toBeVisible();
	await expect(panel.getByTestId("cable-schedule-row")).toHaveCount(1);
	await expect(page.getByTestId("stage")).toHaveAttribute("data-cables", "1");
});

test("the empty state offers Show patch but never auto-opens the summary", async ({
	page,
}) => {
	await page.goto("/");
	await addPedal(page, "boss-bd-2-blues-driver");
	await expect(page.getByTestId("cable-schedule")).toHaveCount(0);
	await openSchedule(page);
	const panel = page.getByTestId("cable-schedule");
	await expect(panel).toContainText("Nothing patched yet.");
	const showPatchButton = page.getByTestId("cable-schedule-show-patch");
	await expect(showPatchButton).toBeVisible();
	await showPatchButton.click();
	await expect(panel).toBeVisible();
	// Enabling the patch unmounts the CTA; focus must stay in the dialog.
	await expect(panel).toBeFocused();

	await page.keyboard.press("Escape");
	await page.getByTestId("endpoint-open").click();
	await expect(page.getByTestId("toggle-cables")).toBeChecked();
});

test("read-only share recipients can open the derived schedule", async ({
	page,
}) => {
	const hash = shareHash({
		name: "Shared patch",
		boards: [],
		items: [
			item("p1", { x: 10, y: 10 }),
			item("p2", { refId: "boss-da-2-adaptive-distortion", x: 40, y: 10 }),
		],
		endpoints: [
			{ uid: "inst", kind: "instrument", x: 0, y: 0 },
			{ uid: "amp", kind: "amp", x: 60, y: 15 },
		],
		cables: [
			{
				uid: "c1",
				from: { endpointUid: "inst" },
				to: { itemUid: "p1", jack: "0" },
			},
			{
				uid: "c2",
				from: { itemUid: "p1", jack: "1" },
				to: { itemUid: "p2", jack: "0" },
			},
			{
				uid: "c3",
				from: { itemUid: "p2", jack: "1" },
				to: { endpointUid: "amp" },
			},
		],
	});
	await page.goto(`/${hash}`);
	await expect(page.getByTestId("share-stamp")).toBeVisible();
	await expect(page.getByTestId("stage")).toHaveAttribute("data-cables", "3");
	await page.getByTestId("schedule-open-readonly").click();
	const panel = page.getByTestId("cable-schedule");
	await expect(panel).toBeVisible();
	await expect(panel.getByTestId("cable-schedule-row")).toHaveCount(3);
	await expect(panel.getByTestId("cable-schedule-row").first()).toContainText(
		"Instrument",
	);
	await expect(panel.getByTestId("cable-schedule-row").last()).toContainText(
		"Amp input",
	);
	// A recipient cannot edit, but the derived list is readable and local.
	await expect(page.getByTestId("share-stamp")).toBeVisible();
});

test("mobile tray stays above the tab bar and leaves the canvas usable", async ({
	page,
}) => {
	await page.setViewportSize({ width: 360, height: 840 });
	await page.goto("/");
	await connectFirstTwo(page);
	await openSchedule(page);

	const panel = page.getByTestId("cable-schedule");
	// Let the F-05 6px settle finish before measuring the final tray geometry.
	await expect(panel).toHaveCSS("transform", "none");
	const box = await panel.boundingBox();
	if (!box) throw new Error("schedule has no box");
	expect(box.x).toBeGreaterThanOrEqual(8);
	expect(box.x + box.width).toBeLessThanOrEqual(352);
	// Capped at 52dvh: a meaningful working area remains above the tray.
	expect(box.height).toBeLessThanOrEqual(840 * 0.52 + 1);
	expect(box.y + box.height).toBeLessThanOrEqual(840);
	// The persistent mobile dock is still visible below the tray.
	const dock = page.getByTestId("picker-dock");
	await expect(dock).toBeVisible();
	const dockBox = await dock.boundingBox();
	if (!dockBox) throw new Error("dock has no box");
	expect(box.y + box.height).toBeLessThanOrEqual(dockBox.y + 1);

	const close = page.getByTestId("cable-schedule-close");
	const closeBox = await close.boundingBox();
	if (!closeBox) throw new Error("close has no box");
	expect(closeBox.width).toBeGreaterThanOrEqual(44);
	expect(closeBox.height).toBeGreaterThanOrEqual(44);
	await close.click();
	await expect(panel).toHaveCount(0);
});

test("opening the schedule never mutates the scene or history", async ({
	page,
}) => {
	await page.goto("/");
	await connectFirstTwo(page);
	const stage = page.getByTestId("stage");
	await waitForSavedScene(page, (document) => document.cables?.length === 1);
	const id = await activeSceneId(page);
	if (!id) throw new Error("active scene id missing");
	const before = await readSceneDocument(page, id);
	const undoBefore = (await stage.getAttribute("data-undo-depth")) ?? "";
	await openSchedule(page);
	await expect(page.getByTestId("cable-schedule-row")).toHaveCount(1);
	await page.keyboard.press("Escape");
	await expect(page.getByTestId("cable-schedule")).toHaveCount(0);
	// The summary is a pure readout: no cable, no history entry, and the
	// persisted document (the source for export/share) is byte-identical.
	await expect(stage).toHaveAttribute("data-cables", "1");
	await expect(stage).toHaveAttribute("data-undo-depth", undoBefore);
	const after = await readSceneDocument(page, id);
	expect(after).toEqual(before);
});
