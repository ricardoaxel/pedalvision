import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { RENDITIONS } from "./naming.ts";
import { renderRenditions } from "./render.ts";

const PNG_SIGNATURE = Buffer.from([
	0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

/** A white 100×50 canvas with a red rectangle — a neutral-background cutout. */
async function buildInput(): Promise<Buffer> {
	const width = 100;
	const height = 50;
	const data = Buffer.alloc(width * height * 4);
	for (let i = 0; i < width * height; i++) {
		data[i * 4] = 255;
		data[i * 4 + 1] = 255;
		data[i * 4 + 2] = 255;
		data[i * 4 + 3] = 255;
	}
	for (let y = 5; y <= 45; y++) {
		for (let x = 10; x <= 60; x++) {
			const i = (y * width + x) * 4;
			data[i] = 255;
			data[i + 1] = 0;
			data[i + 2] = 0;
			data[i + 3] = 255;
		}
	}
	return sharp(data, { raw: { width, height, channels: 4 } })
		.png()
		.toBuffer();
}

describe("renderRenditions", () => {
	it("outputs transparent PNGs scaled to each rendition size", async () => {
		const renditions = await renderRenditions(await buildInput(), {
			tolerance: 16,
		});
		for (const size of RENDITIONS) {
			expect(renditions[size].subarray(0, 8)).toEqual(PNG_SIGNATURE);
			const meta = await sharp(renditions[size]).metadata();
			expect(meta.hasAlpha).toBe(true);
			expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBe(size);
		}
	});

	it("is deterministic for identical input", async () => {
		const input = await buildInput();
		const first = await renderRenditions(input);
		const second = await renderRenditions(input);
		for (const size of RENDITIONS) {
			expect(first[size].equals(second[size])).toBe(true);
		}
	});

	it("rejects a frame the background key removes entirely", async () => {
		const width = 20;
		const height = 20;
		const data = Buffer.alloc(width * height * 4, 255);
		const solid = await sharp(data, {
			raw: { width, height, channels: 4 },
		})
			.png()
			.toBuffer();
		await expect(renderRenditions(solid)).rejects.toThrow(
			/background removal left no visible pixels/,
		);
	});
});
