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

test("the app exposes the docs hub from the canvas", async ({ page }) => {
	await page.goto("/");
	// The first-run note shares the mobile corner and deliberately hides the
	// chip. Seed its one-way dismissal before reloading so the assertion is
	// deterministic on a cold profile.
	await page.evaluate(() =>
		localStorage.setItem("pedalvision.firstRun.v1", "dismissed"),
	);
	await page.reload();
	const help = page.getByRole("link", {
		name: "Help — documentation and legal",
	});
	await expect(help).toBeVisible();
	await expect(help).toHaveAttribute("href", "/docs");
});

test("the picker exposes the docs hub", async ({ page }) => {
	await page.goto("/");
	await openPicker(page, "pedals");
	await expect(page.getByRole("link", { name: "Docs & help" })).toHaveAttribute(
		"href",
		"/docs",
	);
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
