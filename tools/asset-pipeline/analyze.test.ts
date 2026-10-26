import { readFileSync } from "node:fs";
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

/** BOSS-style compact: flat top, tapered jack end, vertical body sides. */
async function bossTrapezoid(options?: {
	unevenTop?: boolean;
}): Promise<Buffer> {
	const width = 1000;
	const height = 1000;
	const data = Buffer.alloc(width * height * 4);
	for (let i = 0; i < data.length; i += 4) {
		data[i] = 255;
		data[i + 1] = 255;
		data[i + 2] = 255;
		data[i + 3] = 255;
	}
	for (let y = 150; y < 800; y++) {
		// Taper only the top ~15%; the middle body stays vertical so skew is ~0.
		const t = y < 250 ? (250 - y) / 100 : 0;
		const half = 200 - 50 * t;
		const left = Math.round(500 - half);
		const right = Math.round(500 + half);
		for (let x = left; x < right; x++) {
			const i = (y * width + x) * 4;
			data[i] = 30;
			data[i + 1] = 50;
			data[i + 2] = 70;
		}
	}
	if (options?.unevenTop) {
		// A knob bump raises one end of the top edge (>2% flatness) without
		// changing the body-side slopes: a non-taper perspective signal.
		for (let y = 80; y < 150; y++) {
			for (let x = 400; x < 450; x++) {
				const i = (y * width + x) * 4;
				data[i] = 30;
				data[i + 1] = 50;
				data[i + 2] = 70;
			}
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

	it("accepts a tight transparent cutout whose border is the subject", async () => {
		// The object fills the frame (border = subject) but the image is a
		// transparent PNG with an interior transparent hole (>1% alpha), so the
		// border-uniformity check must not reject it.
		const width = 500;
		const height = 900;
		const data = Buffer.alloc(width * height * 4);
		for (let i = 0; i < data.length; i += 4) {
			data[i] = 30;
			data[i + 1] = 50;
			data[i + 2] = 70;
			data[i + 3] = 255;
		}
		for (let y = 400; y < 500; y++) {
			for (let x = 200; x < 300; x++) {
				data[(y * width + x) * 4 + 3] = 0;
			}
		}
		const png = await sharp(data, {
			raw: { width, height, channels: 4 },
		})
			.png()
			.toBuffer();
		const result = await analyzeImage(png, { kind: "pedal", ...footprint });
		expect(result.verdict).toBe("accept");
		expect(result.aspect.verdict).toBe("pass");
		expect(result.reasons.join(" ")).not.toMatch(/background/);
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
		expect(result.bright?.ratio).toBe(0);
	});

	it("flags bright/white residual and edge fringe on a board", async () => {
		const base = await image({
			width: 1000,
			height: 600,
			rect: { x: 100, y: 80, width: 800, height: 440 },
			background: white,
		});
		const stripe = await sharp({
			create: {
				width: 700,
				height: 20,
				channels: 4,
				background: { r: 255, g: 255, b: 255, alpha: 1 },
			},
		})
			.png()
			.toBuffer();
		const png = await sharp(base)
			.composite([{ input: stripe, left: 150, top: 280 }])
			.png()
			.toBuffer();
		const result = await analyzeImage(png, {
			kind: "board",
			widthCm: 60,
			heightCm: 30,
		});
		expect(result.verdict).toBe("flag");
		expect(result.bright?.ratio).toBeGreaterThan(0.01);
		expect(result.reasons.join(" ")).toMatch(/bright\/white residual/);
	});

	it("accepts a symmetric trapezoid compact enclosure (BOSS shape)", async () => {
		// The row-width ratio is ~21% on this shape, but the top edge is flat and
		// the body sides are vertical: it is an enclosure taper, not perspective.
		const result = await analyzeImage(await bossTrapezoid(), {
			kind: "pedal",
			...footprint,
		});
		expect(result.shapeTaper).toBe(true);
		expect(result.verdict).not.toBe("reject");
		expect(result.reasons.join(" ")).not.toMatch(/reject:perspective/);
		expect(result.reasons.join(" ")).toMatch(/enclosure taper/);
	});

	it("does not reject the committed BOSS compact asset as perspective", async () => {
		const png = readFileSync(
			new URL("./__fixtures__/boss-compact.avif", import.meta.url),
		);
		const result = await analyzeImage(png, { kind: "pedal", ...footprint });
		expect(result.shapeTaper).toBe(true);
		expect(result.reasons.join(" ")).not.toMatch(/reject:perspective/);
	});

	it("still rejects a board trapezoid as perspective", async () => {
		const result = await analyzeImage(await bossTrapezoid(), {
			kind: "board",
			widthCm: 60,
			heightCm: 30,
		});
		expect(result.shapeTaper).toBe(false);
		expect(result.verdict).toBe("reject");
		expect(result.reasons.join(" ")).toMatch(/reject:perspective/);
	});

	it("flags (not rejects) a pedal whose top edge is not flat", async () => {
		const result = await analyzeImage(
			await bossTrapezoid({ unevenTop: true }),
			{ kind: "pedal", ...footprint },
		);
		console.log(
			"DEBUG2",
			JSON.stringify({
				shape: result.shapeTaper,
				rot: result.rotationDeg,
				p: result.perspectiveError,
				reasons: result.reasons,
			}),
		);
		expect(result.shapeTaper).toBe(false);
		expect(result.verdict).toBe("flag");
		expect(result.reasons.join(" ")).toMatch(/flag:possible perspective/);
	});
});
