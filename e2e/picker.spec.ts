import { expect, type Page, test } from "@playwright/test";
import { addBoard, addPedal, openPicker } from "./picker.ts";

/** The numeric result count from the picker footer (e.g. "137 pedals"). */
async function resultCount(page: Page): Promise<number> {
	const text = (await page.getByTestId("picker-count").textContent()) ?? "0";
	return Number.parseInt(text, 10);
}

/** True on the desktop layout (≥1024px) where the specimen pane is shown. */
function isDesktop(page: Page): boolean {
	return (page.viewportSize()?.width ?? 1280) >= 1024;
}

test("the picker searches, filters and places a pedal", async ({ page }) => {
	await page.goto("/");
	const stage = page.getByTestId("stage");
	await expect(stage).toHaveAttribute("data-items", "0");

	await openPicker(page, "pedals");
	const total = await resultCount(page);
	expect(total).toBeGreaterThan(0);

	// Search narrows the list to the matching pedal.
	await page.getByTestId("picker-search").fill("blues driver");
	await expect(
		page.getByTestId("add-pedal-boss-bd-2-blues-driver"),
	).toBeVisible();
	expect(await resultCount(page)).toBeLessThan(total);

	// Brand filter narrows further (BOSS still includes the searched pedal).
	await page.getByTestId("picker-brand").selectOption("BOSS");
	await expect(
		page.getByTestId("add-pedal-boss-bd-2-blues-driver"),
	).toBeVisible();

	// No-results recovery: a nonsense query offers "Clear filters".
	await page.getByTestId("picker-search").fill("zzzzzzzz");
	await expect(page.getByTestId("picker-empty")).toBeVisible();
	await page.getByRole("button", { name: "Clear filters" }).click();
	await expect(page.getByTestId("picker-empty")).toHaveCount(0);

	// Placing a pedal closes the picker and drops it on the canvas.
	await page.getByTestId("add-pedal-boss-bd-2-blues-driver").click();
	await expect(page.getByTestId("picker-panel")).toHaveCount(0);
	await expect(stage).toHaveAttribute("data-items", "1");
	await expect(stage).not.toHaveAttribute("data-selected-item", "");
});

test("an effect-type chip filters the pedal list", async ({ page }) => {
	await page.goto("/");
	await openPicker(page, "pedals");
	const before = await resultCount(page);
	await page.getByTestId("picker-effect-distortion").click();
	expect(await resultCount(page)).toBeLessThan(before);
	// Toggling the chip off restores the full list.
	await page.getByTestId("picker-effect-distortion").click();
	expect(await resultCount(page)).toBe(before);
});

test("the picker places and removes a board", async ({ page }) => {
	await page.goto("/");
	const stage = page.getByTestId("stage");
	await addBoard(page, "boss-bcb-1000");
	await expect(stage).toHaveAttribute("data-boards", "1");
	await expect(stage).not.toHaveAttribute("data-selected-board", "");

	await openPicker(page, "boards");
	await page.getByTestId("remove-board").click();
	await expect(stage).toHaveAttribute("data-boards", "0");
});

test("the picker dismisses via Esc, the close button and the backdrop", async ({
	page,
}) => {
	await page.goto("/");

	await openPicker(page, "boards");
	await page.keyboard.press("Escape");
	await expect(page.getByTestId("picker-panel")).toHaveCount(0);

	await openPicker(page, "boards");
	await page.getByTestId("picker-close").click();
	await expect(page.getByTestId("picker-panel")).toHaveCount(0);

	await openPicker(page, "boards");
	// Click the scrim's top-left corner (clear of the centered/bottom panel).
	await page.getByTestId("picker-scrim").click({ position: { x: 8, y: 8 } });
	await expect(page.getByTestId("picker-panel")).toHaveCount(0);
});

test("mobile shows the persistent bottom tab bar and the sheet", async ({
	page,
}) => {
	const width = page.viewportSize()?.width ?? 1280;
	test.skip(width >= 1024, "mobile-only check");

	await page.goto("/");
	await expect(page.getByTestId("picker-open")).toBeHidden();
	await expect(page.getByTestId("picker-open-board")).toBeHidden();

	const barTab = page.getByTestId("picker-bar-pedals");
	await expect(barTab).toBeVisible();
	await barTab.click();
	await expect(page.getByTestId("picker-panel")).toBeVisible();

	// The sheet leaves the tab bar reachable (small persistent footprint).
	await expect(page.getByTestId("picker-bar-pedals")).toBeVisible();
	// The switcher lives INSIDE the dialog (part of the modal's AT + focus scope).
	await expect(
		page.getByTestId("picker-panel").locator('nav[aria-label="Catalog"]'),
	).toHaveCount(1);
	const panel = await page.getByTestId("picker-panel").boundingBox();
	const viewport = page.viewportSize();
	if (!panel || !viewport) throw new Error("missing box");
	expect(panel.height).toBeLessThan(viewport.height);

	await page.getByTestId("add-pedal-boss-bd-2-blues-driver").click();
	await expect(page.getByTestId("picker-panel")).toHaveCount(0);
	await expect(page.getByTestId("stage")).toHaveAttribute("data-items", "1");
});

test("the specimen follows the active row and its CTA places the pedal", async ({
	page,
}) => {
	test.skip(
		!isDesktop(page),
		"the specimen pane (and its CTA) is desktop-only",
	);
	await page.goto("/");
	const stage = page.getByTestId("stage");
	await openPicker(page, "pedals");
	await page.getByTestId("picker-search").fill("blues driver");

	// Hovering a row makes it the active row (specimen mirrors it).
	const row = page.getByTestId("add-pedal-boss-bd-2-blues-driver");
	await row.hover();
	await expect(row).toHaveAttribute("data-active", "true");
	await expect(page.getByTestId("picker-specimen")).toContainText(
		"Blues Driver",
	);

	// The CTA places the active item and dismisses the picker.
	await page.getByTestId("picker-place").click();
	await expect(page.getByTestId("picker-panel")).toHaveCount(0);
	await expect(stage).toHaveAttribute("data-items", "1");
});

test("arrow keys move the active row and Enter places it (keyboard-first)", async ({
	page,
}) => {
	test.skip(!isDesktop(page), "keyboard ledger is desktop-first");
	await page.goto("/");
	const stage = page.getByTestId("stage");
	await openPicker(page, "pedals");

	// Focus starts in the search field; the first ArrowDown moves into the list.
	await page.keyboard.press("ArrowDown");
	const active = page.locator('.picker-item[data-active="true"]');
	await expect(active).toHaveCount(1);
	const firstId = await active.getAttribute("data-testid");

	await page.keyboard.press("ArrowDown");
	await expect(active).not.toHaveAttribute("data-testid", firstId ?? "");

	// Enter places the active row.
	await page.keyboard.press("Enter");
	await expect(page.getByTestId("picker-panel")).toHaveCount(0);
	await expect(stage).toHaveAttribute("data-items", "1");
});

test("switching tabs and the clear button reset the filters", async ({
	page,
}) => {
	test.skip(!isDesktop(page), "desktop segmented tabs switch the catalog");
	await page.goto("/");
	await openPicker(page, "pedals");
	await page.getByTestId("picker-search").fill("blues driver");
	await page.getByTestId("picker-brand").selectOption("BOSS");
	expect(await resultCount(page)).toBeLessThan(20);

	// Switching tabs clears the shared filters.
	await page.getByTestId("picker-tab-boards").click();
	await expect(page.getByTestId("picker-search")).toHaveValue("");
	await expect(page.getByTestId("picker-brand")).toHaveValue("");

	// The inline clear button restores the full list.
	await page.getByTestId("picker-tab-pedals").click();
	const full = await resultCount(page);
	await page.getByTestId("picker-search").fill("zzzzzzzz");
	await expect(page.getByTestId("picker-empty")).toBeVisible();
	await page.getByRole("button", { name: "Clear filters" }).click();
	expect(await resultCount(page)).toBe(full);
});

test("the 'All types' toggle reveals the full effect list", async ({
	page,
}) => {
	await page.goto("/");
	await openPicker(page, "pedals");
	const toggle = page.getByTestId("picker-effects-toggle");
	// A type outside the collapsed preview is hidden until expanded.
	const hidden = page.getByTestId("picker-effect-reverb");
	const before = await hidden.count();
	await toggle.click();
	if (before === 0) await expect(hidden).toBeVisible();
	await expect(toggle).toHaveText("Fewer");
	await toggle.click();
	await expect(toggle).toHaveText("All types");
});

test("adding several pedals to a board de-stacks them (no overlap)", async ({
	page,
}) => {
	await page.goto("/");
	const stage = page.getByTestId("stage");
	await addBoard(page, "boss-bcb-1000");
	for (const id of [
		"boss-bd-2-blues-driver",
		"boss-dd-8-digital-delay",
		"boss-ce-20-chorus-ensemble",
	]) {
		await addPedal(page, id);
	}
	await expect(stage).toHaveAttribute("data-items", "3");

	const positions = (await stage.getAttribute("data-item-positions")) ?? "";
	const spots = positions.split(";");
	expect(spots).toHaveLength(3);
	expect(new Set(spots).size).toBe(3);
});

test("loose pedals cascade instead of stacking at the viewport centre", async ({
	page,
}) => {
	await page.goto("/");
	const stage = page.getByTestId("stage");
	await addPedal(page, "boss-bd-2-blues-driver");
	await addPedal(page, "boss-bd-2-blues-driver");
	await addPedal(page, "boss-bd-2-blues-driver");
	await expect(stage).toHaveAttribute("data-items", "3");
	const spots = ((await stage.getAttribute("data-item-positions")) ?? "").split(
		";",
	);
	expect(new Set(spots).size).toBe(3);
});

test("filter chips stay inside the panel (wrap on desktop, scroll on mobile)", async ({
	page,
}) => {
	await page.goto("/");
	await openPicker(page, "pedals");
	const panel = await page.getByTestId("picker-panel").boundingBox();
	if (!panel) throw new Error("no panel");
	const mobile = (page.viewportSize()?.width ?? 1280) < 1024;
	const chips = page.locator(".picker__chip");
	const count = await chips.count();
	for (let index = 0; index < count; index++) {
		const box = await chips.nth(index).boundingBox();
		if (!box) continue;
		// Desktop wraps: every chip stays inside the panel horizontally.
		if (!mobile) {
			expect(box.x + box.width).toBeLessThanOrEqual(panel.x + panel.width + 1);
		}
		// Both layouts must never clip a chip vertically.
		expect(box.y).toBeGreaterThanOrEqual(panel.y - 1);
		expect(box.y + box.height).toBeLessThanOrEqual(panel.y + panel.height + 1);
	}
	if (mobile) {
		// Mobile uses one horizontally scrollable row so the results stay visible.
		const band = page.locator(".picker__chips");
		const bandBox = await band.boundingBox();
		if (!bandBox) throw new Error("no chip band");
		const scrollWidth = await band.evaluate((element) => element.scrollWidth);
		expect(scrollWidth).toBeGreaterThan(bandBox.width);
	}
});

test("result thumbnails resolve (DOM images load without CORS)", async ({
	page,
}) => {
	await page.goto("/");
	await openPicker(page, "pedals");
	await page.getByTestId("picker-search").fill("blues driver");
	// The picker thumbnails are plain DOM images (no crossOrigin), so a
	// hotlinked host without CORS headers still renders. If the image failed,
	// React swaps it for the neutral fallback and this locator would vanish.
	const first = page.locator("img.picker-item__thumb").first();
	await expect(first).toBeVisible();
	await expect
		.poll(() => first.evaluate((el) => (el as HTMLImageElement).naturalWidth), {
			timeout: 15_000,
		})
		.toBeGreaterThan(0);
});

test("board rows show a board preview image (falling back to a glyph)", async ({
	page,
}) => {
	await page.goto("/");
	await openPicker(page, "boards");
	// The ledger shows the real board art, not a generic glyph.
	const thumb = page.locator("img.picker-item__thumb--board").first();
	await expect(thumb).toBeVisible();
	await expect
		.poll(() => thumb.evaluate((el) => (el as HTMLImageElement).naturalWidth), {
			timeout: 15_000,
		})
		.toBeGreaterThan(0);
});

test("a board thumbnail falls back to the board glyph when its image fails", async ({
	page,
}) => {
	// The glyph is only the failure fallback; exercise it by failing the assets.
	await page.route("**/pedal-assets/boards/**", (route) => route.abort());
	await page.goto("/");
	await openPicker(page, "boards");
	await expect(
		page.locator(".picker-item__thumb--glyph").first(),
	).toBeVisible();
});

test("the toolbar has separate Add-pedal and Add-board buttons (desktop)", async ({
	page,
}) => {
	test.skip(!isDesktop(page), "desktop toolbar");
	await page.goto("/");
	await page.getByTestId("picker-open-board").click();
	await expect(page.getByTestId("picker-panel")).toBeVisible();
	// It opens directly on the Boards tab.
	await expect(page.getByTestId("picker-tab-boards")).toHaveAttribute(
		"aria-pressed",
		"true",
	);
	await page.keyboard.press("Escape");
	await page.getByTestId("picker-open").click();
	await expect(page.getByTestId("picker-tab-pedals")).toHaveAttribute(
		"aria-pressed",
		"true",
	);
});

test("the picker loads thumbnails CORS-first (clean cache entry)", async ({
	page,
}) => {
	// The float fix: the picker's FIRST thumbnail request must be crossOrigin
	// (CORS-clean), not no-CORS — otherwise it caches an ACAO-less response that
	// later poisons the canvas's crossOrigin request.
	const PNG = Buffer.from(
		"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
		"base64",
	);
	await page.route("**/ce_20_top_main.jpg*", (route) =>
		route.fulfill({
			status: 200,
			contentType: "image/png",
			body: PNG,
			headers: { "access-control-allow-origin": "*" },
		}),
	);
	await page.goto("/");
	await openPicker(page, "pedals");
	await page.getByTestId("picker-search").fill("CE-20");
	const thumb = page
		.getByTestId("add-pedal-boss-ce-20-chorus-ensemble")
		.locator("img.picker-item__thumb");
	await expect(thumb).toBeVisible();
	await expect(thumb).toHaveAttribute("crossorigin", "anonymous");
});

test("the canvas self-heals a poisoned image cache (offline simulation)", async ({
	page,
}) => {
	// Deterministic, no third-party host: the plain CE-20 request always fails
	// (a poisoned/no-ACAO cache) and only the busted key (?pedalvision-v=1)
	// succeeds. The loader must self-heal on both the picker thumb and the
	// canvas. (1x1 PNG.)
	const PNG = Buffer.from(
		"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
		"base64",
	);
	await page.route("**/ce_20_top_main.jpg*", (route) => {
		if (route.request().url().includes("pedalvision-v=1")) {
			return route.fulfill({
				status: 200,
				contentType: "image/png",
				body: PNG,
				headers: { "access-control-allow-origin": "*" },
			});
		}
		return route.abort("failed");
	});

	await page.goto("/");
	await openPicker(page, "pedals");
	await page.getByTestId("picker-search").fill("CE-20");
	const row = page.getByTestId("add-pedal-boss-ce-20-chorus-ensemble");
	await expect(row).toBeVisible();
	// The thumbnail self-heals (CORS-first → busted retry) and resolves.
	const thumb = row.locator("img.picker-item__thumb");
	await expect
		.poll(() => thumb.evaluate((el) => (el as HTMLImageElement).naturalWidth), {
			timeout: 15_000,
		})
		.toBeGreaterThan(0);

	// Placing it: the canvas loader must also recover (never end "failed").
	await row.click();
	const stage = page.getByTestId("stage");
	await expect(stage).toHaveAttribute("data-items", "1");
	await expect
		.poll(async () => (await stage.getAttribute("data-item-images")) ?? "", {
			timeout: 15_000,
		})
		.toBe("loaded:1 failed:0");
});

test("the picker uses the motion system and item changes get one transient motion event", async ({
	page,
}) => {
	await page.goto("/");
	const stage = page.getByTestId("stage");
	await openPicker(page, "pedals");
	const panel = page.getByTestId("picker-panel");
	const animationName = await panel.evaluate((element) => {
		// Desktop animates the panel; mobile keeps the surface still and fades
		// its content children instead.
		const own = getComputedStyle(element).animationName;
		if (own !== "none") return own;
		const child = element.querySelector(".picker__header");
		return child ? getComputedStyle(child).animationName : "none";
	});
	expect(animationName).not.toBe("none");

	// Place a stable catalog pedal: one add pulse, at its final geometry.
	const beforePulse = Number(
		(await stage.getAttribute("data-motion-pulse-seq")) ?? "0",
	);
	await page.getByTestId("add-pedal-boss-bd-2-blues-driver").click();
	await expect(page.getByTestId("picker-panel")).toHaveCount(0);
	await expect
		.poll(async () =>
			Number((await stage.getAttribute("data-motion-pulse-seq")) ?? "0"),
		)
		.toBeGreaterThan(beforePulse);

	// Duplicate and explicit delete each emit one event; the data is already final.
	const beforeDuplicate = Number(
		(await stage.getAttribute("data-motion-pulse-seq")) ?? "0",
	);
	await page.keyboard.press("Control+d");
	await expect
		.poll(async () =>
			Number((await stage.getAttribute("data-motion-pulse-seq")) ?? "0"),
		)
		.toBeGreaterThan(beforeDuplicate);

	const beforeGhost = Number(
		(await stage.getAttribute("data-motion-ghost-seq")) ?? "0",
	);
	await page.keyboard.press("Delete");
	await expect
		.poll(async () =>
			Number((await stage.getAttribute("data-motion-ghost-seq")) ?? "0"),
		)
		.toBeGreaterThan(beforeGhost);
});

test("reduced motion turns panel and item motion into an instant state change", async ({
	page,
}) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto("/");
	const stage = page.getByTestId("stage");
	const slowToken = await page.evaluate(() =>
		getComputedStyle(document.documentElement)
			.getPropertyValue("--motion-slow")
			.trim(),
	);
	expect(["0ms", "0s"]).toContain(slowToken);

	await openPicker(page, "pedals");
	await expect(page.getByTestId("picker-panel")).toBeVisible();
	await page.getByTestId("picker-close").click();
	await expect(page.getByTestId("picker-panel")).toHaveCount(0);

	// The canvas motion also stays off (no pulse events).
	const beforePulse = Number(
		(await stage.getAttribute("data-motion-pulse-seq")) ?? "0",
	);
	await openPicker(page, "pedals");
	await page.getByTestId("add-pedal-boss-bd-2-blues-driver").click();
	await expect(page.getByTestId("picker-panel")).toHaveCount(0);
	expect(
		Number((await stage.getAttribute("data-motion-pulse-seq")) ?? "0"),
	).toBe(beforePulse);
});

test("board add and delete each get one transient motion event", async ({
	page,
}) => {
	await page.goto("/");
	const stage = page.getByTestId("stage");
	const beforePulse = Number(
		(await stage.getAttribute("data-motion-board-pulse-seq")) ?? "0",
	);
	await addBoard(page, "boss-bcb-1000");
	await expect
		.poll(async () =>
			Number((await stage.getAttribute("data-motion-board-pulse-seq")) ?? "0"),
		)
		.toBeGreaterThan(beforePulse);

	const beforeGhost = Number(
		(await stage.getAttribute("data-motion-board-ghost-seq")) ?? "0",
	);
	await openPicker(page, "boards");
	await page.getByTestId("remove-board").click();
	await expect
		.poll(async () =>
			Number((await stage.getAttribute("data-motion-board-ghost-seq")) ?? "0"),
		)
		.toBeGreaterThan(beforeGhost);
	await expect(stage).toHaveAttribute("data-boards", "0");
});

/** Mirror the picker's normalization for sort-order assertions. */
function normalizeName(value: string): string {
	return value
		.normalize("NFKD")
		.replace(/\p{M}/gu, "")
		.toLowerCase()
		.replace(/&/g, " and ")
		.replace(/[^\p{L}\p{N}]+/gu, " ")
		.trim()
		.replace(/\s+/g, " ");
}

test("search finds DD-2 from model shorthand and punctuation", async ({
	page,
}) => {
	await page.goto("/");
	await openPicker(page, "pedals");
	const search = page.getByTestId("picker-search");
	for (const query of ["dd2", "DD-2", "dd-2", "DD 2"]) {
		await search.fill(query);
		await expect(
			page.getByTestId("add-pedal-boss-dd-2-digital-delay"),
		).toBeVisible();
		// The boundary-aware match must not drag in DD-20/DD-200.
		await expect(
			page.getByTestId("add-pedal-boss-dd-20-giga-delay"),
		).toHaveCount(0);
	}
});

test("brand aliases resolve (ehx)", async ({ page }) => {
	await page.goto("/");
	await openPicker(page, "pedals");
	await page.getByTestId("picker-search").fill("ehx");
	await expect(
		page.getByTestId("add-pedal-electro-harmonix-1-echo"),
	).toBeVisible();
});

test("effect labels are searchable (keeley fuzz)", async ({ page }) => {
	await page.goto("/");
	await openPicker(page, "pedals");
	await page.getByTestId("picker-search").fill("keeley fuzz");
	// Angry Orange is a fuzz whose name does not contain "fuzz".
	await expect(page.getByTestId("add-pedal-keeley-angry-orange")).toBeVisible();
});

test("Name A–Z orders the visible results deterministically", async ({
	page,
}) => {
	await page.goto("/");
	await openPicker(page, "pedals");
	await page.getByTestId("picker-brand").selectOption("Meris");
	await page.getByTestId("picker-sort").selectOption("name");
	const names = page.locator(".picker-item__name");
	await expect(names.first()).toBeVisible();
	const texts = (await names.allTextContents()).slice(0, 8).map(normalizeName);
	expect(texts.length).toBeGreaterThan(1);
	const sorted = [...texts].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
	expect(texts).toEqual(sorted);
});

test("search, filter and sort then place a pedal", async ({ page }) => {
	await page.goto("/");
	await openPicker(page, "pedals");
	await page.getByTestId("picker-search").fill("dd");
	await page.getByTestId("picker-brand").selectOption("BOSS");
	await page.getByTestId("picker-effects-toggle").click();
	await page.getByTestId("picker-effect-delay").click();
	await page.getByTestId("picker-sort").selectOption("name");
	await expect(
		page.getByTestId("add-pedal-boss-dd-2-digital-delay"),
	).toBeVisible();
	await page.getByTestId("add-pedal-boss-dd-2-digital-delay").click();
	await expect(page.getByTestId("picker-panel")).toHaveCount(0);
	await expect(page.getByTestId("stage")).toHaveAttribute("data-items", "1");
});

test("the empty state echoes the query and active filters", async ({
	page,
}) => {
	await page.goto("/");
	await openPicker(page, "pedals");
	await page.getByTestId("picker-brand").selectOption("BOSS");
	await page.getByTestId("picker-search").fill("zzzzzzzz");
	const empty = page.getByTestId("picker-empty");
	await expect(empty).toContainText("No pedals match");
	await expect(empty).toContainText("zzzzzzzz");
	await expect(empty).toContainText("Filtered by BOSS");
	await page.getByRole("button", { name: "Clear filters" }).click();
	await expect(page.getByTestId("picker-search")).toHaveValue("");
	await expect(page.getByTestId("picker-brand")).toHaveValue("");
	await expect(page.getByTestId("picker-search")).toBeFocused();
	await expect(empty).toHaveCount(0);
});

test("a punctuation-only query shows the echoed empty state", async ({
	page,
}) => {
	await page.goto("/");
	await openPicker(page, "pedals");
	await page.getByTestId("picker-search").fill("!!!");
	const empty = page.getByTestId("picker-empty");
	await expect(empty).toBeVisible();
	await expect(empty).toContainText("No pedals match");
	await expect(empty).toContainText("!!!");
	await expect(empty).not.toContainText("Filtered by");
});

test("progressive and prefix search finds real pedals", async ({ page }) => {
	await page.goto("/");
	await openPicker(page, "pedals");
	const search = page.getByTestId("picker-search");

	// Progressive typing of a concatenated model + word: B7K → B7K Ultra.
	for (const query of ["b7k", "b7ku", "b7kult", "b7kultra"]) {
		await search.fill(query);
		await expect(
			page.getByTestId("add-pedal-darkglass-microtubes-b7k-ultra"),
		).toBeVisible({ timeout: 15_000 });
	}

	// Prefix and compact matches for planner catalog items.
	await search.fill("polytun");
	await expect(page.getByTestId("add-pedal-tc-polytune")).toBeVisible({
		timeout: 15_000,
	});
	await search.fill("hydr");
	await expect(page.getByTestId("add-pedal-keeley-hydra")).toBeVisible({
		timeout: 15_000,
	});

	// A brand query ranks the brand's own pedals above name mentions.
	await search.fill("strymon");
	await expect(page.locator(".picker-item__brand").first()).toContainText(
		"Strymon",
	);
});
