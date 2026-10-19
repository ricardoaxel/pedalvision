import { readFile } from "node:fs/promises";
import { expect, type Page, test } from "@playwright/test";
import { openPicker } from "./picker.ts";

const SCENE_KEY = "pedalvision.scene.v1";
const DARK_BACKGROUND = "#191a1c";

interface SceneFixture {
	boards: Array<Record<string, unknown>>;
	items: Array<Record<string, unknown>>;
	customPedals: Array<Record<string, unknown>>;
}

function customPedal(
	refId: string,
	name: string,
	widthCm: number,
	heightCm: number,
) {
	return {
		refId,
		brand: "Test",
		name,
		widthCm,
		heightCm,
		category: "pedal",
		effectTypes: [],
	};
}

function board(uid: string, x: number): Record<string, unknown> {
	return {
		uid,
		boardRefId: null,
		customSize: { widthCm: 60, heightCm: 30 },
		texture: "wood",
		name: `Rig ${uid}`,
		x,
		y: 0,
		rotationDeg: 0,
	};
}

function sceneTwoBoards(): SceneFixture {
	return {
		boards: [board("board-1", 0), board("board-2", 80)],
		items: [
			{
				uid: "part-1",
				refId: "custom-pedal-1",
				kind: "pedal",
				boardUid: "board-1",
				x: 10,
				y: 8,
				rotationDeg: 0,
				z: 0,
			},
		],
		customPedals: [customPedal("custom-pedal-1", "Fuzz Unit", 10, 6)],
	};
}

function sceneCatalog(): SceneFixture {
	return {
		boards: [
			{
				uid: "board-1",
				boardRefId: "boss-bcb-1000",
				x: 20,
				y: 20,
				rotationDeg: 0,
			},
		],
		items: [
			{
				uid: "pedal-1",
				refId: "boss-ce-3-chorus",
				kind: "pedal",
				boardUid: "board-1",
				x: 5,
				y: 5,
				rotationDeg: 0,
				z: 0,
			},
		],
		customPedals: [],
	};
}

async function seedScene(page: Page, scene: SceneFixture): Promise<void> {
	await page.addInitScript(
		({ key, value }) => {
			localStorage.setItem(key, JSON.stringify(value));
		},
		{ key: SCENE_KEY, value: { version: 1, ...scene } },
	);
	await page.goto("/");
	await expect(page.getByTestId("stage")).toHaveAttribute(
		"data-boards",
		String(scene.boards.length),
	);
	await expect(page.getByTestId("stage")).toHaveAttribute(
		"data-items",
		String(scene.items.length),
	);
}

async function selectFirstBoard(page: Page): Promise<void> {
	const box = await page.getByTestId("stage").boundingBox();
	if (!box) throw new Error("stage has no bounding box");
	// Board-1 is a 60 × 30 cm custom board seeded at world (0, 0) → its centre
	// is 120 × 60 stage px (PX_PER_CM = 4, default viewport at 1×/0,0).
	await page.mouse.click(box.x + 120, box.y + 60);
	await expect(page.getByTestId("stage")).not.toHaveAttribute(
		"data-selected-board",
		"",
	);
}

async function openExport(page: Page): Promise<void> {
	await page.getByTestId("export-open").click();
	await expect(page.getByTestId("export-panel")).toBeVisible();
}

interface PngStats {
	width: number;
	height: number;
	decodedWidth: number;
	decodedHeight: number;
	transparent: number;
	offBackground: number;
	sampled: number;
}

function pngHeaderSize(buffer: Buffer): { width: number; height: number } {
	expect(buffer.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
	return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

async function inspectPng(page: Page, buffer: Buffer): Promise<PngStats> {
	const header = pngHeaderSize(buffer);
	const base64 = buffer.toString("base64");
	const stats = await page.evaluate(
		async ({ data, background }) => {
			const image = new Image();
			image.src = `data:image/png;base64,${data}`;
			await image.decode();
			const canvas = document.createElement("canvas");
			canvas.width = image.naturalWidth;
			canvas.height = image.naturalHeight;
			const context = canvas.getContext("2d");
			if (!context) throw new Error("no 2d context");
			context.drawImage(image, 0, 0);
			const pixels = context.getImageData(
				0,
				0,
				canvas.width,
				canvas.height,
			).data;
			const bg = [
				Number.parseInt(background.slice(1, 3), 16),
				Number.parseInt(background.slice(3, 5), 16),
				Number.parseInt(background.slice(5, 7), 16),
			];
			let transparent = 0;
			let offBackground = 0;
			let sampled = 0;
			for (let y = 0; y < canvas.height; y += 8) {
				for (let x = 0; x < canvas.width; x += 8) {
					const index = (y * canvas.width + x) * 4;
					sampled += 1;
					if (pixels[index + 3] !== 255) transparent += 1;
					const delta =
						Math.abs((pixels[index] ?? 0) - (bg[0] ?? 0)) +
						Math.abs((pixels[index + 1] ?? 0) - (bg[1] ?? 0)) +
						Math.abs((pixels[index + 2] ?? 0) - (bg[2] ?? 0));
					if (delta > 12) offBackground += 1;
				}
			}
			return {
				decodedWidth: image.naturalWidth,
				decodedHeight: image.naturalHeight,
				transparent,
				offBackground,
				sampled,
			};
		},
		{ data: base64, background: DARK_BACKGROUND },
	);
	return { ...header, ...stats };
}

async function samplePixels(
	page: Page,
	buffer: Buffer,
	points: Array<{ x: number; y: number }>,
): Promise<number[][]> {
	const base64 = buffer.toString("base64");
	return page.evaluate(
		async ({ data, samples }) => {
			const image = new Image();
			image.src = `data:image/png;base64,${data}`;
			await image.decode();
			const canvas = document.createElement("canvas");
			canvas.width = image.naturalWidth;
			canvas.height = image.naturalHeight;
			const context = canvas.getContext("2d");
			if (!context) throw new Error("no 2d context");
			context.drawImage(image, 0, 0);
			return samples.map((point) =>
				Array.from(context.getImageData(point.x, point.y, 1, 1).data),
			);
		},
		{ data: base64, samples: points },
	);
}

async function downloadPng(page: Page): Promise<Buffer> {
	const [download] = await Promise.all([
		page.waitForEvent("download"),
		page.getByTestId("export-download").click(),
	]);
	const path = await download.path();
	if (!path) throw new Error("download has no path");
	return readFile(path);
}

test("exports the selected board as an opaque, non-blank PNG", async ({
	page,
}) => {
	await seedScene(page, sceneTwoBoards());
	await selectFirstBoard(page);
	await openExport(page);

	await page.getByRole("radio", { name: "Selected board" }).click();
	await expect(page.getByTestId("export-size")).toHaveText("2,176 × 1,216 px");

	const buffer = await downloadPng(page);
	const stats = await inspectPng(page, buffer);
	expect(stats.width).toBe(2176);
	expect(stats.height).toBe(1216);
	expect(stats.decodedWidth).toBe(2176);
	expect(stats.decodedHeight).toBe(1216);
	expect(stats.transparent).toBe(0);
	expect(stats.offBackground / stats.sampled).toBeGreaterThan(0.05);

	// The pedal itself is in the PNG, not just the board: its custom body differs
	// from the wood board fill. Selected-board frame = 68 × 38 cm at 32 px/cm.
	const [pedal, boardOnly] = await samplePixels(page, buffer, [
		{ x: 608, y: 480 },
		{ x: 1568, y: 928 },
	]);
	expect(pedal).not.toEqual(boardOnly);

	await expect(page.getByText("PNG saved")).toBeVisible();
	await expect(
		page.getByText(/^pedalvision-rig-board-1-\d{4}-\d{2}-\d{2}\.png$/),
	).toBeVisible();
});

test("all content includes the other board and stays within the pixel clamp", async ({
	page,
}) => {
	await seedScene(page, sceneTwoBoards());
	await selectFirstBoard(page);
	await openExport(page);
	await page.getByRole("radio", { name: "Selected board" }).click();
	await expect(page.getByTestId("export-size")).toHaveText("2,176 × 1,216 px");

	await page.getByRole("radio", { name: "All content" }).click();
	await expect(page.getByTestId("export-size")).toContainText("4,096 ×");

	const buffer = await downloadPng(page);
	const stats = await inspectPng(page, buffer);
	expect(stats.width).toBe(4096);
	expect(stats.height).toBeLessThan(4096);
	expect(stats.transparent).toBe(0);
	expect(stats.offBackground / stats.sampled).toBeGreaterThan(0.05);
});

test("export ignores the live zoom and pan (never the viewport)", async ({
	page,
}) => {
	await seedScene(page, sceneTwoBoards());
	await openExport(page);
	await page.getByRole("radio", { name: "All content" }).click();
	const sizeBefore = await page.getByTestId("export-size").textContent();
	await page.getByTestId("export-close").click();
	await expect(page.getByTestId("export-open")).toBeFocused();

	// Zoom to a high level, then pan the board far off-screen.
	const stage = page.getByTestId("stage");
	const box = await stage.boundingBox();
	if (!box) throw new Error("stage has no bounding box");
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	await page.mouse.wheel(0, -1200);
	await expect
		.poll(async () => Number(await stage.getAttribute("data-scale")))
		.toBeGreaterThan(1.5);
	await page.mouse.move(box.x + box.width - 30, box.y + box.height - 30);
	await page.mouse.down();
	await page.mouse.move(box.x + 30, box.y + 30, { steps: 12 });
	await page.mouse.up();

	await openExport(page);
	await page.getByRole("radio", { name: "All content" }).click();
	await expect(page.getByTestId("export-size")).toHaveText(sizeBefore ?? "");

	const buffer = await downloadPng(page);
	const stats = await inspectPng(page, buffer);
	expect(stats.width).toBe(4096);
	expect(stats.transparent).toBe(0);
	expect(stats.offBackground / stats.sampled).toBeGreaterThan(0.05);
});

test("empty and no-board-selection states are honest", async ({ page }) => {
	await page.goto("/");
	await openExport(page);
	await expect(page.getByText("Nothing to export yet.")).toBeVisible();
	await expect(page.getByTestId("export-download")).toHaveCount(0);
	await page.getByTestId("export-add-board").click();
	await expect(page.getByTestId("picker-panel")).toBeVisible();
	// The picker owns focus — it must not be stolen back by the toolbar trigger.
	await expect
		.poll(() =>
			page.evaluate(
				() =>
					document.activeElement?.closest('[data-testid="picker-panel"]') !==
					null,
			),
		)
		.toBe(true);

	await page.getByTestId("picker-close").click();
	await seedScene(page, sceneTwoBoards());
	await openExport(page);
	// No board selected yet: the selected-board scope is unavailable.
	const selectedBoard = page.getByRole("radio", { name: "Selected board" });
	await expect(selectedBoard).toBeDisabled();
	await expect(page.getByRole("radio", { name: "All content" })).toBeChecked();

	const box = await page.getByTestId("stage").boundingBox();
	if (!box) throw new Error("stage has no bounding box");
	await page.mouse.click(box.x + 120, box.y + 60);
	await expect(selectedBoard).toBeEnabled();
	await selectedBoard.click();
	await expect(selectedBoard).toBeChecked();
});

test("a failed included image fails clearly (no silent fallback)", async ({
	page,
}) => {
	await page.route("**/pedal-assets/**", (route) => route.abort());
	await seedScene(page, sceneCatalog());
	await openExport(page);
	await page.getByTestId("export-download").click();
	await expect(page.getByTestId("export-error")).toBeVisible();
	await expect(page.getByTestId("export-error")).toContainText(
		"couldn't be loaded",
	);
});

test("opening the picker mid-export releases the toolbar trigger", async ({
	page,
}) => {
	await page.route("**/pedal-assets/**", async (route) => {
		await new Promise((resolve) => setTimeout(resolve, 800));
		await route.continue();
	});
	await seedScene(page, sceneCatalog());
	await openExport(page);

	const download = page.waitForEvent("download");
	await page.getByTestId("export-download").click();
	// The export panel is unmounted while the bounded export is still running.
	await openPicker(page, "boards");
	await download;
	await page.getByTestId("picker-close").click();
	await expect(page.getByTestId("export-open")).toBeEnabled();
});

test("mobile: the export tray stays above the tab bar and exports", async ({
	page,
	isMobile,
}) => {
	test.skip(!isMobile, "mobile geometry check");
	await seedScene(page, sceneTwoBoards());
	await selectFirstBoard(page);
	await openExport(page);

	const panel = await page.getByTestId("export-panel").boundingBox();
	if (!panel) throw new Error("export panel has no bounding box");
	const viewport = page.viewportSize();
	if (!viewport) throw new Error("no viewport");
	// Above the 56px tab bar (+ safe area) and never a full-height sheet.
	expect(panel.y + panel.height).toBeLessThanOrEqual(
		viewport.height - 56 - 8 + 1,
	);
	expect(panel.height).toBeLessThan(viewport.height * 0.6);
	expect(panel.width).toBeGreaterThan(viewport.width - 40);

	await page.getByRole("radio", { name: "Selected board" }).click();
	const buffer = await downloadPng(page);
	const stats = await inspectPng(page, buffer);
	expect(stats.width).toBe(2176);
	expect(stats.transparent).toBe(0);
	expect(stats.offBackground / stats.sampled).toBeGreaterThan(0.05);
});
