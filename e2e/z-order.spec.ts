import { expect, test } from "@playwright/test";

test("reordering a pedal persists across a reload", async ({ page }) => {
	await page.goto("/");
	const stage = page.getByTestId("stage");
	await expect(stage).toBeVisible();

	// Two overlapping loose pedals: the original (z 0) and its clone (z 1).
	await page.getByTestId("add-pedal-boss-bd-2-blues-driver").click();
	await expect(stage).toHaveAttribute("data-items", "1");
	await page.getByTestId("duplicate-item").click();
	await expect(stage).toHaveAttribute("data-items", "2");
	await expect(stage).toHaveAttribute("data-item-z", "0,1");

	// The clone is selected and sits on top: bring-forward is disabled there.
	await expect(page.getByTestId("bring-forward")).toBeDisabled();
	await expect(page.getByTestId("bring-to-front")).toBeDisabled();
	await expect(page.getByTestId("send-backward")).toBeEnabled();

	// Send it to the back: the two swap (array order [original, clone] → z 1,0).
	await page.getByTestId("send-to-back").click();
	await expect(stage).toHaveAttribute("data-item-z", "1,0");

	// Reload: the persisted scene restores the same order.
	await page.reload();
	const reloaded = page.getByTestId("stage");
	await expect(reloaded).toHaveAttribute("data-items", "2");
	await expect(reloaded).toHaveAttribute("data-item-z", "1,0");
});
