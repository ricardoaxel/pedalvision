import { expect, test } from "@playwright/test";

/**
 * F-41 — docs/legal hub. Static pages must work on desktop and mobile, with and
 * without JS, and the app must expose at least one persistent way in.
 */

const pages = [
	{ path: "/docs", nav: "Docs", heading: "Documentation" },
	{ path: "/help", nav: "Help", heading: "How to use Pedalvision" },
	{ path: "/features", nav: "Features", heading: "Features" },
	{ path: "/changelog", nav: "Changelog", heading: "Changelog" },
	{ path: "/privacy", nav: "Privacy", heading: "Privacy" },
	{ path: "/terms", nav: "Terms", heading: "Terms of use" },
	{
		path: "/community-guidelines",
		nav: "Community",
		heading: "Community guidelines",
	},
	{
		path: "/takedown",
		nav: "Takedown",
		heading: "Catalog image credits & removal",
	},
];

for (const entry of pages) {
	test(`${entry.path} renders the hub shell and current link`, async ({
		page,
	}) => {
		await page.goto(entry.path);
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
	const dismiss = page.getByTestId("first-run-dismiss");
	if (await dismiss.isVisible()) await dismiss.click();
	const help = page.getByRole("link", {
		name: "Help — documentation and legal",
	});
	await expect(help).toBeVisible();
	await expect(help).toHaveAttribute("href", "/docs");
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
