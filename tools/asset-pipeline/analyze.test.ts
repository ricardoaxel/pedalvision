import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { analyzeImage } from "./analyze.ts";

type ImageOptions = {
	width: number;
	height: number;
	rect: { x: number; y: number; width: number; height: number };
	background: { r: number; g: number; b: number; a: number };
	busy?: boolean;
};

async function image(options: ImageOptions): Promise<Buffer> {
	const { width, height, rect, background, busy } = options;
	const data = Buffer.alloc(width * height * 4);
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const i = (y * width + x) * 4;
			if (busy) {
				data[i] = (x * 37 + y * 17) % 256;
				data[i + 1] = (x * 11 + y * 53) % 256;
				data[i + 2] = (x * 71 + y * 7) % 256;
				data[i + 3] = 255;
			} else {
				data[i] = background.r;
				data[i + 1] = background.g;
				data[i + 2] = background.b;
				data[i + 3] = background.a;
			}
		}
	}
	for (let y = rect.y; y < rect.y + rect.height; y++) {
		for (let x = rect.x; x < rect.x + rect.width; x++) {
			const i = (y * width + x) * 4;
			data[i] = 30;
			data[i + 1] = 50;
			data[i + 2] = 70;
			data[i + 3] = 255;
		}
	}
	return sharp(data, { raw: { width, height, channels: 4 } })
		.png()
		.toBuffer();
}

const footprint = { widthCm: 7.3, heightCm: 12.9 };
const white = { r: 255, g: 255, b: 255, a: 255 };
const transparent = { r: 0, g: 0, b: 0, a: 0 };

describe("image analyzer", () => {
	it("accepts a top-down cutout on a white background", async () => {
		const result = await analyzeImage(
			await image({
				width: 1000,
				height: 1000,
				rect: { x: 300, y: 150, width: 400, height: 700 },
				background: white,
			}),
			{ kind: "pedal", ...footprint },
		);
		expect(result.verdict).toBe("accept");
		expect(result.aspect.verdict).toBe("pass");
		expect(result.trim?.width).toBe(400);
		expect(result.trim?.height).toBe(700);
	});

	it("accepts a transparent cutout with no background removal", async () => {
		const result = await analyzeImage(
			await image({
				width: 1000,
				height: 1000,
				rect: { x: 300, y: 150, width: 400, height: 700 },
				background: transparent,
			}),
			{ kind: "pedal", ...footprint },
		);
		expect(result.verdict).toBe("accept");
		expect(result.alpha.transparentRatio).toBeGreaterThan(0.7);
	});

	it("rejects a busy background", async () => {
		const result = await analyzeImage(
			await image({
				width: 1000,
				height: 1000,
				rect: { x: 300, y: 150, width: 400, height: 700 },
				background: white,
				busy: true,
			}),
			{ kind: "pedal", ...footprint },
		);
		expect(result.verdict).toBe("reject");
		expect(result.reasons.join(" ")).toMatch(/background/);
	});

	it("rejects an image below 800px long edge", async () => {
		const result = await analyzeImage(
			await image({
				width: 400,
				height: 700,
				rect: { x: 60, y: 50, width: 280, height: 600 },
				background: white,
			}),
			{ kind: "pedal", ...footprint },
		);
		expect(result.verdict).toBe("reject");
		expect(result.reasons.join(" ")).toMatch(/long edge/);
	});

	it("rejects an aspect ratio more than 15% off the cm footprint", async () => {
		const result = await analyzeImage(
			await image({
				width: 1200,
				height: 400,
				rect: { x: 100, y: 50, width: 1000, height: 300 },
				background: white,
			}),
			{ kind: "pedal", ...footprint },
		);
		expect(result.verdict).toBe("reject");
		expect(result.aspect.verdict).toBe("reject");
	});

	it("flags a board for the contact-sheet top-down/empty check", async () => {
		const result = await analyzeImage(
			await image({
				width: 1000,
				height: 600,
				rect: { x: 100, y: 80, width: 800, height: 440 },
				background: white,
			}),
			{ kind: "board", widthCm: 60, heightCm: 30 },
		);
		expect(result.verdict).toBe("flag");
		expect(result.reasons.join(" ")).toMatch(/contact-sheet/);
	});
});
