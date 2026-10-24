import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { sampleBoardColor } from "./board-color.ts";

async function image(
	background: { r: number; g: number; b: number; a: number },
	color: { r: number; g: number; b: number },
): Promise<Buffer> {
	const width = 200;
	const height = 100;
	const data = Buffer.alloc(width * height * 4);
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const i = (y * width + x) * 4;
			const inBoard = x >= 25 && x < 175 && y >= 20 && y < 80;
			data[i] = inBoard ? color.r : background.r;
			data[i + 1] = inBoard ? color.g : background.g;
			data[i + 2] = inBoard ? color.b : background.b;
			data[i + 3] = inBoard ? 255 : background.a;
		}
	}
	return sharp(data, { raw: { width, height, channels: 4 } })
		.png()
		.toBuffer();
}

describe("sampleBoardColor", () => {
	it("samples the median board color from a white-background reference", async () => {
		const result = await sampleBoardColor(
			await image({ r: 255, g: 255, b: 255, a: 255 }, { r: 21, g: 21, b: 21 }),
		);
		expect(result.transparentBackground).toBe(false);
		expect(result.samples).toBeGreaterThan(0);
		expect(result.median.hex).toBe("#151515");
		expect(result.average.hex).toBe("#151515");
	});

	it("samples a transparent cutout without treating alpha-0 as black", async () => {
		const result = await sampleBoardColor(
			await image({ r: 0, g: 0, b: 0, a: 0 }, { r: 55, g: 55, b: 55 }),
		);
		expect(result.transparentBackground).toBe(true);
		expect(result.median.hex).toBe("#373737");
	});

	it("samples a board-only reference whose corners are the board", async () => {
		const result = await sampleBoardColor(
			await image({ r: 21, g: 21, b: 21, a: 255 }, { r: 21, g: 21, b: 21 }),
		);
		expect(result.transparentBackground).toBe(false);
		expect(result.median.hex).toBe("#151515");
	});

	it("rejects a reference with no opaque board pixels", async () => {
		const width = 20;
		const height = 20;
		const data = Buffer.alloc(width * height * 4);
		const png = await sharp(data, {
			raw: { width, height, channels: 4 },
		})
			.png()
			.toBuffer();
		await expect(sampleBoardColor(png)).rejects.toThrow(/no opaque/);
	});
});
