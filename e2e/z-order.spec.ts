import { expect, test } from "@playwright/test";
import { waitForSavedScene } from "./persistence.ts";
import { addPedal } from "./picker.ts";

test("reordering a pedal persists across a reload", async ({ page }) => {
	await page.goto("/");
	const stage = page.getByTestId("stage");
	await expect(stage).toBeVisible();

	// Two overlapping loose pedals: the original and its clone (z 1, on top).
	await addPedal(page, "boss-bd-2-blues-driver");
	await expect(stage).toHaveAttribute("data-items", "1");
	await page.getByTestId("duplicate-item").click();
	await expect(stage).toHaveAttribute("data-items", "2");

	// The rendered draw order is [original, clone].
	const before = ((await stage.getAttribute("data-item-order")) ?? "").split(
		",",
	);
	expect(before).toHaveLength(2);

	// The clone is selected and on top: bring-forward/forward are disabled there.
	await expect(page.getByTestId("bring-forward")).toBeDisabled();
	await expect(page.getByTestId("bring-to-front")).toBeDisabled();
	await expect(page.getByTestId("send-backward")).toBeEnabled();

	// Send it to the back: the two swap in render order.
	await page.getByTestId("send-to-back").click();
	const swapped = [...before].reverse().join(",");
	await expect
		.poll(async () => (await stage.getAttribute("data-item-order")) ?? "")
		.toBe(swapped);

	// Reload: the persisted scene restores the same render order.
	await waitForSavedScene(page, (document) => {
		const clone = document.items.find((item) => item.uid === before[1]);
		const original = document.items.find((item) => item.uid === before[0]);
		return document.items.length === 2 && clone?.z === 0 && original?.z === 1;
	});
	await page.reload();
	const reloaded = page.getByTestId("stage");
	await expect(reloaded).toHaveAttribute("data-items", "2");
	await expect(reloaded).toHaveAttribute("data-item-order", swapped);
});
