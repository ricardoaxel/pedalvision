import { expect, type Page, test } from "@playwright/test";
import { waitForSavedScene } from "./persistence.ts";

const customPedals = [
	{
		refId: "q05-pedal",
		brand: "Test",
		name: "Patch Unit",
		widthCm: 8,
		heightCm: 12,
		category: "pedal",
		effectTypes: [],
		jacks: [
			{ kind: "in", edge: "left", pos: 0.5 },
			{ kind: "out", edge: "right", pos: 0.5 },
		],
	},
];

function scene() {
	return {
		boards: [],
		items: [
			{
				uid: "i1",
				refId: "q05-pedal",
				kind: "pedal",
				boardUid: null,
				x: 10,
				y: 20,
				rotationDeg: 0,
				z: 0,
			},
			{
				uid: "i2",
				refId: "q05-pedal",
				kind: "pedal",
				boardUid: null,
				x: 35,
				y: 20,
				rotationDeg: 0,
				z: 1,
			},
		],
		customPedals,
		endpoints: [],
		cables: [
			{
				uid: "c1",
				from: { itemUid: "i1", jack: "1" },
				to: { itemUid: "i2", jack: "0" },
			},
		],
	};
}

async function seedScene(page: Page): Promise<void> {
	await page.goto("/");
	await expect(page.getByTestId("stage")).toBeVisible();
	await page.evaluate(async (fixture) => {
		const id = "q05-scene";
		const updatedAt = new Date().toISOString();
		await new Promise<void>((resolve, reject) => {
			const request = indexedDB.open("pedalvision", 1);
			request.onerror = () => reject(request.error);
			request.onsuccess = () => {
				const db = request.result;
				const tx = db.transaction("scenes", "readwrite");
				const store = tx.objectStore("scenes");
				store.clear();
				store.put({ id, version: 1, name: "Q-05", ...fixture, updatedAt });
				tx.oncomplete = () => resolve();
				tx.onerror = () => reject(tx.error);
			};
		});
		localStorage.setItem(
			"pedalvision.scenes.v1",
			JSON.stringify({ version: 1, scenes: [{ id, name: "Q-05", updatedAt }] }),
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
	}, scene());
	await page.reload();
	await expect(page.getByTestId("stage")).toHaveAttribute("data-cables", "1");
}

async function cableMidpoint(page: Page): Promise<{ x: number; y: number }> {
	const stage = page.getByTestId("stage");
	const box = await stage.boundingBox();
	if (!box) throw new Error("stage has no bounding box");
	const scale = Number(await stage.getAttribute("data-scale")) || 1;
	const vx = Number(await stage.getAttribute("data-x")) || 0;
	const vy = Number(await stage.getAttribute("data-y")) || 0;
	const anchors = (await stage.getAttribute("data-jack-anchors")) ?? "";
	const read = (key: string) => {
		const entry = anchors
			.split(";")
			.find((candidate) => candidate.startsWith(`${key}@`));
		if (!entry) throw new Error(`anchor ${key} not found`);
		const [x, y] = entry
			.slice(key.length + 1)
			.split(",")
			.map(Number);
		return { x: x ?? 0, y: y ?? 0 };
	};
	const a = read("item:i1:1");
	const b = read("item:i2:0");
	return {
		x: box.x + ((a.x + b.x) / 2) * 4 * scale + vx,
		y: box.y + ((a.y + b.y) / 2) * 4 * scale + vy,
	};
}

async function selectCable(page: Page): Promise<{ x: number; y: number }> {
	// The graph reveal fades the cable group in; wait it out so it is hittable.
	await page.waitForTimeout(800);
	const point = await cableMidpoint(page);
	await page.mouse.click(point.x, point.y);
	await expect(page.getByTestId("graph-action-bar")).toBeVisible();
	return point;
}

/** Open the compact mobile ink popover; desktop already renders it inline. */
async function openInk(page: Page): Promise<void> {
	const trigger = page.getByTestId("cable-ink-trigger");
	if (!(await trigger.isVisible())) return;
	const popover = page.getByTestId("cable-ink-popover");
	if (!(await popover.isVisible())) await trigger.click();
	await expect(popover).toBeVisible();
}

/** Close the mobile popover so the canvas is not covered for pixel checks. */
async function closeInk(page: Page): Promise<void> {
	const popover = page.getByTestId("cable-ink-popover");
	if (await popover.isVisible().catch(() => false)) {
		await page.keyboard.press("Escape");
		await expect(popover).toHaveCount(0);
	}
}

/** Sample one CSS pixel from a full-page screenshot (live canvas ink proof). */
async function screenshotPixel(
	page: Page,
	point: { x: number; y: number },
): Promise<number[]> {
	const buffer = await page.screenshot({ scale: "css" });
	const base64 = buffer.toString("base64");
	return page.evaluate(
		async ({ data, x, y }) => {
			const image = new Image();
			image.src = `data:image/png;base64,${data}`;
			await image.decode();
			const canvas = document.createElement("canvas");
			canvas.width = image.naturalWidth;
			canvas.height = image.naturalHeight;
			const context = canvas.getContext("2d");
			if (!context) throw new Error("no 2d context");
			context.drawImage(image, 0, 0);
			return Array.from(context.getImageData(x, y, 1, 1).data);
		},
		{ data: base64, x: Math.round(point.x), y: Math.round(point.y) },
	);
}

test("picks a patch ink, persists, undoes and shares it", async ({ page }) => {
	await seedScene(page);
	const stage = page.getByTestId("stage");
	const cablePoint = await selectCable(page);
	await openInk(page);

	// A new cable starts on the theme default.
	await expect(page.getByRole("radio", { name: "Default ink" })).toBeChecked();
	await expect(stage).toHaveAttribute("data-cable-colors", "c1:default");

	const undoBefore = Number(await stage.getAttribute("data-undo-depth"));
	await page.getByTestId("cable-ink-red").click();
	await expect(stage).toHaveAttribute("data-cable-colors", "c1:#b5544d");
	await expect(page.getByRole("radio", { name: "Red" })).toBeChecked();
	await closeInk(page);
	// The live canvas actually paints the stored ink (not just the debug attr).
	const [red, green, blue] = await screenshotPixel(page, cablePoint);
	expect(red).toBeGreaterThan((green ?? 0) + 40);
	expect(red).toBeGreaterThan((blue ?? 0) + 40);
	// One pick = one committed history step.
	await expect(stage).toHaveAttribute(
		"data-undo-depth",
		String(undoBefore + 1),
	);
	await waitForSavedScene(
		page,
		(document) => document.cables?.[0]?.color === "#b5544d",
	);

	// Undo/redo restore the ink through the persisted snapshot.
	await page.keyboard.press("Control+z");
	await expect(stage).toHaveAttribute("data-cable-colors", "c1:default");
	await page.keyboard.press("Control+Shift+z");
	await expect(stage).toHaveAttribute("data-cable-colors", "c1:#b5544d");

	// Reload restores the persisted ink, then Default clears the field.
	await page.reload();
	await expect(stage).toHaveAttribute("data-cable-colors", "c1:#b5544d");
	await selectCable(page);
	await openInk(page);
	await page.getByTestId("cable-ink-default").click();
	await expect(stage).toHaveAttribute("data-cable-colors", "c1:default");
	await waitForSavedScene(
		page,
		(document) => document.cables?.[0]?.color === undefined,
	);

	// Set it again and prove the v3 share round-trip + read-only rendering.
	await openInk(page);
	await page.getByTestId("cable-ink-blue").click();
	await expect(stage).toHaveAttribute("data-cable-colors", "c1:#587db8");
	await waitForSavedScene(
		page,
		(document) => document.cables?.[0]?.color === "#587db8",
	);
	await page.getByTestId("share-open").click();
	const url = await page.getByTestId("share-link").inputValue();
	expect(url).toContain("#s=v4:");
	const hash = url.slice(url.indexOf("#s="));

	await page.goto(`/?share=1${hash}`);
	await expect(page.getByTestId("share-stamp")).toBeVisible();
	await expect(page.getByTestId("stage")).toHaveAttribute(
		"data-cable-colors",
		"c1:#587db8",
	);
	// Read-only: no action bar, no palette, no mutation affordance.
	await expect(page.getByTestId("graph-action-bar")).toHaveCount(0);
	await expect(page.getByTestId("cable-ink-palette")).toHaveCount(0);
});

test("Delete still works while a swatch owns focus", async ({ page }) => {
	await seedScene(page);
	const stage = page.getByTestId("stage");
	await selectCable(page);
	await openInk(page);
	await page.getByTestId("cable-ink-red").click();
	await expect(page.getByRole("radio", { name: "Red" })).toBeChecked();
	// The hidden radio is the focus target; Delete must not be swallowed by it.
	await page.keyboard.press("Delete");
	await expect(stage).toHaveAttribute("data-cables", "0");
	await expect(page.getByTestId("graph-action-bar")).toHaveCount(0);
});

test("custom ink round-trips and warns only when it is hard to see", async ({
	page,
}) => {
	await seedScene(page);
	const stage = page.getByTestId("stage");
	await selectCable(page);
	await openInk(page);

	const input = page.getByTestId("cable-ink-custom-input");
	const setColor = (value: string) =>
		input.evaluate((element, next) => {
			const control = element as HTMLInputElement;
			// Use the prototype setter so React's value tracker sees the change.
			const setter = Object.getOwnPropertyDescriptor(
				HTMLInputElement.prototype,
				"value",
			)?.set;
			setter?.call(control, next);
			control.dispatchEvent(new Event("input", { bubbles: true }));
			control.dispatchEvent(new Event("change", { bubbles: true }));
		}, value);

	const undoBefore = Number(await stage.getAttribute("data-undo-depth"));
	await setColor("#6b6b6b");
	await expect(stage).toHaveAttribute("data-cable-colors", "c1:#6b6b6b");
	await expect(page.getByRole("radio", { name: "Custom ink" })).toBeChecked();
	// One native change = one committed undo step.
	await expect(stage).toHaveAttribute(
		"data-undo-depth",
		String(undoBefore + 1),
	);
	await expect(page.getByTestId("cable-ink-warning")).toHaveCount(0);
	await waitForSavedScene(
		page,
		(document) => document.cables?.[0]?.color === "#6b6b6b",
	);

	// A very light custom ink is visible on the dark canvas but not on paper.
	// Re-open the picker from the already-checked Custom slot (a native radio
	// change would not fire). Spy on the hidden input to avoid the OS dialog.
	await page.evaluate(() => {
		const input = document.querySelector(
			'[data-testid="cable-ink-custom-input"]',
		) as HTMLInputElement;
		(window as { __customClicked?: boolean }).__customClicked = false;
		input.click = () => {
			(window as { __customClicked?: boolean }).__customClicked = true;
		};
	});
	await page.getByTestId("cable-ink-custom").click();
	expect(
		await page.evaluate(
			() => (window as { __customClicked?: boolean }).__customClicked,
		),
	).toBe(true);

	await setColor("#ffffff");
	await expect(stage).toHaveAttribute("data-cable-colors", "c1:#ffffff");
	await expect(stage).toHaveAttribute(
		"data-undo-depth",
		String(undoBefore + 2),
	);
	await expect(page.getByTestId("cable-ink-warning").first()).toHaveAttribute(
		"title",
		/Faint on/,
	);

	await page.getByTestId("share-open").click();
	const url = await page.getByTestId("share-link").inputValue();
	expect(url).toContain("#s=v4:");
	const hash = url.slice(url.indexOf("#s="));
	await page.goto(`/?share=1${hash}`);
	await expect(page.getByTestId("stage")).toHaveAttribute(
		"data-cable-colors",
		"c1:#ffffff",
	);
	await expect(page.getByTestId("cable-ink-trigger")).toHaveCount(0);
	await expect(page.getByTestId("cable-ink-palette")).toHaveCount(0);
});

test("mobile ink popover dismisses on Escape and outside tap", async ({
	page,
}) => {
	test.skip(
		(page.viewportSize()?.width ?? 1280) > 640,
		"desktop uses the inline palette",
	);
	await seedScene(page);
	const stage = page.getByTestId("stage");
	await selectCable(page);
	const trigger = page.getByTestId("cable-ink-trigger");
	const popover = page.getByTestId("cable-ink-popover");

	await trigger.click();
	await expect(popover).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(popover).toHaveCount(0);
	await expect(trigger).toBeFocused();

	await trigger.click();
	await expect(popover).toBeVisible();
	const box = await stage.boundingBox();
	if (!box) throw new Error("stage has no bounding box");
	await page.mouse.click(box.x + 20, box.y + box.height - 120);
	await expect(popover).toHaveCount(0);
});
