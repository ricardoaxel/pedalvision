import { expect, type Page } from "@playwright/test";

export type PickerTab = "pedals" | "boards" | "custom";

/** Desktop toolbar trigger per tab (each opens the picker on its own tab). */
const TOOLBAR_TRIGGER: Record<PickerTab, string> = {
	pedals: "picker-open",
	boards: "picker-open-board",
	custom: "picker-open",
};

/**
 * Open the P2-01 picker on `tab` and wait for its panel. Desktop (≥1024px) has
 * toolbar icon buttons that open directly on a tab ("Add pedal" / "Add board");
 * mobile (<1024px) uses the persistent bottom tab bar, the only control there.
 * The Custom tab has no toolbar trigger — it is reached from the open picker.
 */
export async function openPicker(page: Page, tab: PickerTab): Promise<void> {
	const barTab = page.getByTestId(`picker-bar-${tab}`);
	if (await barTab.isVisible()) {
		await barTab.click();
	} else {
		await page.getByTestId(TOOLBAR_TRIGGER[tab]).click();
		if (tab === "custom") {
			await page.getByTestId("picker-tab-custom").click();
		}
	}
	await expect(page.getByTestId("picker-panel")).toBeVisible();
}

/** Open the picker on the boards tab and place the given catalog board. */
export async function addBoard(page: Page, id: string): Promise<void> {
	await openPicker(page, "boards");
	await page.getByTestId(`add-board-${id}`).click();
	await expect(page.getByTestId("picker-panel")).toHaveCount(0);
}

/** Open the picker on the pedals tab and place the given catalog pedal. */
export async function addPedal(page: Page, id: string): Promise<void> {
	await openPicker(page, "pedals");
	await page.getByTestId(`add-pedal-${id}`).click();
	await expect(page.getByTestId("picker-panel")).toHaveCount(0);
}

/** Open the boards tab and remove the currently selected board. */
export async function removeSelectedBoard(page: Page): Promise<void> {
	await openPicker(page, "boards");
	await page.getByTestId("remove-board").click();
}
