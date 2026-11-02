import { expect, type Page, test } from "@playwright/test";
import { waitForSavedScene } from "./persistence.ts";
import { addBoard, addPedal, openPicker } from "./picker.ts";
import { shareHash } from "./share.ts";
import { firstItemScreenCentre } from "./stage.ts";

const CHOKA = "tc-electronic-choka-tremolo";
const CHOKA_CM = { widthCm: 7.4, heightCm: 13.2 };

async function expandDetails(page: Page): Promise<void> {
	const expand = page.getByTestId("info-expand");
	if (await expand.isVisible()) await expand.click();
}

async function placeChoka(page: Page): Promise<void> {
	await page.goto("/");
	await addBoard(page, "boss-bcb-1000");
	await addPedal(page, CHOKA);
	await expandDetails(page);
	await expect(page.getByTestId("info-jacks")).toBeVisible();
}

async function openCorrections(page: Page): Promise<void> {
	await page.getByTestId("jack-correct-toggle").click();
	await expect(page.getByTestId("jack-correct-toggle")).toHaveAttribute(
		"aria-pressed",
		"true",
	);
}

test("corrects a jack, persists it, and resets it", async ({ page }) => {
	await placeChoka(page);
	await openCorrections(page);

	await page.getByTestId("jack-row-1").click();
	await expect(page.getByTestId("jack-editor-1")).toBeVisible();
	await page.getByTestId("jack-edge-1-bottom").click();

	// The row reports the corrected position and provenance marker.
	await expect(page.getByTestId("jack-row-1")).toContainText("O · Bottom");
	await expect(page.getByTestId("jack-marker-corrected").first()).toBeVisible();
	await expect(page.getByTestId("jack-corrected-note")).toBeVisible();

	// Persisted in the scene document (A4).
	await waitForSavedScene(page, (document) => {
		const item = document.items[0] as
			| { jackOverrides?: Array<{ jack: number; edge?: string }> }
			| undefined;
		return (
			item?.jackOverrides?.[0]?.jack === 1 &&
			item.jackOverrides[0]?.edge === "bottom"
		);
	});

	// Reload and re-select: the correction survives.
	await page.reload();
	await expect(page.getByTestId("stage")).toBeVisible();
	const centre = await firstItemScreenCentre(page, CHOKA_CM);
	await page.mouse.click(centre.x, centre.y);
	await expandDetails(page);
	await expect(page.getByTestId("jack-row-1")).toContainText("O · Bottom");
	await expect(page.getByTestId("jack-marker-corrected").first()).toBeVisible();

	// Per-jack reset restores the catalog row and removes the marker.
	await openCorrections(page);
	await page.getByTestId("jack-row-1").click();
	await page.getByTestId("jack-reset-1").click();
	await expect(page.getByTestId("jack-row-1")).not.toContainText("Bottom");
	await expect(page.getByTestId("jack-marker-corrected")).toHaveCount(0);
});

test("reset all uses a two-step confirm and keeps the rest of the scene", async ({
	page,
}) => {
	await placeChoka(page);
	await openCorrections(page);
	await page.getByTestId("jack-row-0").click();
	await page.getByTestId("jack-edge-0-left").click();
	await page.getByTestId("jack-row-1").click();
	await page.getByTestId("jack-edge-1-bottom").click();
	await expect(page.getByTestId("jack-marker-corrected")).toHaveCount(2);

	await page.getByTestId("jack-reset-all").click();
	await expect(page.getByTestId("jack-reset-all-confirm")).toBeVisible();
	await page.getByTestId("jack-reset-all-cancel").click();
	await expect(page.getByTestId("jack-marker-corrected")).toHaveCount(2);
	await expect(page.getByTestId("jack-reset-all-confirm")).toHaveCount(0);

	await page.getByTestId("jack-reset-all").click();
	await page.getByTestId("jack-reset-all-confirm").click();
	await expect(page.getByTestId("jack-marker-corrected")).toHaveCount(0);
});

test("a read-only share shows the corrected jack without edit controls", async ({
	page,
}) => {
	const hash = shareHash({
		name: "Corrected share",
		boards: [],
		items: [
			{
				uid: "i1",
				refId: CHOKA,
				kind: "pedal",
				boardUid: null,
				x: 0,
				y: 0,
				rotationDeg: 0,
				z: 0,
				jackOverrides: [{ jack: 1, edge: "bottom", pos: 0.25 }],
			},
		],
	});
	await page.goto(`/?share=1${hash}`);
	await expect(page.getByTestId("stage")).toBeVisible();
	const centre = await firstItemScreenCentre(page, CHOKA_CM);
	await page.mouse.click(centre.x, centre.y);
	await expandDetails(page);
	await expect(page.getByTestId("info-jacks")).toContainText("O · Bottom");
	await expect(page.getByTestId("jack-marker-corrected").first()).toBeVisible();
	await expect(page.getByTestId("jack-correct-toggle")).toHaveCount(0);
});

test("custom pedals keep their shared editor (no per-instance correction)", async ({
	page,
}) => {
	await page.goto("/");
	await addBoard(page, "boss-bcb-1000");
	await openPicker(page, "custom");
	await page.getByTestId("custom-name").fill("Shared Jacks");
	await page.getByTestId("custom-width").fill("7");
	await page.getByTestId("custom-depth").fill("12");
	await page.getByTestId("custom-add-jack").click();
	await page.getByTestId("custom-submit").click();
	await expandDetails(page);
	await expect(page.getByTestId("info-jacks")).toContainText(
		"Custom part — jacks are shared by every copy.",
	);
	await expect(page.getByTestId("jack-correct-toggle")).toHaveCount(0);
});
