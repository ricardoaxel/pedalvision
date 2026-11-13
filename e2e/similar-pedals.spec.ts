import { expect, type Page, test } from "@playwright/test";
import { addBoard, addPedal, openPicker } from "./picker.ts";
import { item, shareHash } from "./share.ts";
import { firstItemScreenCentre } from "./stage.ts";

/**
 * F-14 — "Similar" sound-alikes. A selected catalogue pedal shows a cross-brand
 * circuit/algorithm group first and the maker's own family register second.
 * Tapping a row/token opens the Pedals picker on that exact model; the footer
 * opens the broad effect list. Runs on desktop + mobile.
 */

/** Expand the mobile info sheet (a no-op on the desktop rail). */
async function expandDetails(page: Page): Promise<void> {
	const expand = page.getByTestId("info-expand");
	if (await expand.isVisible()) await expand.click();
}

async function selectPedal(
	page: Page,
	id: string,
	query?: string,
): Promise<void> {
	await page.goto("/");
	await addBoard(page, "boss-bcb-1000");
	if (query) {
		await openPicker(page, "pedals");
		await page.getByTestId("picker-search").fill(query);
		await page.getByTestId(`add-pedal-${id}`).click();
		await expect(page.getByTestId("picker-panel")).toHaveCount(0);
	} else {
		await addPedal(page, id);
	}
	await expect(page.getByTestId("info-panel")).toBeVisible();
	await expandDetails(page);
}

test("lists other-brand digital delays and the DD family, and opens exact models", async ({
	page,
}) => {
	await selectPedal(page, "boss-dd-3-digital-delay");

	const section = page.getByTestId("info-similar");
	await expect(section).toBeVisible();
	await expect(section).toContainText("Sounds like");
	await expect(section).toContainText("Other digital delays");
	await expect(section).toContainText("Also from BOSS");

	// Cross-brand sound-alikes, not a broad delay list.
	const cross = page.getByTestId("info-similar-behringer-dd600-digital-delay");
	await expect(cross).toBeVisible();
	await expect(cross).toContainText("DD600 Digital Delay");
	await expect(cross).toContainText("Behringer");
	// The family register uses short model tokens.
	const dd5 = page.getByTestId("info-similar-boss-dd-5-digital-delay");
	await expect(dd5).toBeVisible();
	await expect(dd5).toHaveText("DD-5");
	await expect(dd5).toHaveAttribute("aria-haspopup", "dialog");
	// No colourways / other DD formats / the target itself.
	await expect(
		page.getByTestId("info-similar-boss-dd-3-digital-delay"),
	).toHaveCount(0);
	await expect(
		page.getByTestId("info-similar-boss-dd-200-digital-delay"),
	).toHaveCount(0);

	// A family token opens that exact model.
	await dd5.click();
	await expect(page.getByTestId("picker-panel")).toBeVisible();
	await expect(page.getByTestId("picker-search")).toHaveValue(
		"DD-5 Digital Delay",
	);
	await expect(page.getByTestId("picker-effect-delay")).toHaveAttribute(
		"aria-pressed",
		"true",
	);
	await expect(page.getByTestId("picker-brand")).toHaveValue("");
	await expect(page.getByTestId("picker-sort")).toHaveValue("relevance");
	await expect(page.getByTestId("picker-stereo")).toHaveAttribute(
		"aria-pressed",
		"false",
	);
	await page.getByTestId("picker-close").click();
	await expect(page.getByTestId("picker-panel")).toHaveCount(0);

	// A cross-brand row opens that exact model too.
	await cross.click();
	await expect(page.getByTestId("picker-panel")).toBeVisible();
	await expect(page.getByTestId("picker-search")).toHaveValue(
		"DD600 Digital Delay",
	);
	await page.getByTestId("picker-close").click();
	await expect(page.getByTestId("picker-panel")).toHaveCount(0);

	// The footer is the broad "more all" path: filtered, no model query.
	await page.getByTestId("info-similar-browse").click();
	await expect(page.getByTestId("picker-panel")).toBeVisible();
	await expect(page.getByTestId("picker-search")).toHaveValue("");
	await expect(page.getByTestId("picker-effect-delay")).toHaveAttribute(
		"aria-pressed",
		"true",
	);
	await expect(page.getByTestId("picker-sort")).toHaveValue("name");
});

test("suggests cross-brand Tube Screamer-style pedals for a drive", async ({
	page,
}) => {
	await selectPedal(page, "jhs-808", "808");

	const section = page.getByTestId("info-similar");
	await expect(section).toBeVisible();
	await expect(section).toContainText("Screamer-style overdrive");
	const sd1 = page.getByTestId("info-similar-boss-sd-1-super-overdrive");
	await expect(sd1).toBeVisible();
	await expect(sd1).toContainText("SD-1 Super Overdrive");
	// A generic overdrive is never suggested just for sharing the tag.
	await expect(
		page.getByTestId("info-similar-boss-bd-2-blues-driver"),
	).toHaveCount(0);

	await sd1.click();
	await expect(page.getByTestId("picker-panel")).toBeVisible();
	await expect(page.getByTestId("picker-search")).toHaveValue(
		"SD-1 Super Overdrive",
	);
	await expect(page.getByTestId("picker-effect-overdrive")).toHaveAttribute(
		"aria-pressed",
		"true",
	);
});

test("a re-tap re-applies the preset after the picker closes", async ({
	page,
}) => {
	await selectPedal(page, "boss-dd-3-digital-delay");
	const dd5 = page.getByTestId("info-similar-boss-dd-5-digital-delay");
	await dd5.click();
	await expect(page.getByTestId("picker-panel")).toBeVisible();

	// The user changes every filter axis, then closes without placing.
	await page.getByTestId("picker-search").fill("waza");
	await page.getByTestId("picker-brand").selectOption("BOSS");
	await page.getByTestId("picker-sort").selectOption("name");
	await page.getByTestId("picker-stereo").click();
	await expect(page.getByTestId("picker-stereo")).toHaveAttribute(
		"aria-pressed",
		"true",
	);
	await page.getByTestId("picker-close").click();
	await expect(page.getByTestId("picker-panel")).toHaveCount(0);
	await expect(page.getByTestId("info-similar")).toBeVisible();

	// Re-tapping the same token re-applies the preset (new key) and resets axes.
	await dd5.click();
	await expect(page.getByTestId("picker-panel")).toBeVisible();
	await expect(page.getByTestId("picker-search")).toHaveValue(
		"DD-5 Digital Delay",
	);
	await expect(page.getByTestId("picker-brand")).toHaveValue("");
	await expect(page.getByTestId("picker-sort")).toHaveValue("relevance");
	await expect(page.getByTestId("picker-stereo")).toHaveAttribute(
		"aria-pressed",
		"false",
	);
	await expect(page.getByTestId("picker-effect-delay")).toHaveAttribute(
		"aria-pressed",
		"true",
	);
});

test("a normal reopen after a preset starts from the default view", async ({
	page,
}) => {
	await selectPedal(page, "boss-dd-3-digital-delay");
	await page.getByTestId("info-similar-boss-dd-5-digital-delay").click();
	await expect(page.getByTestId("picker-panel")).toBeVisible();
	// Dirty every axis, then close with the X.
	await page.getByTestId("picker-brand").selectOption("BOSS");
	await page.getByTestId("picker-sort").selectOption("name");
	await page.getByTestId("picker-stereo").click();
	await page.getByTestId("picker-close").click();
	await expect(page.getByTestId("picker-panel")).toHaveCount(0);

	// The next normal open must not inherit the preset query/type.
	await openPicker(page, "pedals");
	await expect(page.getByTestId("picker-search")).toHaveValue("");
	await expect(page.getByTestId("picker-brand")).toHaveValue("");
	await expect(page.getByTestId("picker-sort")).toHaveValue("relevance");
	await expect(page.getByTestId("picker-stereo")).toHaveAttribute(
		"aria-pressed",
		"false",
	);
	await expect(page.getByTestId("picker-effect-overdrive")).toHaveAttribute(
		"aria-pressed",
		"false",
	);
	// Delay is outside the collapsed chip preview, so a cleared filter means it
	// is not rendered at all.
	await expect(page.getByTestId("picker-effect-delay")).toHaveCount(0);
});

test("falls back to other octave pedals when there is no circuit", async ({
	page,
}) => {
	await selectPedal(page, "boss-oc-5-octave", "OC-5");

	const section = page.getByTestId("info-similar");
	await expect(section).toBeVisible();
	await expect(section).toContainText("Other octave pedals");
	await expect(section).toContainText("Also from BOSS");
	const joyo = page.getByTestId("info-similar-joyo-jf-12-voodoo-octave");
	await expect(joyo).toBeVisible();
	await expect(joyo).toContainText("JF-12 Voodoo Octave");
	await expect(
		page.getByTestId("info-similar-boss-oc-3-super-octave"),
	).toBeVisible();

	await joyo.click();
	await expect(page.getByTestId("picker-panel")).toBeVisible();
	await expect(page.getByTestId("picker-search")).toHaveValue(
		"JF-12 Voodoo Octave",
	);
	await expect(page.getByTestId("picker-effect-octave")).toHaveAttribute(
		"aria-pressed",
		"true",
	);
});

test("hides the similar section for a custom part", async ({ page }) => {
	await page.goto("/");
	await openPicker(page, "custom");
	await page.getByTestId("custom-name").fill("My Fuzz");
	await page.getByTestId("custom-width").fill("6");
	await page.getByTestId("custom-depth").fill("12");
	await page.getByTestId("custom-submit").click();
	await expect(page.getByTestId("info-panel")).toBeVisible();
	await expandDetails(page);
	await expect(page.getByTestId("info-similar")).toHaveCount(0);
});

test("hides the similar section in a read-only share", async ({ page }) => {
	const hash = shareHash({
		name: "Shared drive",
		boards: [
			{
				uid: "b-1",
				boardRefId: "boss-bcb-1000",
				x: 0,
				y: 0,
				rotationDeg: 0,
			},
		],
		items: [item("i-1", { boardUid: "b-1", x: 5, y: 5 })],
	});
	await page.goto(`/?share=1${hash}`);
	const stage = page.getByTestId("stage");
	await expect(stage).toHaveAttribute("data-items", "1");
	const centre = await firstItemScreenCentre(page, {
		widthCm: 7.3,
		heightCm: 13.02,
	});
	await page.mouse.click(centre.x, centre.y);
	await expect(page.getByTestId("info-panel")).toBeVisible();
	await expandDetails(page);
	await expect(page.getByTestId("info-similar")).toHaveCount(0);
	// The picker is an edit surface and must not exist in a share.
	await expect(page.getByTestId("picker-panel")).toHaveCount(0);
});
