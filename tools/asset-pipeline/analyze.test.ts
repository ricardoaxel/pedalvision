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

/** A product card: transparent margin, an opaque white card, a dark pedal and a
 * bottom caption — the failure mode the reviewer/analyzer must catch. */
async function cardImage(): Promise<Buffer> {
	const width = 1000;
	const height = 1000;
	const data = Buffer.alloc(width * height * 4);
	for (let i = 0; i < data.length; i += 4) data[i + 3] = 0;
	// A card that touches the frame on three sides (transparent top margin), like
	// the official gallery cards that left a caption band behind.
	for (let y = 50; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const i = (y * width + x) * 4;
			data[i] = 238;
			data[i + 1] = 238;
			data[i + 2] = 238;
			data[i + 3] = 255;
		}
	}
	for (let y = 110; y < 860; y++) {
		for (let x = 100; x < 900; x++) {
			const i = (y * width + x) * 4;
			data[i] = 30;
			data[i + 1] = 50;
			data[i + 2] = 70;
			data[i + 3] = 255;
		}
	}
	// Caption glyphs in the card's bottom band.
	for (let g = 0; g < 10; g++) {
		for (let y = 920; y < 940; y++) {
			for (let x = 300 + g * 30; x < 310 + g * 30; x++) {
				const i = (y * width + x) * 4;
				data[i] = 20;
				data[i + 1] = 20;
				data[i + 2] = 20;
				data[i + 3] = 255;
			}
		}
	}
	return sharp(data, { raw: { width, height, channels: 4 } })
		.png()
		.toBuffer();
}

/** A gallery card with a transparent margin and the correct footprint aspect:
 * the card is the opaque content, the pedal is dark, and a caption sits at the
 * bottom. The opaque-bounds frame must catch it without the outer image frame. */
async function marginCard(): Promise<Buffer> {
	const width = 730;
	const height = 1290;
	const data = Buffer.alloc(width * height * 4);
	for (let y = 20; y < 1270; y++) {
		for (let x = 20; x < 710; x++) {
			const i = (y * width + x) * 4;
			data[i] = 238;
			data[i + 1] = 238;
			data[i + 2] = 238;
			data[i + 3] = 255;
		}
	}
	for (let y = 100; y < 900; y++) {
		for (let x = 80; x < 650; x++) {
			const i = (y * width + x) * 4;
			data[i] = 30;
			data[i + 1] = 50;
			data[i + 2] = 70;
			data[i + 3] = 255;
		}
	}
	for (let g = 0; g < 10; g++) {
		for (let y = 1100; y < 1130; y++) {
			for (let x = 150 + g * 35; x < 165 + g * 35; x++) {
				const i = (y * width + x) * 4;
				data[i] = 20;
				data[i + 1] = 20;
				data[i + 2] = 20;
				data[i + 3] = 255;
			}
		}
	}
	return sharp(data, { raw: { width, height, channels: 4 } })
		.png()
		.toBuffer();
}

/** A full-bleed bright cream cutout (no card, one interior hole): the same
 * frame/interior tone must not be mistaken for a background card. */
async function fullBleedBrightCutout(): Promise<Buffer> {
	const width = 730;
	const height = 1290;
	const data = Buffer.alloc(width * height * 4);
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const i = (y * width + x) * 4;
			data[i] = 215;
			data[i + 1] = 210;
			data[i + 2] = 184;
			data[i + 3] = 255;
		}
	}
	for (let y = 600; y < 700; y++) {
		for (let x = 315; x < 415; x++) {
			data[(y * width + x) * 4 + 3] = 0;
		}
	}
	return sharp(data, { raw: { width, height, channels: 4 } })
		.png()
		.toBuffer();
}

/** A bright pedal on a bright card with a caption: frameCard is false, but the
 * caption band + spatial card signals must flag it. */
async function brightPedalCaptionCard(): Promise<Buffer> {
	const width = 730;
	const height = 1290;
	const data = Buffer.alloc(width * height * 4);
	for (let y = 20; y < 1270; y++) {
		for (let x = 20; x < 710; x++) {
			const i = (y * width + x) * 4;
			data[i] = 238;
			data[i + 1] = 238;
			data[i + 2] = 238;
			data[i + 3] = 255;
		}
	}
	for (let y = 100; y < 1150; y++) {
		for (let x = 80; x < 650; x++) {
			const i = (y * width + x) * 4;
			data[i] = 215;
			data[i + 1] = 210;
			data[i + 2] = 184;
			data[i + 3] = 255;
		}
	}
	for (let g = 0; g < 10; g++) {
		for (let y = 1190; y < 1220; y++) {
			for (let x = 150 + g * 35; x < 165 + g * 35; x++) {
				const i = (y * width + x) * 4;
				data[i] = 20;
				data[i + 1] = 20;
				data[i + 2] = 20;
				data[i + 3] = 255;
			}
		}
	}
	return sharp(data, { raw: { width, height, channels: 4 } })
		.png()
		.toBuffer();
}

/** A bright silver pedal body with printed text: a caption-like band on the
 * product itself must NOT be mistaken for a card. */
async function printedLogoBrightPedal(): Promise<Buffer> {
	const width = 730;
	const height = 1290;
	const data = Buffer.alloc(width * height * 4);
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const i = (y * width + x) * 4;
			data[i] = 216;
			data[i + 1] = 215;
			data[i + 2] = 218;
			data[i + 3] = 255;
		}
	}
	for (let g = 0; g < 8; g++) {
		for (let y = 1000; y < 1030; y++) {
			for (let x = 200 + g * 25; x < 215 + g * 25; x++) {
				const i = (y * width + x) * 4;
				data[i] = 20;
				data[i + 1] = 20;
				data[i + 2] = 20;
				data[i + 3] = 255;
			}
		}
	}
	return sharp(data, { raw: { width, height, channels: 4 } })
		.png()
		.toBuffer();
}

/** A transparent cutout with a bright cream body (planner-style tight crop):
 * the product touches the top/bottom, the margins stay transparent. */
async function brightCutout(): Promise<Buffer> {
	const width = 1000;
	const height = 1000;
	const data = Buffer.alloc(width * height * 4);
	for (let y = 0; y < height; y++) {
		for (let x = 217; x < 783; x++) {
			const i = (y * width + x) * 4;
			data[i] = 215;
			data[i + 1] = 210;
			data[i + 2] = 184;
			data[i + 3] = 255;
		}
	}
	return sharp(data, { raw: { width, height, channels: 4 } })
		.png()
		.toBuffer();
}

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
		expect(result.backgroundCard?.suspected).toBe(false);
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
		expect(result.shapeTaper).toBe(false);
		expect(result.verdict).toBe("flag");
		expect(result.reasons.join(" ")).toMatch(/flag:possible perspective/);
	});
	it("does not mistake a bright transparent cutout for a background card", async () => {
		const result = await analyzeImage(await brightCutout(), {
			kind: "pedal",
			...footprint,
		});
		expect(result.backgroundCard?.suspected).toBe(false);
		expect(result.reasons.join(" ")).not.toMatch(/background card/);
	});

	it("flags a margin card with the correct footprint aspect", async () => {
		const result = await analyzeImage(await marginCard(), {
			kind: "pedal",
			...footprint,
		});
		expect(result.backgroundCard?.suspected).toBe(true);
		expect(result.reasons.join(" ")).toMatch(/background card/);
	});

	it("does not flag a full-bleed bright cutout", async () => {
		const result = await analyzeImage(await fullBleedBrightCutout(), {
			kind: "pedal",
			...footprint,
		});
		expect(result.backgroundCard?.suspected).toBe(false);
	});

	it("flags a bright pedal with a caption band", async () => {
		const result = await analyzeImage(await brightPedalCaptionCard(), {
			kind: "pedal",
			...footprint,
		});
		expect(result.backgroundCard?.captionBand).toBe(true);
		expect(result.backgroundCard?.suspected).toBe(true);
	});

	it("does not flag printed text on a bright pedal body", async () => {
		const result = await analyzeImage(await printedLogoBrightPedal(), {
			kind: "pedal",
			...footprint,
		});
		expect(result.backgroundCard?.captionBand).toBe(false);
		expect(result.backgroundCard?.suspected).toBe(false);
	});

	it("does not apply the photo card flag to planner/generated cutouts", async () => {
		const result = await analyzeImage(await cardImage(), {
			kind: "pedal",
			...footprint,
			sourceKind: "planner",
		});
		expect(result.backgroundCard).toBeNull();
		const generated = await analyzeImage(await cardImage(), {
			kind: "pedal",
			...footprint,
			sourceKind: "generated",
		});
		expect(generated.backgroundCard).toBeNull();
	});

	it("flags a product card/caption instead of passing it", async () => {
		const result = await analyzeImage(await cardImage(), {
			kind: "pedal",
			...footprint,
		});
		expect(result.backgroundCard?.suspected).toBe(true);
		expect(
			result.reasons.some((reason) =>
				reason.includes("possible background card/caption"),
			),
		).toBe(true);
	});
});
