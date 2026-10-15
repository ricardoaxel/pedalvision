import { expect, type Page, test } from "@playwright/test";

type TouchType = "touchStart" | "touchEnd" | "touchMove" | "touchCancel";

interface Point {
	x: number;
	y: number;
}

interface Transform {
	scale: number;
	x: number;
	y: number;
}

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
 * attributes, which only the gesture↔store path mutates.
 */

/** Open the app, pick a touch-enabled stage, and return the CDP + read helpers. */
async function openStage(page: Page) {
	await page.goto("/");
	const stage = page.getByTestId("stage");
	await expect(stage).toBeVisible();

	const box = await stage.boundingBox();
	if (!box) throw new Error("stage has no bounding box");
	const cx = Math.round(box.x + box.width / 2);
	const cy = Math.round(box.y + box.height / 2);

	const cdp = await page.context().newCDPSession(page);
	const dispatch = (type: TouchType, points: Point[]) =>
		cdp.send("Input.dispatchTouchEvent", {
			type,
			touchPoints: points.map((point, id) => ({
				id,
				x: point.x,
				y: point.y,
			})),
		});

	const transform = async (): Promise<Transform> => ({
		scale: Number(await stage.getAttribute("data-scale")),
		x: Number(await stage.getAttribute("data-x")),
		y: Number(await stage.getAttribute("data-y")),
	});

	return { cx, cy, dispatch, transform };
}

test.describe("touch gestures (CDP-injected, Chromium)", () => {
	test("two-finger pinch zooms the stage", async ({ page }) => {
		const { cx, cy, dispatch, transform } = await openStage(page);
		const before = await transform();

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
			.poll(async () => (await transform()).scale)
			.toBeGreaterThan(before.scale);
	});

	test("two-finger drag pans the stage without zooming", async ({ page }) => {
		const { cx, cy, dispatch, transform } = await openStage(page);
		const before = await transform();

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

		// Wait until the gesture has settled at its final translation before
		// reading the rest (intermediate moves would otherwise be observed).
		await expect
			.poll(async () => (await transform()).x - before.x)
			.toBeGreaterThan(dx - 1);
		const after = await transform();
		expect(after.y - before.y).toBeGreaterThan(dy - 1);
		expect(after.scale).toBeCloseTo(before.scale, 5);
	});
});
