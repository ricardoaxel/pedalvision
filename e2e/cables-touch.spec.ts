import { expect, type Page, test } from "@playwright/test";
import { addPedal } from "./picker.ts";

const PX_PER_CM = 4;

type TouchType = "touchStart" | "touchEnd" | "touchMove";

async function anchorScreenPoint(
	page: Page,
	key: string,
): Promise<{ x: number; y: number }> {
	const stage = page.getByTestId("stage");
	const box = await stage.boundingBox();
	if (!box) throw new Error("stage has no bounding box");
	const scale = Number(await stage.getAttribute("data-scale")) || 1;
	const vx = Number(await stage.getAttribute("data-x")) || 0;
	const vy = Number(await stage.getAttribute("data-y")) || 0;
	const anchors = (await stage.getAttribute("data-jack-anchors")) ?? "";
	const entry = anchors
		.split(";")
		.find((candidate) => candidate.startsWith(`${key}@`));
	if (!entry) throw new Error(`anchor ${key} not found`);
	const [x, y] = entry
		.slice(key.length + 1)
		.split(",")
		.map(Number);
	return {
		x: box.x + x * PX_PER_CM * scale + vx,
		y: box.y + y * PX_PER_CM * scale + vy,
	};
}

/**
 * Touch drag-connect via CDP (`Input.dispatchTouchEvent`) — the same trusted
 * `pointerType: "touch"` path the phone uses. Playwright's mouse API on the
 * mobile project only exercises the pointer branch.
 */
test("drags jack → jack with a real touch pointer", async ({ page }) => {
	await page.goto("/");
	const stage = page.getByTestId("stage");
	await addPedal(page, "boss-bd-2-blues-driver");
	await addPedal(page, "boss-da-2-adaptive-distortion");
	// Connections are off by default; opt in via the Patch popover.
	await page.getByTestId("endpoint-open").click();
	await page.getByTestId("toggle-cables").check();
	await page.keyboard.press("Escape");
	// Deselect so the mobile item action bar cannot cover a tick.
	const box = await stage.boundingBox();
	if (box) await page.mouse.click(box.x + 16, box.y + 120);
	await expect(stage).toHaveAttribute("data-cables", "0");

	const anchors = (await stage.getAttribute("data-jack-anchors")) ?? "";
	const keys = anchors
		.split(";")
		.filter((entry) => entry.startsWith("item:"))
		.map((entry) => entry.split("@")[0]);
	const outA = keys.find((key) => key.endsWith(":1"));
	const uidA = outA?.split(":")[1];
	const inB = keys.find(
		(key) =>
			key.startsWith("item:") &&
			key.endsWith(":0") &&
			uidA !== undefined &&
			!key.startsWith(`item:${uidA}:`),
	);
	if (!outA || !inB || !uidA) throw new Error("expected two jacked items");
	const from = await anchorScreenPoint(page, outA);
	const to = await anchorScreenPoint(page, inB);

	const cdp = await page.context().newCDPSession(page);
	const dispatch = (type: TouchType, x: number, y: number) =>
		cdp.send("Input.dispatchTouchEvent", {
			type,
			touchPoints: [{ id: 0, x, y }],
		});
	await dispatch("touchStart", from.x, from.y);
	// Starting from a tick must not select the pedal on touch (the info sheet
	// would cover the connection guidance/canvas).
	await expect(page.getByTestId("info-panel")).toHaveCount(0);
	for (let step = 1; step <= 8; step++) {
		await dispatch(
			"touchMove",
			from.x + ((to.x - from.x) * step) / 8,
			from.y + ((to.y - from.y) * step) / 8,
		);
	}
	await dispatch("touchEnd", to.x, to.y);

	await expect(stage).toHaveAttribute("data-cables", "1");
	await expect(stage).toHaveAttribute("data-cable-arrows", "1");
	const uidB = inB.split(":")[1];
	await expect(stage).toHaveAttribute(
		"data-cable-directions",
		`item:${uidA}:1>item:${uidB}:0`,
	);
});
