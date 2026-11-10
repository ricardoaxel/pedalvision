import { expect, type Page, test } from "@playwright/test";
import { waitForSavedScene } from "./persistence.ts";
import { firstItemScreenCentre } from "./stage.ts";

const PEDAL = { widthCm: 8, heightCm: 12 };
const BOARD = { widthCm: 60, heightCm: 40 };

const customPedals = [
	{
		refId: "f16-pedal",
		brand: "Test",
		name: "Mark Unit",
		widthCm: PEDAL.widthCm,
		heightCm: PEDAL.heightCm,
		category: "pedal",
		effectTypes: [],
	},
];

function scene() {
	return {
		boards: [
			{
				uid: "b1",
				boardRefId: null,
				customSize: { widthCm: BOARD.widthCm, heightCm: BOARD.heightCm },
				texture: "matte",
				name: "Test board",
				x: 0,
				y: 0,
				rotationDeg: 0,
			},
		],
		items: [
			{
				uid: "i1",
				refId: "f16-pedal",
				kind: "pedal",
				boardUid: "b1",
				x: 10,
				y: 10,
				rotationDeg: 0,
				z: 0,
			},
		],
		customPedals,
		endpoints: [],
		cables: [],
	};
}

function catalogScene() {
	return {
		boards: [
			{
				uid: "b1",
				boardRefId: "boss-bcb-1000",
				x: 0,
				y: 0,
				rotationDeg: 0,
			},
		],
		items: [
			{
				uid: "i1",
				refId: "f16-pedal",
				kind: "pedal",
				boardUid: "b1",
				x: 5,
				y: 5,
				rotationDeg: 0,
				z: 0,
			},
		],
		customPedals,
		endpoints: [],
		cables: [],
	};
}

type Fixture = ReturnType<typeof scene> | ReturnType<typeof catalogScene>;

async function seedScene(
	page: Page,
	fixture: Fixture = scene(),
): Promise<void> {
	await page.goto("/");
	await expect(page.getByTestId("stage")).toBeVisible();
	await page.evaluate(async (fixture) => {
		const id = "f16-scene";
		const updatedAt = new Date().toISOString();
		await new Promise<void>((resolve, reject) => {
			const request = indexedDB.open("pedalvision", 1);
			request.onerror = () => reject(request.error);
			request.onsuccess = () => {
				const db = request.result;
				const tx = db.transaction("scenes", "readwrite");
				const store = tx.objectStore("scenes");
				store.clear();
				store.put({ id, version: 1, name: "F-16", ...fixture, updatedAt });
				tx.oncomplete = () => resolve();
				tx.onerror = () => reject(tx.error);
			};
		});
		localStorage.setItem(
			"pedalvision.scenes.v1",
			JSON.stringify({ version: 1, scenes: [{ id, name: "F-16", updatedAt }] }),
		);
		localStorage.setItem(
			"pedalvision.settings.v1",
			JSON.stringify({
				version: 1,
				units: "cm",
				activeSceneId: id,
				showCables: true,
			}),
		);
	}, fixture);
	await page.reload();
	await expect(page.getByTestId("stage")).toHaveAttribute("data-items", "1");
}

async function stagePoint(page: Page, xCm: number, yCm: number) {
	const stage = page.getByTestId("stage");
	const box = await stage.boundingBox();
	if (!box) throw new Error("stage has no bounding box");
	const scale = Number(await stage.getAttribute("data-scale")) || 1;
	const vx = Number(await stage.getAttribute("data-x")) || 0;
	const vy = Number(await stage.getAttribute("data-y")) || 0;
	return {
		x: box.x + xCm * 4 * scale + vx,
		y: box.y + yCm * 4 * scale + vy,
	};
}

async function selectItem(page: Page): Promise<void> {
	const point = await firstItemScreenCentre(page, PEDAL);
	await page.mouse.click(point.x, point.y);
	await expect(page.getByTestId("item-action-bar")).toBeVisible();
}

async function selectBoard(page: Page): Promise<void> {
	// Read the actual first board's origin + footprint (custom or catalog), then
	// click its centre, which is empty of the seeded pedal.
	const stage = page.getByTestId("stage");
	const [origin] = ((await stage.getAttribute("data-positions")) ?? "").split(
		";",
	);
	const [bx, by] = (origin ?? "").split(",").map(Number);
	const [size] = ((await stage.getAttribute("data-board-sizes")) ?? "").split(
		",",
	);
	const [width, height] = (size ?? "").split("x").map(Number);
	const point = await stagePoint(
		page,
		(bx ?? 0) + (width ?? 0) / 2,
		(by ?? 0) + (height ?? 0) / 2,
	);
	await page.mouse.click(point.x, point.y);
	await expect(page.getByTestId("board-action-bar")).toBeVisible();
}

test("sets, undoes, persists and clears an item organization color", async ({
	page,
}) => {
	await seedScene(page);
	const stage = page.getByTestId("stage");
	const undoBefore = Number(await stage.getAttribute("data-undo-depth"));
	await selectItem(page);

	const trigger = page.getByTestId("item-color-trigger");
	await expect(trigger).toBeVisible();
	await expect(trigger).toHaveAttribute(
		"aria-label",
		"Organization color: Default",
	);
	await trigger.click();
	await expect(page.getByTestId("item-color-popover")).toBeVisible();
	await page.getByTestId("item-color-red").click();
	await expect(stage).toHaveAttribute("data-item-colors", "i1:#b5544d");
	await expect(trigger).toHaveAttribute(
		"aria-label",
		"Organization color: Red",
	);
	// One pick = one committed history step.
	await expect(stage).toHaveAttribute(
		"data-undo-depth",
		String(undoBefore + 1),
	);
	await page.keyboard.press("Escape");
	await expect(page.getByTestId("item-color-popover")).toHaveCount(0);
	await waitForSavedScene(
		page,
		(document) => document.items?.[0]?.color === "#b5544d",
	);

	// Undo/redo restore the marker through the persisted snapshot.
	await page.keyboard.press("Control+z");
	await expect(stage).toHaveAttribute("data-item-colors", "i1:default");
	await page.keyboard.press("Control+Shift+z");
	await expect(stage).toHaveAttribute("data-item-colors", "i1:#b5544d");

	// Reload restores it; Default clears the optional field.
	await page.reload();
	await expect(stage).toHaveAttribute("data-item-colors", "i1:#b5544d");
	await selectItem(page);
	await page.getByTestId("item-color-trigger").click();
	await page.getByTestId("item-color-default").click();
	await expect(stage).toHaveAttribute("data-item-colors", "i1:default");
	await waitForSavedScene(
		page,
		(document) => document.items?.[0]?.color === undefined,
	);
});

test("colors a catalog/custom board without changing its finish", async ({
	page,
}) => {
	await seedScene(page);
	const stage = page.getByTestId("stage");
	await selectBoard(page);

	const trigger = page.getByTestId("board-color-trigger");
	await expect(trigger).toBeVisible();
	await trigger.click();
	await expect(page.getByTestId("board-color-popover")).toBeVisible();
	await page.getByTestId("board-color-green").click();
	await expect(stage).toHaveAttribute("data-board-colors", "b1:#568a66");
	await expect(trigger).toHaveAttribute("aria-label", "Board color: Green");
	// The procedural finish is independent of the organization color.
	await expect(stage).toHaveAttribute("data-board-textures", "matte");
	await page.keyboard.press("Escape");
	await waitForSavedScene(
		page,
		(document) => document.boards?.[0]?.color === "#568a66",
	);

	await page.reload();
	await expect(stage).toHaveAttribute("data-board-colors", "b1:#568a66");
	await expect(stage).toHaveAttribute("data-board-textures", "matte");
});

test("colors a catalog board and shows Color only", async ({ page }) => {
	await seedScene(page, catalogScene());
	const stage = page.getByTestId("stage");
	await selectBoard(page);
	await expect(page.getByTestId("board-color-trigger")).toBeVisible();
	// Catalog-board removal stays in the Picker; Edit/Delete are custom-only.
	await expect(page.getByTestId("edit-custom-board")).toHaveCount(0);
	await expect(page.getByTestId("delete-custom-board")).toHaveCount(0);

	await page.getByTestId("board-color-trigger").click();
	await page.getByTestId("board-color-green").click();
	await expect(stage).toHaveAttribute("data-board-colors", "b1:#568a66");
	await page.keyboard.press("Escape");
	await waitForSavedScene(
		page,
		(document) => document.boards?.[0]?.color === "#568a66",
	);
	await page.reload();
	await expect(stage).toHaveAttribute("data-board-colors", "b1:#568a66");
});

test("a custom hex is one undo step and persists", async ({ page }) => {
	await seedScene(page);
	const stage = page.getByTestId("stage");
	await selectItem(page);
	await page.getByTestId("item-color-trigger").click();
	const undoBefore = Number(await stage.getAttribute("data-undo-depth"));
	await page.getByTestId("item-color-custom-input").evaluate((element) => {
		const input = element as HTMLInputElement;
		input.value = "#a85a90";
		input.dispatchEvent(new Event("change", { bubbles: true }));
	});
	await expect(stage).toHaveAttribute("data-item-colors", "i1:#a85a90");
	await expect(stage).toHaveAttribute(
		"data-undo-depth",
		String(undoBefore + 1),
	);
	await page.keyboard.press("Escape");
	await waitForSavedScene(
		page,
		(document) => document.items?.[0]?.color === "#a85a90",
	);
});

test("a live custom pick applies and survives an outside click as one undo step", async ({
	page,
}) => {
	await seedScene(page);
	const stage = page.getByTestId("stage");
	await selectItem(page);
	await page.getByTestId("item-color-trigger").click();
	const undoBefore = Number(await stage.getAttribute("data-undo-depth"));
	// The native picker streams `input`; the canvas must update live.
	await page.getByTestId("item-color-custom-input").evaluate((element) => {
		const input = element as HTMLInputElement;
		input.value = "#a85a90";
		input.dispatchEvent(new Event("input", { bubbles: true }));
	});
	await expect(stage).toHaveAttribute("data-item-colors", "i1:#a85a90");

	// The obvious dismiss (outside click) keeps the pick, closes the panel and
	// records the whole streamed pick as one undo step.
	await page.mouse.click(20, 20);
	await expect(page.getByTestId("item-color-popover")).toHaveCount(0);
	await expect(stage).toHaveAttribute("data-item-colors", "i1:#a85a90");
	await expect(stage).toHaveAttribute(
		"data-undo-depth",
		String(undoBefore + 1),
	);
	await page.keyboard.press("Control+z");
	await expect(stage).toHaveAttribute("data-item-colors", "i1:default");
	await waitForSavedScene(
		page,
		(document) => document.items?.[0]?.color === undefined,
	);
});

test("dismissing the color panel on a Default item leaves it Default", async ({
	page,
}) => {
	await seedScene(page);
	const stage = page.getByTestId("stage");
	await selectItem(page);
	const undoBefore = Number(await stage.getAttribute("data-undo-depth"));

	// Escape without ever opening the native picker must not apply the
	// placeholder black.
	await page.getByTestId("item-color-trigger").click();
	await expect(page.getByTestId("item-color-popover")).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(page.getByTestId("item-color-popover")).toHaveCount(0);
	await expect(stage).toHaveAttribute("data-item-colors", "i1:default");
	await expect(stage).toHaveAttribute("data-undo-depth", String(undoBefore));

	// The obvious outside click behaves the same.
	await page.getByTestId("item-color-trigger").click();
	await page.mouse.click(20, 20);
	await expect(page.getByTestId("item-color-popover")).toHaveCount(0);
	await expect(stage).toHaveAttribute("data-item-colors", "i1:default");
	await expect(stage).toHaveAttribute("data-undo-depth", String(undoBefore));

	// Explicit Default on an already-default item is a no-op too.
	await selectItem(page);
	await page.getByTestId("item-color-trigger").click();
	await page.getByTestId("item-color-default").click();
	await page.keyboard.press("Escape");
	await expect(stage).toHaveAttribute("data-item-colors", "i1:default");
	await expect(stage).toHaveAttribute("data-undo-depth", String(undoBefore));
});

test("clearing a color then dismissing does not write black", async ({
	page,
}) => {
	await seedScene(page);
	const stage = page.getByTestId("stage");
	await selectItem(page);
	await page.getByTestId("item-color-trigger").click();
	await page.getByTestId("item-color-red").click();
	await page.keyboard.press("Escape");
	await expect(stage).toHaveAttribute("data-item-colors", "i1:#b5544d");
	const redDepth = Number(await stage.getAttribute("data-undo-depth"));

	// Colored → Default → Escape: one step (the clear), never a black write.
	await page.getByTestId("item-color-trigger").click();
	await page.getByTestId("item-color-default").click();
	await page.keyboard.press("Escape");
	await expect(stage).toHaveAttribute("data-item-colors", "i1:default");
	await expect(stage).toHaveAttribute("data-undo-depth", String(redDepth + 1));

	// Same via outside click after another fixed ink. The popover stays open
	// after a fixed ink, so Default can be clicked directly.
	await page.getByTestId("item-color-trigger").click();
	await page.getByTestId("item-color-blue").click();
	const blueDepth = Number(await stage.getAttribute("data-undo-depth"));
	await page.getByTestId("item-color-default").click();
	await page.mouse.click(20, 20);
	await expect(stage).toHaveAttribute("data-item-colors", "i1:default");
	await expect(stage).toHaveAttribute("data-undo-depth", String(blueDepth + 1));
});

test("streaming after an undo mid-pick still coalesces into one step", async ({
	page,
}) => {
	await seedScene(page);
	const stage = page.getByTestId("stage");
	await selectItem(page);
	await page.getByTestId("item-color-trigger").click();
	const input = page.getByTestId("item-color-custom-input");
	const stream = async (color: string) => {
		await input.evaluate((element, value) => {
			const native = element as HTMLInputElement;
			native.value = value;
			native.dispatchEvent(new Event("input", { bubbles: true }));
		}, color);
	};

	await stream("#b5544d");
	await expect(stage).toHaveAttribute("data-item-colors", "i1:#b5544d");
	await expect(stage).toHaveAttribute("data-undo-depth", "0");
	// Undo mid-pick drains the hold; the next stream must start a fresh one.
	await page.keyboard.press("Control+z");
	await expect(stage).toHaveAttribute("data-item-colors", "i1:default");
	await stream("#a96a38");
	await stream("#568a66");
	await stream("#8a74bd");
	await expect(stage).toHaveAttribute("data-undo-depth", "0");
	await page.mouse.click(20, 20);
	await expect(stage).toHaveAttribute("data-item-colors", "i1:#8a74bd");
	await expect(stage).toHaveAttribute("data-undo-depth", "1");
});

test("a colored scene round-trips through a read-only share link", async ({
	page,
}) => {
	await seedScene(page);
	const stage = page.getByTestId("stage");

	// Color the part, then the board.
	await selectItem(page);
	await page.getByTestId("item-color-trigger").click();
	await page.getByTestId("item-color-violet").click();
	await page.keyboard.press("Escape");
	await expect(stage).toHaveAttribute("data-item-colors", "i1:#8a74bd");

	await selectBoard(page);
	await page.getByTestId("board-color-trigger").click();
	await page.getByTestId("board-color-blue").click();
	await page.keyboard.press("Escape");
	await expect(stage).toHaveAttribute("data-board-colors", "b1:#587db8");
	await waitForSavedScene(
		page,
		(document) =>
			document.items?.[0]?.color === "#8a74bd" &&
			document.boards?.[0]?.color === "#587db8",
	);

	await page.getByTestId("share-open").click();
	const url = await page.getByTestId("share-link").inputValue();
	expect(url).toContain("#s=v5:");
	const hash = url.slice(url.indexOf("#s="));

	await page.goto(`/?share=1${hash}`);
	await expect(page.getByTestId("share-stamp")).toBeVisible();
	await expect(page.getByTestId("stage")).toHaveAttribute(
		"data-item-colors",
		"i1:#8a74bd",
	);
	await expect(page.getByTestId("stage")).toHaveAttribute(
		"data-board-colors",
		"b1:#587db8",
	);
	// Read-only: selecting shows no action bar / color control and mutates nothing.
	const point = await firstItemScreenCentre(page, PEDAL);
	await page.mouse.click(point.x, point.y);
	await expect(page.getByTestId("item-action-bar")).toHaveCount(0);
	await expect(page.getByTestId("item-color-trigger")).toHaveCount(0);
	await expect(page.getByTestId("board-color-trigger")).toHaveCount(0);
	await expect(page.getByTestId("stage")).toHaveAttribute(
		"data-item-colors",
		"i1:#8a74bd",
	);
});
