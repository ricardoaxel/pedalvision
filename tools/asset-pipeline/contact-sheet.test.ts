import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	buildContactSheet,
	CONTACT_SHEET_MAX,
	type ContactSheetItem,
} from "./contact-sheet.ts";

let dir: string;
let items: ContactSheetItem[];

beforeAll(async () => {
	dir = await mkdtemp(join(tmpdir(), "pedalvision-sheet-"));
	items = [];
	for (let index = 0; index < 20; index++) {
		const path = join(dir, `image-${index}.png`);
		await sharp({
			create: {
				width: 40,
				height: 40,
				channels: 4,
				background: { r: index * 10, g: 80, b: 120, alpha: 1 },
			},
		})
			.png()
			.toFile(path);
		items.push({ id: `item-${index}`, image: path });
	}
});

afterAll(async () => {
	await rm(dir, { recursive: true, force: true });
});

describe("contact sheet", () => {
	it("builds a grid and maps every cell back to its id/hash", async () => {
		const sheet = await buildContactSheet(items, { columns: 5, cell: 120 });
		expect(sheet.manifest.rows).toBe(4);
		expect(sheet.manifest.items).toHaveLength(20);
		expect(sheet.manifest.items[0]).toMatchObject({
			id: "item-0",
			row: 0,
			column: 0,
		});
		expect(sheet.manifest.items[5]).toMatchObject({ row: 1, column: 0 });
		expect(
			sheet.manifest.items.every((item) => item.sha256.length === 64),
		).toBe(true);
		const metadata = await sharp(sheet.png).metadata();
		expect(metadata.width).toBe(600);
		expect(metadata.height).toBe(480);
	});

	it("refuses a sheet outside 10–30 images", async () => {
		await expect(buildContactSheet(items.slice(0, 9))).rejects.toThrow(
			/10–30 images/,
		);
		await expect(
			buildContactSheet([
				...items,
				...items,
				items[0] as ContactSheetItem,
				items[1] as ContactSheetItem,
				items[2] as ContactSheetItem,
				items[3] as ContactSheetItem,
				items[4] as ContactSheetItem,
				items[5] as ContactSheetItem,
				items[6] as ContactSheetItem,
				items[7] as ContactSheetItem,
				items[8] as ContactSheetItem,
				items[9] as ContactSheetItem,
			]),
		).rejects.toThrow(new RegExp(String(CONTACT_SHEET_MAX)));
	});
});
