import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { RENDITIONS } from "./naming.ts";
import { renderRenditions } from "./render.ts";

const PNG_SIGNATURE = Buffer.from([
	0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

/** ISO BMFF: bytes 4–7 are `ftyp`, the brand at 8–11 is `avif`. */
function isAvif(buffer: Buffer): boolean {
	return (
		buffer.subarray(4, 8).toString("ascii") === "ftyp" &&
		buffer.subarray(8, 12).toString("ascii") === "avif"
	);
}

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

	it("outputs AVIF renditions with alpha when requested", async () => {
		const renditions = await renderRenditions(await buildInput(), {
			tolerance: 16,
			format: "avif",
		});
		for (const size of RENDITIONS) {
			expect(isAvif(renditions[size])).toBe(true);
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

	it("supports the dev-only soft matte fallback", async () => {
		const width = 400;
		const height = 400;
		const data = Buffer.alloc(width * height * 4);
		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				const i = (y * width + x) * 4;
				const shade = 220 + Math.round((x / width) * 35);
				data[i] = shade;
				data[i + 1] = shade;
				data[i + 2] = shade;
				data[i + 3] = 255;
			}
		}
		for (let y = 100; y < 300; y++) {
			for (let x = 120; x < 280; x++) {
				const i = (y * width + x) * 4;
				data[i] = 20;
				data[i + 1] = 40;
				data[i + 2] = 60;
			}
		}
		const input = await sharp(data, { raw: { width, height, channels: 4 } })
			.png()
			.toBuffer();
		const soft = await renderRenditions(input, { matte: "soft" });
		const hard = await renderRenditions(input, { matte: "flood" });
		for (const size of RENDITIONS) {
			expect(soft[size].subarray(0, 8)).toEqual(PNG_SIGNATURE);
			expect(hard[size].subarray(0, 8)).toEqual(PNG_SIGNATURE);
		}
	});
	it("auto-orients from EXIF (a rotated phone photo stays upright)", async () => {
		// A landscape 100×50 subject tagged orientation 6 (rotate 90° CW).
		const width = 100;
		const height = 50;
		const data = Buffer.alloc(width * height * 4, 255);
		for (let y = 5; y < 45; y++) {
			for (let x = 10; x < 60; x++) {
				const i = (y * width + x) * 4;
				data[i] = 200;
				data[i + 1] = 30;
				data[i + 2] = 30;
			}
		}
		const jpeg = await sharp(data, { raw: { width, height, channels: 4 } })
			.jpeg()
			.withMetadata({ orientation: 6 })
			.toBuffer();
		expect((await sharp(jpeg).metadata()).orientation).toBe(6);

		const renditions = await renderRenditions(jpeg, { tolerance: 16 });
		const meta = await sharp(renditions[800]).metadata();
		// Orientation 6 means the 100×50 frame displays as 50×100 → portrait.
		expect(meta.height ?? 0).toBeGreaterThan(meta.width ?? 0);
	});
});
