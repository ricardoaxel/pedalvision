import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { openPicker } from "./picker.ts";

const routes: { slug: string; nav: string; heading: string }[] = JSON.parse(
	readFileSync(resolve(process.cwd(), "public/hub/routes.json"), "utf8"),
);

/**
 * F-41 — docs/legal hub. Static pages must work on desktop and mobile, with and
 * without JS, and the app must expose at least one persistent way in.
 */

for (const entry of routes) {
	test(`/${entry.slug} renders the hub shell and current link`, async ({
		page,
	}) => {
		await page.goto(`/${entry.slug}`);
		await expect(
			page.getByRole("heading", { level: 1, name: entry.heading }),
		).toBeVisible();
		const nav = page.getByRole("navigation", {
			name: "Documentation and legal",
		});
		await expect(nav).toBeVisible();
		await expect(nav.getByRole("link", { name: entry.nav })).toHaveAttribute(
			"aria-current",
			"page",
		);
		await expect(
			page.getByRole("contentinfo").getByRole("link", { name: "Privacy" }),
		).toBeVisible();
	});
}

test("the hub is readable without JavaScript", async ({ browser }) => {
	const context = await browser.newContext({ javaScriptEnabled: false });
	const page = await context.newPage();
	await page.goto("/privacy");
	await expect(
		page.getByRole("heading", { level: 1, name: "Privacy" }),
	).toBeVisible();
	await expect(
		page.getByRole("navigation", { name: "Documentation and legal" }),
	).toBeVisible();
	await expect(
		page.getByRole("heading", { name: "What stays on your device" }),
	).toBeVisible();
	await expect(
		page.getByRole("button", { name: /Switch to .* theme/ }),
	).toBeHidden();
	await context.close();
});

test("the app exposes the how-to help from the canvas", async ({ page }) => {
	await page.goto("/");
	// The first-run note shares the mobile corner and deliberately hides the
	// chip. Seed its one-way dismissal before reloading so the assertion is
	// deterministic on a cold profile.
	await page.evaluate(() =>
		localStorage.setItem("pedalvision.firstRun.v1", "dismissed"),
	);
	await page.reload();
	const help = page.getByRole("link", {
		name: "Help — how to use Pedalvision",
	});
	await expect(help).toBeVisible();
	await expect(help).toHaveAttribute("href", "/help");
	// /help still carries the route into the full docs/legal hub.
	await page.goto("/help");
	await expect(
		page
			.getByRole("navigation", { name: "Documentation and legal" })
			.getByRole("link", { name: "Docs" }),
	).toHaveAttribute("href", "/docs");
});

test("the picker exposes the how-to help", async ({ page }) => {
	await page.goto("/");
	await openPicker(page, "pedals");
	await expect(
		page.getByTestId("picker-panel").getByRole("link", { name: "Help" }),
	).toHaveAttribute("href", "/help");
});

test("the help page explains layers and links to the section", async ({
	page,
}) => {
	await page.goto("/help");
	// The TOC is a complementary landmark and is hidden on phones, so use a
	// plain locator: the anchor must exist in both layouts.
	const tocLink = page.locator('.toc a[href="#layers"]');
	await expect(tocLink).toHaveText("Layers");
	await expect(
		page.getByRole("heading", { name: "Layer parts and boards" }),
	).toBeVisible();
	const section = page.locator("#layers");
	await expect(section).toContainText("newly added part lands on top");
	await expect(section).toContainText("Forward");
	await expect(section).toContainText("most recent board sits above");
});

test("the old attribution URL resolves to the takedown page", async ({
	page,
}) => {
	await page.goto("/attribution.html");
	await page.waitForURL(/\/takedown\/?$/);
	await expect(
		page.getByRole("heading", {
			level: 1,
			name: "Catalog image credits & removal",
		}),
	).toBeVisible();
});
