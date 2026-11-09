import { expect, type Page, test } from "@playwright/test";
import { waitForSavedScene } from "./persistence.ts";
import { board, item, shareHash } from "./share.ts";
import { firstItemScreenCentre } from "./stage.ts";

/**
 * F-12 "Bench Notation" — a short user label on a placed part. Runs on the
 * desktop project and the `mobile-chromium` project (the field is always in the
 * desktop rail, but only in the expanded mobile sheet).
 */

const PEDAL = { widthCm: 8, heightCm: 12 };
const BOARD = { widthCm: 60, heightCm: 40 };

const customPedals = [
	{
		refId: "f12-pedal",
		brand: "Test",
		name: "Note Unit",
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
				refId: "f12-pedal",
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

async function seedScene(page: Page): Promise<void> {
	await page.goto("/");
	await expect(page.getByTestId("stage")).toBeVisible();
	const fixture = scene();
	await page.evaluate(async (fixture) => {
		const id = "f12-scene";
		const updatedAt = new Date().toISOString();
		await new Promise<void>((resolve, reject) => {
			const request = indexedDB.open("pedalvision", 1);
			request.onerror = () => reject(request.error);
			request.onsuccess = () => {
				const db = request.result;
				const tx = db.transaction("scenes", "readwrite");
				const store = tx.objectStore("scenes");
				store.clear();
				store.put({ id, version: 1, name: "F-12", ...fixture, updatedAt });
				tx.oncomplete = () => resolve();
				tx.onerror = () => reject(tx.error);
			};
		});
		localStorage.setItem(
			"pedalvision.scenes.v1",
			JSON.stringify({ version: 1, scenes: [{ id, name: "F-12", updatedAt }] }),
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

async function selectItem(page: Page): Promise<void> {
	const point = await firstItemScreenCentre(page, PEDAL);
	await page.mouse.click(point.x, point.y);
	await expect(page.getByTestId("info-panel")).toBeVisible();
}

async function expandDetails(page: Page): Promise<void> {
	const expand = page.getByTestId("info-expand");
	if (await expand.isVisible()) await expand.click();
}

test("sets, undoes, persists and clears a user label as one undo step", async ({
	page,
}) => {
	await seedScene(page);
	const stage = page.getByTestId("stage");
	await selectItem(page);
	await expandDetails(page);

	await expect(stage).toHaveAttribute("data-item-notes", "i1:default");
	const input = page.getByTestId("info-label-input");
	await expect(input).toBeVisible();
	const undoBefore = Number(await stage.getAttribute("data-undo-depth"));

	await input.fill("always on");
	await expect(stage).toHaveAttribute("data-item-notes", "i1:always on");
	await expect(page.getByTestId("info-label-count")).toHaveText("9/40");

	// The whole streamed edit is one step once the field is committed.
	await input.press("Escape");
	await expect(stage).toHaveAttribute(
		"data-undo-depth",
		String(undoBefore + 1),
	);
	await waitForSavedScene(
		page,
		(document) => document.items?.[0]?.label === "always on",
	);

	// Undo/redo round-trip through the persisted snapshot.
	await page.keyboard.press("Control+z");
	await expect(stage).toHaveAttribute("data-item-notes", "i1:default");
	await page.keyboard.press("Control+Shift+z");
	await expect(stage).toHaveAttribute("data-item-notes", "i1:always on");

	// Reload restores it.
	await page.reload();
	await expect(stage).toHaveAttribute("data-item-notes", "i1:always on");
	await selectItem(page);
	await expandDetails(page);
	await expect(page.getByTestId("info-label-input")).toHaveValue("always on");

	// Clear removes the optional field entirely.
	await page.getByTestId("info-label-clear").click();
	await expect(stage).toHaveAttribute("data-item-notes", "i1:default");
	await waitForSavedScene(
		page,
		(document) => document.items?.[0]?.label === undefined,
	);
});

test("read-only share shows the label with no edit field", async ({ page }) => {
	const hash = shareHash({
		boards: [
			board("b1", {
				boardRefId: null,
				customSize: { widthCm: BOARD.widthCm, heightCm: BOARD.heightCm },
				texture: "matte",
				name: "Test board",
			}),
		],
		items: [
			item("i1", {
				refId: "f12-pedal",
				boardUid: "b1",
				x: 10,
				y: 10,
				label: "always on",
			}),
		],
		customPedals,
	});
	await page.goto(`/?share=1${hash}`);
	await expect(page.getByTestId("stage")).toHaveAttribute("data-items", "1");
	await selectItem(page);
	await expandDetails(page);

	await expect(page.getByTestId("info-label-input")).toHaveCount(0);
	await expect(page.getByTestId("info-label-clear")).toHaveCount(0);
	await expect(page.getByTestId("info-label-value")).toHaveText("always on");
	await expect(page.getByTestId("stage")).toHaveAttribute(
		"data-item-notes",
		"i1:always on",
	);
});
