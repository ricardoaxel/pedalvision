import { readFile } from "node:fs/promises";
import sharp, { type OverlayOptions } from "sharp";
import { hashBytes } from "./qa-cache.ts";

/**
 * Contact-sheet helper (P5-02). Vision QA runs on 20–30 thumbnails per call,
 * never per image. The sidecar JSON maps each grid cell back to a catalog id and
 * source hash so reviewer verdicts can be cached deterministically.
 */

export const CONTACT_SHEET_MIN = 20;
export const CONTACT_SHEET_MAX = 30;

export type ContactSheetItem = { id: string; image: string };

export type ContactSheetManifest = {
	version: 1;
	columns: number;
	rows: number;
	cell: number;
	items: Array<{
		id: string;
		image: string;
		row: number;
		column: number;
		sha256: string;
	}>;
};

export type ContactSheet = {
	png: Buffer;
	manifest: ContactSheetManifest;
};

export type ContactSheetOptions = {
	columns?: number;
	cell?: number;
};

export async function buildContactSheet(
	items: ContactSheetItem[],
	options: ContactSheetOptions = {},
): Promise<ContactSheet> {
	if (items.length < CONTACT_SHEET_MIN || items.length > CONTACT_SHEET_MAX) {
		throw new Error(
			`contact sheet needs ${CONTACT_SHEET_MIN}–${CONTACT_SHEET_MAX} images (got ${items.length})`,
		);
	}
	const columns = Math.max(1, options.columns ?? 5);
	const cell = options.cell ?? 240;
	const rows = Math.ceil(items.length / columns);
	const width = columns * cell;
	const height = rows * cell;
	const composites: OverlayOptions[] = [];
	const manifestItems: ContactSheetManifest["items"] = [];

	for (const [index, item] of items.entries()) {
		const row = Math.floor(index / columns);
		const column = index % columns;
		const bytes = await readFile(item.image);
		const thumbnail = await sharp(bytes)
			.resize(cell - 16, cell - 16, { fit: "inside" })
			.png()
			.toBuffer();
		const metadata = await sharp(thumbnail).metadata();
		const left = column * cell + Math.round((cell - (metadata.width ?? 0)) / 2);
		const top = row * cell + Math.round((cell - (metadata.height ?? 0)) / 2);
		composites.push({ input: thumbnail, left, top });
		manifestItems.push({
			id: item.id,
			image: item.image,
			row,
			column,
			sha256: hashBytes(bytes),
		});
	}

	const png = await sharp({
		create: {
			width,
			height,
			channels: 4,
			background: { r: 245, g: 245, b: 245, alpha: 1 },
		},
	})
		.composite(composites)
		.png({ compressionLevel: 9 })
		.toBuffer();

	return {
		png,
		manifest: {
			version: 1,
			columns,
			rows,
			cell,
			items: manifestItems,
		},
	};
}
