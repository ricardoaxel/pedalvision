import { expect, type Page, test } from "@playwright/test";
import { waitForSavedScene } from "./persistence.ts";
import { addBoard, addPedal, openPicker } from "./picker.ts";
import { shareHash } from "./share.ts";
import { firstItemScreenCentre } from "./stage.ts";

const CHOKA = "tc-electronic-choka-tremolo";
const CHOKA_CM = { widthCm: 7.4, heightCm: 13.2 };
const PX_PER_CM = 4;

async function expandDetails(page: Page): Promise<void> {
	const expand = page.getByTestId("info-expand");
	if (await expand.isVisible()) await expand.click();
}

async function placeChoka(page: Page, onBoard = false): Promise<void> {
	await page.goto("/");
	if (onBoard) await addBoard(page, "boss-bcb-1000");
	await addPedal(page, CHOKA);
	await expandDetails(page);
	await expect(page.getByTestId("info-jacks")).toBeVisible();
}

async function enterProof(page: Page): Promise<void> {
	await page.getByTestId("jack-correct-toggle").click();
	if (await isMobileProof(page)) {
		await expect(page.getByTestId("proof-bar")).toBeVisible();
	} else {
		await expect(page.getByTestId("jack-correct-toggle")).toHaveAttribute(
			"aria-pressed",
			"true",
		);
	}
}

/** Screen point of a debug jack anchor (`item:<uid>:<index>`). */
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

/** The first item's uid from the debug jack anchors. */
async function firstItemUid(page: Page): Promise<string> {
	const anchors =
		(await page.getByTestId("stage").getAttribute("data-jack-anchors")) ?? "";
	const match = /item:([^:]+):0@/.exec(anchors);
	if (!match?.[1]) throw new Error("no jacked item");
	return match[1];
}

/** World point → screen point for a loose, unrotated item at (0,0). */
async function worldToScreen(page: Page, xCm: number, yCm: number) {
	const stage = page.getByTestId("stage");
	const box = await stage.boundingBox();
	if (!box) throw new Error("stage has no bounding box");
	const scale = Number(await stage.getAttribute("data-scale")) || 1;
	const vx = Number(await stage.getAttribute("data-x")) || 0;
	const vy = Number(await stage.getAttribute("data-y")) || 0;
	const [ix, iy] = (
		((await stage.getAttribute("data-item-positions")) ?? "").split(";")[0] ??
		""
	)
		.split(",")
		.map(Number);
	return {
		x: box.x + (ix + xCm) * PX_PER_CM * scale + vx,
		y: box.y + (iy + yCm) * PX_PER_CM * scale + vy,
	};
}

async function isMobileProof(page: Page): Promise<boolean> {
	return (await page.getByTestId("proof-bar").count()) > 0;
}

async function openAdjust(page: Page): Promise<void> {
	if (await isMobileProof(page)) {
		await page.getByTestId("proof-jack-chip").click();
		await expect(page.getByTestId("proof-inspector")).toBeVisible();
	}
}

async function expectCorrectedMarker(page: Page): Promise<void> {
	if (await isMobileProof(page)) {
		await expect(page.getByTestId("proof-marker-corrected")).toBeVisible();
	} else {
		await expect(
			page.getByTestId("jack-marker-corrected").first(),
		).toBeVisible();
	}
}

async function expectPositionText(page: Page): Promise<void> {
	if (await isMobileProof(page)) {
		await expect(page.getByTestId("proof-position")).toContainText("cm");
	} else {
		await expect(page.getByTestId("jack-position-1")).toContainText("cm");
	}
}

async function resetSelectedJack(page: Page): Promise<void> {
	if (await isMobileProof(page)) {
		await openAdjust(page);
		await page.getByTestId("proof-reset").click();
	} else {
		await page.getByTestId("jack-reset-1").click();
	}
}

async function dragPin(
	page: Page,
	from: { x: number; y: number },
	to: { x: number; y: number },
): Promise<void> {
	await page.mouse.move(from.x, from.y);
	await page.mouse.down();
	await page.mouse.move(to.x, to.y, { steps: 6 });
	await page.mouse.up();
}

test("drags a jack on the real pedal, persists it, and resets it", async ({
	page,
}) => {
	await placeChoka(page);
	const uid = await firstItemUid(page);
	await enterProof(page);
	if (!(await isMobileProof(page))) {
		await expect(page.getByTestId("jack-proof-hint")).toBeVisible();
	}

	// Drag OUT to the upper face (x 0.5, y 0.18) — no edge constraint.
	const from = await anchorScreenPoint(page, `item:${uid}:1`);
	const to = await worldToScreen(
		page,
		CHOKA_CM.widthCm * 0.5,
		CHOKA_CM.heightCm * 0.18,
	);
	await dragPin(page, from, to);

	await expectPositionText(page);
	await expectCorrectedMarker(page);

	await waitForSavedScene(page, (document) => {
		const item = document.items[0];
		const override = item?.jackOverrides?.[0];
		return (
			override?.jack === 1 &&
			typeof override.x === "number" &&
			Math.abs(override.x - 0.5) < 0.02 &&
			typeof override.y === "number" &&
			Math.abs(override.y - 0.18) < 0.02
		);
	});

	// Reload and re-select: the free position survives.
	await page.reload();
	await expect(page.getByTestId("stage")).toBeVisible();
	const centre = await firstItemScreenCentre(page, CHOKA_CM);
	await page.mouse.click(centre.x, centre.y);
	await expandDetails(page);
	await enterProof(page);
	if (await isMobileProof(page)) {
		// Select the corrected OUT pin on the canvas; the mobile bar follows it.
		const corrected = await worldToScreen(
			page,
			CHOKA_CM.widthCm * 0.5,
			CHOKA_CM.heightCm * 0.18,
		);
		await page.mouse.click(corrected.x, corrected.y);
	} else {
		await page.getByTestId("jack-row-1").click();
	}
	await expectCorrectedMarker(page);
	await expectPositionText(page);
	await resetSelectedJack(page);
	if (await isMobileProof(page)) {
		await expect(page.getByTestId("proof-marker-corrected")).toHaveCount(0);
	} else {
		await expect(page.getByTestId("jack-marker-corrected")).toHaveCount(0);
	}
});

test("proof affordances: desktop hover feedback and mobile stepper/jack list", async ({
	page,
}) => {
	await placeChoka(page);
	const uid = await firstItemUid(page);
	await enterProof(page);
	if (await isMobileProof(page)) {
		await page.getByTestId("proof-next").click();
		await expect(page.getByTestId("proof-position")).not.toBeEmpty();
		await page.getByTestId("proof-jack-chip").click();
		const list = page.getByTestId("proof-jack-list");
		await expect(list).toBeVisible();
		await expect(list.getByRole("button")).toHaveCount(3);
		await list.getByRole("button").nth(2).click();
		await expect(page.getByTestId("proof-jack-chip")).toContainText("Power");
		return;
	}
	const stage = page.getByTestId("stage");
	const from = await anchorScreenPoint(page, `item:${uid}:0`);
	await page.mouse.move(from.x, from.y);
	await expect(stage).toHaveAttribute("data-proof-hover", "true");
	await page.mouse.move(4, 4);
	await expect(stage).toHaveAttribute("data-proof-hover", "false");
	await expect(
		page.locator('[aria-label="Selected pedal actions"]'),
	).toHaveCount(0);
});

test("reset all uses a two-step confirm and keeps the rest of the scene", async ({
	page,
}) => {
	await placeChoka(page);
	const uid = await firstItemUid(page);
	await enterProof(page);
	await dragPin(
		page,
		await anchorScreenPoint(page, `item:${uid}:0`),
		await worldToScreen(page, CHOKA_CM.widthCm * 0.3, CHOKA_CM.heightCm * 0.2),
	);
	await dragPin(
		page,
		await anchorScreenPoint(page, `item:${uid}:1`),
		await worldToScreen(page, CHOKA_CM.widthCm * 0.7, CHOKA_CM.heightCm * 0.8),
	);
	await expectCorrectedMarker(page);
	if (await isMobileProof(page)) await openAdjust(page);
	const resetAll = page.getByTestId(
		(await isMobileProof(page)) ? "proof-reset-all" : "jack-reset-all",
	);
	const confirm = page.getByTestId(
		(await isMobileProof(page))
			? "proof-reset-all-confirm"
			: "jack-reset-all-confirm",
	);
	const cancel = page.getByTestId(
		(await isMobileProof(page))
			? "proof-reset-all-cancel"
			: "jack-reset-all-cancel",
	);
	await resetAll.click();
	await expect(confirm).toBeVisible();
	await cancel.click();
	await expect(confirm).toHaveCount(0);
	await resetAll.click();
	await confirm.click();
	if (await isMobileProof(page)) {
		await expect(page.getByTestId("proof-marker-corrected")).toHaveCount(0);
	} else {
		await expect(page.getByTestId("jack-marker-corrected")).toHaveCount(0);
	}
});

test("a read-only share shows the corrected free position without edit controls", async ({
	page,
}) => {
	const hash = shareHash({
		name: "Corrected share",
		boards: [],
		items: [
			{
				uid: "i1",
				refId: CHOKA,
				kind: "pedal",
				boardUid: null,
				x: 0,
				y: 0,
				rotationDeg: 0,
				z: 0,
				jackOverrides: [{ jack: 1, x: 0.5, y: 0.18 }],
			},
		],
	});
	await page.goto(`/?share=1${hash}`);
	await expect(page.getByTestId("stage")).toBeVisible();
	const centre = await firstItemScreenCentre(page, CHOKA_CM);
	await page.mouse.click(centre.x, centre.y);
	await expandDetails(page);
	await expect(page.getByTestId("info-jacks")).toContainText("Out ·");
	await expect(page.getByTestId("jack-marker-corrected").first()).toBeVisible();
	await expect(page.getByTestId("jack-correct-toggle")).toHaveCount(0);
});

test("custom pedals keep their shared editor (no per-instance correction)", async ({
	page,
}) => {
	await page.goto("/");
	await addBoard(page, "boss-bcb-1000");
	await openPicker(page, "custom");
	await page.getByTestId("custom-name").fill("Shared Jacks");
	await page.getByTestId("custom-width").fill("7");
	await page.getByTestId("custom-depth").fill("12");
	await page.getByTestId("custom-add-jack").click();
	await page.getByTestId("custom-submit").click();
	await expandDetails(page);
	await expect(page.getByTestId("info-jacks")).toContainText(
		"Custom part — jacks are shared by every copy.",
	);
	await expect(page.getByTestId("jack-correct-toggle")).toHaveCount(0);
});
