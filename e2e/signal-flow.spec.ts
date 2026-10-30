import { expect, type Page, test } from "@playwright/test";
import { addPedal } from "./picker.ts";

const PX_PER_CM = 4;

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
	if (!entry) throw new Error(`anchor ${key} not found in ${anchors}`);
	const [x, y] = entry
		.slice(key.length + 1)
		.split(",")
		.map(Number);
	return {
		x: box.x + x * PX_PER_CM * scale + vx,
		y: box.y + y * PX_PER_CM * scale + vy,
	};
}

async function clearSelection(page: Page): Promise<void> {
	const stage = page.getByTestId("stage");
	const box = await stage.boundingBox();
	if (!box) return;
	await page.mouse.click(box.x + 16, box.y + 120);
}

async function showPatch(page: Page): Promise<void> {
	await page.getByTestId("endpoint-open").click();
	const toggle = page.getByTestId("toggle-cables");
	if (!(await toggle.isChecked())) await toggle.check();
	await page.keyboard.press("Escape");
}

async function dragBetween(
	page: Page,
	from: { x: number; y: number },
	to: { x: number; y: number },
): Promise<void> {
	await page.mouse.move(from.x, from.y);
	await page.mouse.down();
	await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, {
		steps: 6,
	});
	await page.mouse.move(to.x, to.y, { steps: 6 });
	await page.mouse.up();
}

async function firstTwoItemJacks(page: Page) {
	const stage = page.getByTestId("stage");
	const anchors = (await stage.getAttribute("data-jack-anchors")) ?? "";
	const keys = anchors
		.split(";")
		.filter((entry) => entry.startsWith("item:"))
		.map((entry) => entry.split("@")[0]);
	const uidA = keys.find((key) => key.startsWith("item:"))?.split(":")[1];
	const second = keys.find((key) => !key.startsWith(`item:${uidA}:`));
	if (!uidA || !second) throw new Error("expected two jacked items");
	const uidB = second.split(":")[1];
	return {
		outA: `item:${uidA}:1`,
		inB: `item:${uidB}:0`,
	};
}

/** Two catalog pedals without jack data expose the documented fallback pair. */
async function connectFallbackPair(page: Page): Promise<void> {
	await addPedal(page, "boss-da-2-adaptive-distortion");
	await addPedal(page, "boss-ce-2-chorus");
	const { outA, inB } = await firstTwoItemJacks(page);
	await showPatch(page);
	await clearSelection(page);
	await dragBetween(
		page,
		await anchorScreenPoint(page, outA),
		await anchorScreenPoint(page, inB),
	);
	await expect(page.getByTestId("stage")).toHaveAttribute("data-cables", "1");
}

test("warns about an unpatched pedal, discloses assumed jacks and never blocks", async ({
	page,
}) => {
	await page.goto("/");
	await connectFallbackPair(page);
	await addPedal(page, "boss-bf-2-flanger");
	await clearSelection(page);

	const chip = page.getByTestId("continuity-toggle");
	await expect(chip).toHaveAttribute("data-warnings", "1");
	await expect(chip).toHaveAttribute("data-state", "notes");
	await chip.click();

	const panel = page.getByTestId("continuity-panel");
	await expect(panel).toBeVisible();
	await expect(panel).toContainText("Pedal is not patched");
	await expect(panel).toContainText("2 cable ends use assumed jack positions.");
	await expect(panel).toContainText("◇ Assumed");

	// Selecting the finding selects the offender and keeps the dock open.
	const row = page.getByTestId("continuity-row-0");
	await row.click();
	await expect(row).toHaveAttribute("aria-current", "true");

	// Non-blocking: close, then delete the selected pedal; the warning clears.
	await page.keyboard.press("Escape");
	await expect(panel).toHaveCount(0);
	await expect(chip).toBeFocused();
	await page.keyboard.press("Delete");
	await expect(page.getByTestId("stage")).toHaveAttribute("data-items", "2");
	await expect(chip).toHaveAttribute("data-warnings", "0");
	await expect(chip).toHaveText(/Clear/);
});

test("shows the clear state with fallback jacks and no false errors", async ({
	page,
}) => {
	await page.goto("/");
	await connectFallbackPair(page);
	await clearSelection(page);

	const chip = page.getByTestId("continuity-toggle");
	await expect(chip).toHaveAttribute("data-state", "clear");
	await chip.click();

	const panel = page.getByTestId("continuity-panel");
	await expect(panel).toContainText("Signal flow looks clear.");
	await expect(panel).toContainText("Checked 1 cable.");
	await expect(panel).toContainText("2 cable ends use assumed jack positions.");

	await page.keyboard.press("Escape");
	await expect(panel).toHaveCount(0);
});

test("opens the empty state before anything is patched", async ({ page }) => {
	await page.goto("/");
	const chip = page.getByTestId("continuity-toggle");
	await expect(chip).toHaveAttribute("data-state", "empty");
	await chip.click();
	await expect(page.getByTestId("continuity-panel")).toContainText(
		"Nothing patched yet.",
	);
});
