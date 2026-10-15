import { expect, test } from "@playwright/test";

type TouchType = "touchStart" | "touchEnd" | "touchMove" | "touchCancel";

/**
 * Touch-gesture coverage for the canvas viewport (P1-02).
 *
 * Touch input is injected over the Chrome DevTools Protocol
 * (`Input.dispatchTouchEvent`), which produces **trusted** pointer events with
 * `pointerType: "touch"` — the same events the canvas gesture handlers consume.
 * Playwright's built-in `touchscreen` only supports single taps, and its
 * `dispatchEvent` produces untrusted synthetic events. CDP is Chromium-only, so
 * these specs run in the `mobile-chromium` project (a Pixel device profile, so
 * `hasTouch` is on). CDP is built into Playwright — no new dependency.
 *
 * Assertions read the stage's `data-scale` / `data-x` / `data-y` debug
 * attributes (the same hooks the desktop smoke tests use).
 */

test.describe("touch gestures (CDP-injected, Chromium)", () => {
	test("two-finger pinch zooms the stage", async ({ page }) => {
		await page.goto("/");
		const stage = page.getByTestId("stage");
		await expect(stage).toBeVisible();

		const box = await stage.boundingBox();
		if (!box) throw new Error("stage has no bounding box");
		const cx = Math.round(box.x + box.width / 2);
		const cy = Math.round(box.y + box.height / 2);

		const cdp = await page.context().newCDPSession(page);
		const dispatch = (type: TouchType, points: { x: number; y: number }[]) =>
			cdp.send("Input.dispatchTouchEvent", {
				type,
				touchPoints: points.map((point, id) => ({
					id,
					x: point.x,
					y: point.y,
				})),
			});

		const scaleBefore = Number(await stage.getAttribute("data-scale"));

		await dispatch("touchStart", [
			{ x: cx - 30, y: cy },
			{ x: cx + 30, y: cy },
		]);
		for (let step = 1; step <= 6; step++) {
			const spread = 30 + step * 25;
			await dispatch("touchMove", [
				{ x: cx - spread, y: cy },
				{ x: cx + spread, y: cy },
			]);
		}
		await dispatch("touchEnd", []);

		await expect
			.poll(async () => Number(await stage.getAttribute("data-scale")))
			.toBeGreaterThan(scaleBefore);
	});

	test("two-finger drag pans the stage without zooming", async ({ page }) => {
		await page.goto("/");
		const stage = page.getByTestId("stage");
		await expect(stage).toBeVisible();

		const box = await stage.boundingBox();
		if (!box) throw new Error("stage has no bounding box");
		const cx = Math.round(box.x + box.width / 2);
		const cy = Math.round(box.y + box.height / 2);

		const cdp = await page.context().newCDPSession(page);
		const dispatch = (type: TouchType, points: { x: number; y: number }[]) =>
			cdp.send("Input.dispatchTouchEvent", {
				type,
				touchPoints: points.map((point, id) => ({
					id,
					x: point.x,
					y: point.y,
				})),
			});

		const scaleBefore = Number(await stage.getAttribute("data-scale"));
		const xBefore = Number(await stage.getAttribute("data-x"));
		const yBefore = Number(await stage.getAttribute("data-y"));

		const dx = 140;
		const dy = 90;
		await dispatch("touchStart", [
			{ x: cx - 30, y: cy },
			{ x: cx + 30, y: cy },
		]);
		for (let step = 1; step <= 6; step++) {
			const ox = (dx * step) / 6;
			const oy = (dy * step) / 6;
			await dispatch("touchMove", [
				{ x: cx - 30 + ox, y: cy + oy },
				{ x: cx + 30 + ox, y: cy + oy },
			]);
		}
		await dispatch("touchEnd", []);

		await expect
			.poll(async () => Number(await stage.getAttribute("data-x")) - xBefore)
			.toBeGreaterThan(100);

		const [yAfter, scaleAfter] = await Promise.all([
			stage.getAttribute("data-y").then(Number),
			stage.getAttribute("data-scale").then(Number),
		]);
		expect(yAfter - yBefore).toBeGreaterThan(70);
		expect(scaleAfter).toBeCloseTo(scaleBefore, 5);
	});
});
