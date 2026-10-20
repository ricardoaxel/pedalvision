import { readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { openPicker } from "./picker.ts";
import { firstItemScreenCentre } from "./stage.ts";

interface CatalogPedal {
	id: string;
	category: "pedal" | "supply";
	imageSource: string;
	widthCm: number;
	heightCm: number;
}

const CATALOG = JSON.parse(
	readFileSync("src/catalog/data/pedals.json", "utf8"),
) as CatalogPedal[];

/** Same-origin catalog pedals (89) — avoids hotlink network noise in e2e. */
const SAME_ORIGIN_PEDALS = CATALOG.filter(
	(pedal) => pedal.category === "pedal" && pedal.imageSource !== "url",
).slice(0, 89);
const PEDALS = SAME_ORIGIN_PEDALS.map((pedal) => pedal.id);

const FIRST_PEDAL = PEDALS[0];
const FIRST_PEDAL_CM = {
	widthCm: SAME_ORIGIN_PEDALS[0].widthCm,
	heightCm: SAME_ORIGIN_PEDALS[0].heightCm,
};

interface FixtureBoard {
	uid: string;
	boardRefId: null;
	customSize: { widthCm: number; heightCm: number };
	texture: "matte";
	name: string;
	x: number;
	y: number;
	rotationDeg: number;
}

interface FixtureItem {
	uid: string;
	refId: string;
	kind: "pedal";
	boardUid: string;
	x: number;
	y: number;
	rotationDeg: number;
	z: number;
}

function board(uid: string, x = 0, y = 0, size = 200): FixtureBoard {
	return {
		uid,
		boardRefId: null,
		customSize: { widthCm: size, heightCm: size },
		texture: "matte",
		name: `Bench ${uid}`,
		x,
		y,
		rotationDeg: 0,
	};
}

function items(
	count: number,
	boardUid: string,
	options: {
		refIds?: string[];
		x?: number;
		y?: number;
		samePosition?: boolean;
	} = {},
): FixtureItem[] {
	const refs = options.refIds ?? [FIRST_PEDAL];
	return Array.from({ length: count }, (_, index) => ({
		uid: `item-${index}`,
		refId: refs[index % refs.length],
		kind: "pedal",
		boardUid,
		x: options.samePosition
			? (options.x ?? 30)
			: (options.x ?? 2) + (index % 20) * 8.5,
		y: options.samePosition
			? (options.y ?? 20)
			: (options.y ?? 2) + Math.floor(index / 20) * 8.5,
		rotationDeg: 0,
		z: index,
	}));
}

async function seedScene(
	page: Page,
	boards: FixtureBoard[],
	sceneItems: FixtureItem[],
): Promise<void> {
	await page.goto("/");
	await expect(page.getByTestId("stage")).toBeVisible();
	await page.evaluate(
		async (fixture) => {
			const id = "e2e-capacity-scene";
			const updatedAt = new Date().toISOString();
			await new Promise<void>((resolve, reject) => {
				const request = indexedDB.open("pedalvision", 1);
				request.onerror = () => reject(request.error);
				request.onsuccess = () => {
					const tx = request.result.transaction("scenes", "readwrite");
					const store = tx.objectStore("scenes");
					store.clear();
					store.put({
						id,
						version: 1,
						name: "E2E capacity",
						boards: fixture.boards,
						items: fixture.items,
						customPedals: [],
						updatedAt,
					});
					tx.oncomplete = () => resolve();
					tx.onerror = () => reject(tx.error);
				};
			});
			localStorage.setItem(
				"pedalvision.scenes.v1",
				JSON.stringify({
					version: 1,
					scenes: [
						{
							id,
							name: "E2E capacity",
							updatedAt,
							boardCount: fixture.boards.length,
							itemCount: fixture.items.length,
						},
					],
				}),
			);
			localStorage.setItem(
				"pedalvision.settings.v1",
				JSON.stringify({ version: 1, activeSceneId: id }),
			);
			localStorage.removeItem("pedalvision.scene.v1");
		},
		{ boards, items: sceneItems },
	);
	await page.reload();
	await expect(page.getByTestId("stage")).toBeVisible();
	await expect(page.getByTestId("stage")).toHaveAttribute(
		"data-items",
		String(sceneItems.length),
	);
}

async function openScenes(page: Page): Promise<void> {
	await page.getByTestId("scene-open").click();
	await expect(page.getByTestId("scene-panel")).toBeVisible();
}

function isMobile(page: Page): boolean {
	return (page.viewportSize()?.width ?? 1280) < 1024;
}

test.describe("capacity Load Chart", () => {
	test("stays quiet at ok and warns softly at 200 parts", async ({ page }) => {
		await seedScene(page, [board("b1")], items(10, "b1"));
		await openScenes(page);
		await expect(page.getByTestId("scene-capacity")).toHaveCount(0);

		await seedScene(page, [board("b1")], items(200, "b1"));
		await openScenes(page);
		await expect(page.getByTestId("scene-capacity")).toContainText(
			"approaching the item limit",
		);
	});

	test("refuses an add at 400 parts with an inline reason", async ({
		page,
	}) => {
		await seedScene(page, [board("b1")], items(400, "b1"));
		await openPicker(page, "pedals");
		await expect(page.getByTestId("picker-capacity")).toContainText(
			"at the item limit",
		);
		// The strip lives outside the scrolling ledger, so it stays visible while
		// browsing a long catalog.
		await page
			.getByTestId("picker-results")
			.evaluate((element) => element.scrollTo(0, element.scrollHeight));
		await expect(page.getByTestId("picker-capacity")).toBeVisible();
		const row = page.locator('[data-testid^="add-pedal-"]').first();
		await expect(row).toHaveAttribute("data-blocked", "true");
		if (!isMobile(page)) {
			await expect(page.getByTestId("picker-place")).toHaveAttribute(
				"aria-disabled",
				"true",
			);
		}
		// aria-disabled keeps the row focusable; a real click is refused by the guard.
		await row.dispatchEvent("click");
		await expect(page.getByTestId("stage")).toHaveAttribute(
			"data-items",
			"400",
		);
	});

	test("refuses a board at 10 with an inline reason", async ({ page }) => {
		const boards = Array.from({ length: 10 }, (_, index) =>
			board(`b${index}`, index * 210),
		);
		await seedScene(page, boards, []);
		await openPicker(page, "boards");
		await expect(page.getByTestId("picker-capacity")).toContainText(
			"at the board limit",
		);
		const row = page.locator('[data-testid^="add-board-"]').first();
		await expect(row).toHaveAttribute("data-blocked", "true");
		await row.dispatchEvent("click");
		await expect(page.getByTestId("stage")).toHaveAttribute(
			"data-boards",
			"10",
		);
	});

	test("loads an over-cap recovered scene and warns instead of rejecting it", async ({
		page,
	}) => {
		const boards = Array.from({ length: 11 }, (_, index) =>
			board(`b${index}`, index * 210),
		);
		const sceneItems = Array.from({ length: 401 }, (_, index) => ({
			uid: `item-${index}`,
			refId: FIRST_PEDAL,
			kind: "pedal" as const,
			boardUid: boards[index % boards.length].uid,
			x: 2 + (index % 20) * 8.5,
			y: 2 + Math.floor(index / 20) * 8.5,
			rotationDeg: 0,
			z: index,
		}));
		await seedScene(page, boards, sceneItems);
		await expect(page.getByTestId("stage")).toHaveAttribute(
			"data-boards",
			"11",
		);
		await expect(page.getByTestId("stage")).toHaveAttribute(
			"data-items",
			"401",
		);
		await expect(page.getByTestId("scene-open")).toHaveAttribute(
			"aria-label",
			/over capacity, this scene still opens/,
		);
		await openScenes(page);
		await expect(page.getByTestId("scene-capacity")).toContainText(
			"Over capacity",
		);
		await expect(page.getByTestId("scene-capacity")).toContainText(
			"still opens",
		);
	});

	test("shows distinct images + estimated size and warns on a large export", async ({
		page,
	}) => {
		await seedScene(
			page,
			[board("b1", 0, 0, 60)],
			items(4, "b1", { refIds: PEDALS.slice(0, 4) }),
		);
		await page.getByTestId("export-open").click();
		await expect(page.getByTestId("export-panel")).toBeVisible();
		await expect(page.getByTestId("export-images")).toHaveText("4");
		await expect(page.getByTestId("export-file-size")).toContainText("about");
		await expect(page.getByTestId("export-capacity-warning")).toHaveCount(0);
		await page.getByTestId("export-close").click();

		await seedScene(page, [board("b1", 0, 0, 200)], items(200, "b1"));
		await page.getByTestId("export-open").click();
		await expect(page.getByTestId("export-panel")).toBeVisible();
		await expect(page.getByTestId("export-capacity-warning")).toContainText(
			"Large export",
		);
		await expect(page.getByTestId("export-download")).not.toHaveAttribute(
			"aria-disabled",
			"true",
		);
	});

	test("refuses Duplicate at the item cap with a note in the action bar", async ({
		page,
	}) => {
		await seedScene(
			page,
			[board("b1")],
			items(400, "b1", { samePosition: true, x: 30, y: 20 }),
		);
		const centre = await firstItemScreenCentre(page, FIRST_PEDAL_CM);
		await page.mouse.click(centre.x, centre.y);
		await expect(page.getByTestId("item-action-bar")).toBeVisible();
		await expect(page.getByTestId("item-capacity")).toContainText(
			"Item limit reached",
		);
		await expect(page.getByTestId("duplicate-item")).toBeDisabled();
		await page.keyboard.press("Meta+d");
		await expect(page.getByTestId("stage")).toHaveAttribute(
			"data-items",
			"400",
		);
	});
});
