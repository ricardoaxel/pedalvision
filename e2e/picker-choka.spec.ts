import { readFile } from "node:fs/promises";
import { expect, type Page, test } from "@playwright/test";
import sharp from "sharp";
import { openPicker } from "./picker.ts";
import { item, shareHash } from "./share.ts";
import { firstItemScreenCentre } from "./stage.ts";

const CHOKA = { widthCm: 7.4, heightCm: 13.2 };

function isMobile(page: Page): boolean {
	return (page.viewportSize()?.width ?? 1280) < 1024;
}

async function firstItemPosition(page: Page): Promise<string> {
	const value = await page
		.getByTestId("stage")
		.getAttribute("data-item-positions");
	return (value ?? "").split(";")[0] ?? "";
}

async function firstItemRotation(page: Page): Promise<string> {
	const value = await page
		.getByTestId("stage")
		.getAttribute("data-item-rotations");
	return (value ?? "").split(",")[0] ?? "";
}

/** Average a small screen region (RGB means) from a screenshot clip. */
async function screenRegion(
	page: Page,
	x: number,
	y: number,
): Promise<number[]> {
	const buffer = await page.screenshot({
		clip: { x: Math.round(x), y: Math.round(y), width: 6, height: 6 },
	});
	const stats = await sharp(buffer).stats();
	return stats.channels.slice(0, 3).map((channel) => channel.mean);
}

/** The Choka face is orange; the failed-image fallback is neutral. */
function looksOrange(pixel: number[]): boolean {
	const [r, g, b] = pixel;
	return r > 120 && r > g + 25 && g > b + 5;
}

async function openExport(page: Page): Promise<void> {
	await page.getByTestId("export-open").click();
	await expect(page.getByTestId("export-panel")).toBeVisible();
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

test("Choka AVIF: picker thumbs, canvas move/rotate, PNG/PDF export and share", async ({
	page,
}, testInfo) => {
	const errors: string[] = [];
	page.on("pageerror", (error) => errors.push(String(error)));
	page.on("console", (message) => {
		if (message.type() === "error") errors.push(message.text());
	});

	await page.goto("/");
	await openPicker(page, "pedals");
	await page.getByTestId("picker-search").fill("choka");

	const row = page.getByTestId("add-pedal-tc-electronic-choka-tremolo");
	await expect(row).toBeVisible();
	await expect(page.getByTestId("picker-count")).toHaveText(/^1\b/);
	await expect(row).toContainText("TC Electronic");
	await expect(row).toContainText("7.4 × 13.2 cm");

	// The ledger row uses the 350 AVIF thumb; the specimen uses the 800 AVIF.
	const thumb = row.locator("img");
	await expect
		.poll(() =>
			thumb.evaluate((element: HTMLImageElement) => element.naturalWidth),
		)
		.toBeGreaterThan(0);
	expect(await thumb.getAttribute("src")).toBe(
		"/pedal-assets/pedals/350/tc-electronic-choka-tremolo.avif",
	);
	if (!isMobile(page)) {
		const specimen = page.getByTestId("picker-specimen").locator("img");
		await expect
			.poll(() =>
				specimen.evaluate((element: HTMLImageElement) => element.naturalWidth),
			)
			.toBeGreaterThan(0);
		expect(await specimen.getAttribute("src")).toBe(
			"/pedal-assets/pedals/800/tc-electronic-choka-tremolo.avif",
		);
	}

	await page.screenshot({
		path: `work/catalog/screenshots/avif-picker-${testInfo.project.name}.png`,
	});

	await row.click();
	await expect(page.getByTestId("picker-panel")).toHaveCount(0);
	await expect(page.getByTestId("stage")).toHaveAttribute("data-items", "1");
	await expect(page.getByTestId("info-name")).toHaveText("Choka Tremolo");

	if (!isMobile(page)) {
		// Official rear/top view: OUTPUT on the player's left (~0.2), INPUT on the
		// right (~0.8), 9V centered (~0.5; not a cable anchor).
		await expect(page.getByTestId("info-jacks")).toContainText(
			"O · Top · ~0.20",
		);
		await expect(page.getByTestId("info-jacks")).toContainText(
			"I · Top · ~0.80",
		);
		await expect(page.getByTestId("info-power-value")).toContainText("9 V");
	}

	// The canvas really decoded the AVIF (orange face, not the neutral fallback).
	const centre = await firstItemScreenCentre(page, CHOKA);
	const face = await screenRegion(page, centre.x - 10, centre.y - 22);
	expect(looksOrange(face), `face pixel ${face.join(",")}`).toBe(true);

	await page.screenshot({
		path: `work/catalog/screenshots/avif-canvas-${testInfo.project.name}.png`,
	});

	if (isMobile(page)) {
		expect(errors).toEqual([]);
		return;
	}

	// Move.
	const beforeMove = await firstItemPosition(page);
	await page.mouse.move(centre.x, centre.y);
	await page.mouse.down();
	await page.mouse.move(centre.x + 80, centre.y + 40, { steps: 8 });
	await page.mouse.up();
	await expect.poll(() => firstItemPosition(page)).not.toBe(beforeMove);

	// Rotate via the action bar (+45°).
	const beforeRotate = await firstItemRotation(page);
	await page.getByTestId("rotate-item").click();
	await expect.poll(() => firstItemRotation(page)).not.toBe(beforeRotate);

	// Export PNG (all content; the loose Choka is included).
	await openExport(page);
	await page.getByRole("radio", { name: "All content" }).click();
	const png = await downloadPng(page);
	expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
	expect(png.length).toBeGreaterThan(1000);

	// Export PDF.
	await page.getByRole("button", { name: "Export again" }).click();
	await page.getByRole("radio", { name: "All content" }).click();
	await page.getByRole("radio", { name: "PDF" }).click();
	const [pdfDownload] = await Promise.all([
		page.waitForEvent("download"),
		page.getByTestId("export-download").click(),
	]);
	const pdfPath = await pdfDownload.path();
	if (!pdfPath) throw new Error("pdf download has no path");
	const pdf = await readFile(pdfPath);
	expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
	const pdfText = pdf.toString("latin1");
	expect(pdfText).toContain("/Subtype /Image");
	expect(pdfText).toContain("/Filter /DCTDecode");

	// Share link: the recipient resolves the same AVIF from the catalog.
	const hash = shareHash({
		boards: [],
		items: [item("choka-share", { refId: "tc-electronic-choka-tremolo" })],
	});
	await page.goto(`/?share=1${hash}`);
	await expect(page.getByTestId("stage")).toHaveAttribute("data-items", "1");
	const sharedCentre = await firstItemScreenCentre(page, CHOKA);
	const sharedFace = await screenRegion(
		page,
		sharedCentre.x - 10,
		sharedCentre.y - 22,
	);
	expect(looksOrange(sharedFace), `shared face ${sharedFace.join(",")}`).toBe(
		true,
	);

	await page.screenshot({
		path: `work/catalog/screenshots/avif-share-${testInfo.project.name}.png`,
	});

	expect(errors).toEqual([]);
});
