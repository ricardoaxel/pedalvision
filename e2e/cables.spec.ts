import { expect, type Page, test } from "@playwright/test";
import { waitForSavedScene } from "./persistence.ts";
import { addPedal } from "./picker.ts";
import { board, item, shareHash } from "./share.ts";

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

/**
 * Clear any selection first: on a phone the item action bar can sit over a
 * neighbouring pedal's jack tick. Tapping empty canvas is the normal way to
 * dismiss it (the bar is not a permanent tool).
 */
async function clearSelection(page: Page): Promise<void> {
	const stage = page.getByTestId("stage");
	const box = await stage.boundingBox();
	if (!box) return;
	await page.mouse.click(box.x + 16, box.y + 120);
}

/** Connections are off by default (owner decision): opt in via the Patch popover. */
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

/** The first item's in/out jack keys. */
async function firstItemJacks(page: Page) {
	const stage = page.getByTestId("stage");
	const anchors = (await stage.getAttribute("data-jack-anchors")) ?? "";
	const keys = anchors
		.split(";")
		.filter((entry) => entry.startsWith("item:"))
		.map((entry) => entry.split("@")[0]);
	const outKey = keys.find((key) => key.endsWith(":1"));
	const inKey = keys.find((key) => key.endsWith(":0"));
	if (!outKey || !inKey) throw new Error("expected a jacked item");
	return { outA: outKey, inA: inKey, uidA: outKey.split(":")[1] };
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

test("drags jack → jack, renders a direction arrow and autosaves", async ({
	page,
}) => {
	await page.goto("/");
	const stage = page.getByTestId("stage");
	await addPedal(page, "boss-bd-2-blues-driver");
	await addPedal(page, "boss-da-2-adaptive-distortion");
	await expect(stage).toHaveAttribute("data-items", "2");

	const { outA, inB, uidA, uidB } = await firstTwoItemJacks(page);
	await showPatch(page);
	const undoBefore = Number(await stage.getAttribute("data-undo-depth"));
	await clearSelection(page);
	await dragBetween(
		page,
		await anchorScreenPoint(page, outA),
		await anchorScreenPoint(page, inB),
	);

	await expect(stage).toHaveAttribute("data-cables", "1");
	await expect(stage).toHaveAttribute("data-cable-arrows", "1");
	await expect(stage).toHaveAttribute(
		"data-cable-directions",
		`item:${uidA}:1>item:${uidB}:0`,
	);

	// One commit → exactly one history step and one autosaved document.
	await expect(stage).toHaveAttribute(
		"data-undo-depth",
		String(undoBefore + 1),
	);
	await waitForSavedScene(page, (document) => document.cables?.length === 1);

	await page.reload();
	await expect(page.getByTestId("stage")).toHaveAttribute("data-cables", "1");
	await expect(page.getByTestId("stage")).toHaveAttribute(
		"data-cable-arrows",
		"1",
	);
});

test("a backwards drag is stored with the signal direction", async ({
	page,
}) => {
	await page.goto("/");
	const stage = page.getByTestId("stage");
	await addPedal(page, "boss-bd-2-blues-driver");
	await addPedal(page, "boss-da-2-adaptive-distortion");
	const { uidA, uidB } = await firstTwoItemJacks(page);
	await showPatch(page);
	await clearSelection(page);
	// Drag from A's IN to B's OUT (backwards): the stored cable must be B OUT → A IN.
	await dragBetween(
		page,
		await anchorScreenPoint(page, `item:${uidA}:0`),
		await anchorScreenPoint(page, `item:${uidB}:1`),
	);
	await expect(stage).toHaveAttribute("data-cables", "1");
	await expect(stage).toHaveAttribute(
		"data-cable-directions",
		`item:${uidB}:1>item:${uidA}:0`,
	);
});

test("a mono jack accepts only one cable (no second connection)", async ({
	page,
}) => {
	await page.goto("/");
	const stage = page.getByTestId("stage");
	await addPedal(page, "boss-bd-2-blues-driver");
	await addPedal(page, "boss-da-2-adaptive-distortion");
	await addPedal(page, "mxr-bass-distortion");
	const { outA, inB, uidA, uidB } = await firstTwoItemJacks(page);
	await showPatch(page);
	await clearSelection(page);

	const from = await anchorScreenPoint(page, outA);
	await dragBetween(page, from, await anchorScreenPoint(page, inB));
	await expect(stage).toHaveAttribute("data-cables", "1");

	// A second drag from the same (now occupied) mono output must not start.
	await dragBetween(page, from, {
		x: from.x + 120,
		y: from.y + 60,
	});
	// The cable path sits above the pedal (and covers the occupied tick), so a
	// press there selects that cable — but no second connection may be created.
	await expect(stage).toHaveAttribute("data-cables", "1");

	// A free output → the occupied output is also refused (no snap/commit).
	const outB = `item:${uidB}:1`;
	await dragBetween(
		page,
		await anchorScreenPoint(page, outB),
		await anchorScreenPoint(page, outA),
	);
	await expect(stage).toHaveAttribute("data-cables", "1");
	// The first cable is still the only one and still points the right way.
	await expect(stage).toHaveAttribute(
		"data-cable-directions",
		`item:${uidA}:1>item:${uidB}:0`,
	);
});

test("armed endpoint placement never swallows a toolbar tap", async ({
	page,
}) => {
	await page.goto("/");
	const stage = page.getByTestId("stage");
	await page.getByTestId("endpoint-open").click();
	await page.getByTestId("endpoint-add-amp").click();
	await expect(page.getByTestId("endpoint-placement")).toBeVisible();
	// The placement overlay sits below the chrome: Export must open normally.
	await page.getByTestId("export-open").click();
	await expect(page.getByTestId("export-panel")).toBeVisible();
	await expect(stage).toHaveAttribute("data-endpoints", "0");
});

test("escapes and empty releases never create a cable", async ({ page }) => {
	await page.goto("/");
	const stage = page.getByTestId("stage");
	await addPedal(page, "boss-bd-2-blues-driver");
	await addPedal(page, "boss-da-2-adaptive-distortion");
	const { outA } = await firstTwoItemJacks(page);
	await showPatch(page);
	await clearSelection(page);
	const from = await anchorScreenPoint(page, outA);

	// Release over empty canvas → no cable.
	await dragBetween(page, from, {
		x: from.x + 180,
		y: from.y + 140,
	});
	await expect(stage).toHaveAttribute("data-cables", "0");

	// Esc mid-drag cancels the preview and commits nothing.
	await page.mouse.move(from.x, from.y);
	await page.mouse.down();
	await page.mouse.move(from.x + 80, from.y + 40, { steps: 4 });
	await expect(stage).toHaveAttribute("data-cable-preview", outA);
	await page.keyboard.press("Escape");
	await page.mouse.up();
	await expect(stage).toHaveAttribute("data-cable-preview", "");
	await expect(stage).toHaveAttribute("data-cables", "0");
});

test("places an amp endpoint, connects to it, then deletes both", async ({
	page,
}) => {
	await page.goto("/");
	const stage = page.getByTestId("stage");
	await addPedal(page, "boss-bd-2-blues-driver");

	await page.getByTestId("endpoint-open").click();
	await expect(page.getByTestId("endpoint-popover")).toBeVisible();
	await page.getByTestId("endpoint-add-amp").click();
	await expect(page.getByTestId("endpoint-placement")).toBeVisible();
	await expect(page.getByTestId("graph-status")).toContainText("Place Amp");

	const box = await stage.boundingBox();
	if (!box) throw new Error("stage has no bounding box");
	const endpointTap = {
		x: box.x + box.width * 0.7,
		y: box.y + box.height * 0.4,
	};
	await page.mouse.click(endpointTap.x, endpointTap.y);

	await expect(stage).toHaveAttribute("data-endpoints", "1");
	await expect(stage).toHaveAttribute("data-endpoint-kinds", "amp");
	await expect(page.getByTestId("endpoint-placement")).toHaveCount(0);

	const anchors = (await stage.getAttribute("data-jack-anchors")) ?? "";
	const endpointKey = anchors
		.split(";")
		.map((entry) => entry.split("@")[0])
		.find((key) => key.startsWith("endpoint:"));
	if (!endpointKey) throw new Error("endpoint anchor missing");
	const placedEndpoint = await anchorScreenPoint(page, endpointKey);
	expect(Math.abs(placedEndpoint.x - endpointTap.x)).toBeLessThan(2);
	expect(Math.abs(placedEndpoint.y - endpointTap.y)).toBeLessThan(2);
	await expect(page.getByTestId("graph-action-bar")).toHaveCount(0);
	await showPatch(page);
	const { outA } = await firstItemJacks(page);
	await dragBetween(
		page,
		await anchorScreenPoint(page, outA),
		await anchorScreenPoint(page, endpointKey),
	);

	await expect(stage).toHaveAttribute("data-cables", "1");
	await expect(stage).toHaveAttribute("data-cable-arrows", "1");

	// Select the endpoint tag and delete it — its cable goes with it.
	const endpointPoint = await anchorScreenPoint(page, endpointKey);
	await page.mouse.click(endpointPoint.x, endpointPoint.y);
	await expect(page.getByTestId("graph-action-bar")).toBeVisible();
	await page.getByTestId("delete-graph-item").click();
	await expect(stage).toHaveAttribute("data-endpoints", "0");
	await expect(stage).toHaveAttribute("data-cables", "0");
});

test("the mobile patch popover stays inside the viewport", async ({ page }) => {
	await page.setViewportSize({ width: 360, height: 840 });
	await page.goto("/");
	await page.getByTestId("endpoint-open").click();
	const popover = page.getByTestId("endpoint-popover");
	await expect(popover).toBeVisible();
	const box = await popover.boundingBox();
	if (!box) throw new Error("popover has no box");
	expect(box.x).toBeGreaterThanOrEqual(8);
	expect(box.x + box.width).toBeLessThanOrEqual(352);
	await expect(page.getByTestId("toggle-cables")).toBeVisible();
});

test("a direction-rejected drop explains itself", async ({ page }) => {
	await page.goto("/");
	const stage = page.getByTestId("stage");
	await addPedal(page, "boss-bd-2-blues-driver");
	await addPedal(page, "boss-da-2-adaptive-distortion");
	const { uidA, uidB } = await firstTwoItemJacks(page);
	await showPatch(page);
	await clearSelection(page);
	// OUT → OUT is invalid; the release must explain it, not just vanish.
	await dragBetween(
		page,
		await anchorScreenPoint(page, `item:${uidA}:1`),
		await anchorScreenPoint(page, `item:${uidB}:1`),
	);
	await expect(stage).toHaveAttribute("data-cables", "0");
	await expect(page.getByTestId("graph-status")).toContainText("Both ends");
});

test("the show-cables toggle hides the graph and persists", async ({
	page,
}) => {
	await page.goto("/");
	const stage = page.getByTestId("stage");
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
	await expect(stage).toHaveAttribute("data-cables", "1");
	await expect(stage).toHaveAttribute("data-show-cables", "true");

	await page.getByTestId("endpoint-open").click();
	await page.getByTestId("toggle-cables").uncheck();
	await expect(stage).toHaveAttribute("data-show-cables", "false");
	// Scene data is untouched; this is a view preference, with a way back.
	await expect(stage).toHaveAttribute("data-cables", "1");
	await expect(page.getByTestId("patch-hidden")).toBeVisible();
	// Let the debounced autosave land before reloading (the scene must persist).
	await waitForSavedScene(page, (document) => document.cables?.length === 1);

	await page.reload();
	await expect(page.getByTestId("stage")).toHaveAttribute(
		"data-show-cables",
		"false",
	);
	await expect(page.getByTestId("stage")).toHaveAttribute("data-cables", "1");
	await page.getByTestId("endpoint-open").click();
	await page.getByTestId("toggle-cables").check();
	await expect(page.getByTestId("stage")).toHaveAttribute(
		"data-show-cables",
		"true",
	);
});

test("a read-only share always shows the graph even if the recipient hid it", async ({
	page,
}) => {
	await page.goto("/");
	const stage = page.getByTestId("stage");
	await addPedal(page, "boss-bd-2-blues-driver");
	await page.getByTestId("endpoint-open").click();
	await page.getByTestId("toggle-cables").uncheck();
	await expect(stage).toHaveAttribute("data-show-cables", "false");
	const hash = shareHash({
		name: "Read only patch",
		boards: [board("b1")],
		items: [
			item("i1", {
				refId: "boss-bd-2-blues-driver",
				boardUid: "b1",
				x: 4,
				y: 4,
			}),
		],
		endpoints: [{ uid: "ep-amp", kind: "amp", x: 60, y: 20 }],
		cables: [
			{
				uid: "c1",
				from: { itemUid: "i1", jack: "1" },
				to: { endpointUid: "ep-amp" },
			},
		],
	});
	await page.goto(`/?share=1${hash}`);
	await expect(page.getByTestId("share-stamp")).toBeVisible();
	await expect(page.getByTestId("stage")).toHaveAttribute(
		"data-graph-visible",
		"true",
	);
	await expect(page.getByTestId("stage")).toHaveAttribute("data-cables", "1");
});

test("a read-only share renders jack ticks even when patch is hidden", async ({
	page,
}) => {
	// Loose (board-less) pedals keep the board's own read-only cue out of the
	// assertion: outside the tick hit disc there is only empty canvas. Explicit
	// left/right jacks keep the press direction independent of catalog data.
	const hash = shareHash({
		name: "Read only ticks",
		boards: [],
		items: [
			item("i1", { refId: "tick-test", x: 10, y: 80 }),
			item("i2", { refId: "tick-test", x: 30, y: 80 }),
		],
		customPedals: [
			{
				refId: "tick-test",
				brand: "Test",
				name: "Tick Test",
				widthCm: 7.3,
				heightCm: 13.02,
				category: "pedal",
				effectTypes: [],
				jacks: [
					{ kind: "in", edge: "left", pos: 0.5 },
					{ kind: "out", edge: "right", pos: 0.5 },
				],
			},
		],
		cables: [
			{
				uid: "c1",
				from: { itemUid: "i1", jack: "1" },
				to: { itemUid: "i2", jack: "0" },
			},
		],
	});
	await page.goto(`/?share=1${hash}`);
	const stage = page.getByTestId("stage");
	await expect(page.getByTestId("share-stamp")).toBeVisible();
	// Recipient preference is hidden, but a share always shows the graph.
	await expect(stage).toHaveAttribute("data-show-cables", "false");
	await expect(stage).toHaveAttribute("data-graph-visible", "true");
	await expect(stage).toHaveAttribute("data-cables", "1");

	// Press 10 screen px outside the IN edge: within the outward-biased hit
	// disc, but outside the pedal. Before ticks rendered this was empty canvas
	// (no cue); now the jack attempt raises the item's read-only cue.
	const anchor = await anchorScreenPoint(page, "item:i1:0");
	await page.mouse.move(anchor.x - 10, anchor.y);
	await page.mouse.down();
	await page.mouse.move(anchor.x - 50, anchor.y + 24, { steps: 6 });
	await page.mouse.up();
	await expect(page.getByTestId("share-edit-cue")).toBeVisible();
	await expect(stage).toHaveAttribute("data-readonly-cue", "item:i1");
	// Read-only: no mutation from the socket attempt.
	await expect(stage).toHaveAttribute("data-cables", "1");
	await expect(page.getByTestId("graph-action-bar")).toHaveCount(0);
});

test("a read-only share shows hollow fallback ticks and the cue", async ({
	page,
}) => {
	// A catalog pedal with no jack data gets the documented fallback pair
	// (hollow diamond IN left / OUT right) — the other half of the tick gate.
	const hash = shareHash({
		name: "Fallback ticks",
		boards: [],
		items: [
			item("i1", { refId: "boss-da-2-adaptive-distortion", x: 10, y: 80 }),
			item("i2", { refId: "boss-da-2-adaptive-distortion", x: 30, y: 80 }),
		],
		cables: [
			{
				uid: "c1",
				from: { itemUid: "i1", jack: "1" },
				to: { itemUid: "i2", jack: "0" },
			},
		],
	});
	await page.goto(`/?share=1${hash}`);
	const stage = page.getByTestId("stage");
	await expect(page.getByTestId("share-stamp")).toBeVisible();
	await expect(stage).toHaveAttribute("data-graph-visible", "true");
	await expect(stage).toHaveAttribute("data-cables", "1");
	await expect(stage).toHaveAttribute("data-cable-arrows", "1");

	const anchor = await anchorScreenPoint(page, "item:i1:0");
	await page.mouse.move(anchor.x - 10, anchor.y);
	await page.mouse.down();
	await page.mouse.move(anchor.x - 50, anchor.y + 24, { steps: 6 });
	await page.mouse.up();
	await expect(stage).toHaveAttribute("data-readonly-cue", "item:i1");
	await expect(stage).toHaveAttribute("data-cables", "1");
	await expect(stage).toHaveAttribute("data-cable-arrows", "1");
});

test("share v2 round-trips cables and endpoints read-only", async ({
	page,
}) => {
	await page.goto("/");
	const stage = page.getByTestId("stage");
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
	await expect(stage).toHaveAttribute("data-cables", "1");

	await page.getByTestId("share-open").click();
	const link = page.getByTestId("share-link");
	await expect(link).toBeVisible();
	await expect(page.getByTestId("share-panel")).toContainText("V2");
	const url = await link.inputValue();
	expect(url).toContain("#s=v2:");
	const hash = url.slice(url.indexOf("#s="));

	// Force a full document load (an only-hash navigation would not reboot).
	await page.goto(`/?share=1${hash}`);
	await expect(page.getByTestId("share-stamp")).toBeVisible();
	await expect(page.getByTestId("stage")).toHaveAttribute("data-cables", "1");
	await expect(page.getByTestId("stage")).toHaveAttribute(
		"data-cable-arrows",
		"1",
	);
	// Read-only: ticking/chrome affordances are absent.
	await expect(page.getByTestId("endpoint-open")).toHaveCount(0);
	await expect(page.getByTestId("graph-action-bar")).toHaveCount(0);
});

test("an over-graph shared scene loads read-only and warns, never rejects", async ({
	page,
}) => {
	const endpoints = Array.from({ length: 301 }, (_, index) => ({
		uid: `endpoint-${index}`,
		kind: "amp" as const,
		x: index * 2,
		y: 0,
	}));
	const hash = shareHash({
		name: "Over graph",
		boards: [],
		items: [],
		endpoints,
		cables: [],
	});
	await page.goto(`/?share=1${hash}`);
	await expect(page.getByTestId("share-error")).toHaveCount(0);
	await expect(page.getByTestId("share-stamp")).toBeVisible();
	await expect(page.getByTestId("share-capacity")).toContainText(
		"Over capacity",
	);
	await expect(page.getByTestId("stage")).toHaveAttribute(
		"data-endpoints",
		"301",
	);
});

test("a legacy v1 share link still opens with an empty graph", async ({
	page,
}) => {
	const hash = shareHash({
		name: "Legacy",
		boards: [],
		items: [
			{
				uid: "i-1",
				refId: "boss-bd-2-blues-driver",
				kind: "pedal",
				boardUid: null,
				x: 20,
				y: 20,
				rotationDeg: 0,
				z: 0,
			},
		],
		version: 1,
	});
	await page.goto(`/?share=1${hash}`);
	await expect(page.getByTestId("share-error")).toHaveCount(0);
	await expect(page.getByTestId("share-stamp")).toBeVisible();
	await expect(page.getByTestId("stage")).toHaveAttribute("data-items", "1");
	await expect(page.getByTestId("stage")).toHaveAttribute("data-cables", "0");
});
