import { describe, expect, it } from "vitest";
import {
	bodyCropBounds,
	isBackground,
	removeBackground,
	sampleBackgroundColor,
	trimBounds,
} from "./pixels.ts";

/** Build a `width × height` RGBA buffer filled with one colour. */
function filled(
	width: number,
	height: number,
	[r, g, b, a]: [number, number, number, number],
): Uint8Array {
	const data = new Uint8Array(width * height * 4);
	for (let i = 0; i < width * height; i++) {
		data[i * 4] = r;
		data[i * 4 + 1] = g;
		data[i * 4 + 2] = b;
		data[i * 4 + 3] = a;
	}
	return data;
}

/** Set one pixel of an RGBA buffer. */
function setPixel(
	data: Uint8Array,
	width: number,
	x: number,
	y: number,
	[r, g, b, a]: [number, number, number, number],
): void {
	const i = (y * width + x) * 4;
	data[i] = r;
	data[i + 1] = g;
	data[i + 2] = b;
	data[i + 3] = a;
}

function alphaAt(
	data: Uint8Array,
	width: number,
	x: number,
	y: number,
): number {
	return data[(y * width + x) * 4 + 3];
}

describe("sampleBackgroundColor", () => {
	it("averages the four corner pixels", () => {
		const data = filled(2, 2, [0, 0, 0, 255]);
		setPixel(data, 2, 0, 0, [10, 20, 30, 255]);
		setPixel(data, 2, 1, 0, [20, 30, 40, 255]);
		setPixel(data, 2, 0, 1, [30, 40, 50, 255]);
		setPixel(data, 2, 1, 1, [40, 50, 60, 255]);
		expect(sampleBackgroundColor(data, 2, 2)).toEqual({
			r: 25,
			g: 35,
			b: 45,
		});
	});

	it("handles a 1×1 image (the same pixel four times)", () => {
		const data = filled(1, 1, [7, 8, 9, 255]);
		expect(sampleBackgroundColor(data, 1, 1)).toEqual({ r: 7, g: 8, b: 9 });
	});
});

describe("isBackground", () => {
	it("is inclusive at the tolerance boundary", () => {
		const bg = { r: 100, g: 100, b: 100 };
		expect(isBackground(110, 100, 100, bg, 10)).toBe(true);
		expect(isBackground(111, 100, 100, bg, 10)).toBe(false);
		expect(isBackground(100, 90, 100, bg, 10)).toBe(true);
		expect(isBackground(100, 89, 100, bg, 10)).toBe(false);
	});
});

describe("removeBackground", () => {
	it("clears the border-connected background only", () => {
		const width = 5;
		const height = 5;
		const data = filled(width, height, [255, 0, 0, 255]);
		// White border ring.
		for (let x = 0; x < width; x++) {
			setPixel(data, width, x, 0, [255, 255, 255, 255]);
			setPixel(data, width, x, height - 1, [255, 255, 255, 255]);
		}
		for (let y = 0; y < height; y++) {
			setPixel(data, width, 0, y, [255, 255, 255, 255]);
			setPixel(data, width, width - 1, y, [255, 255, 255, 255]);
		}
		// An isolated white pixel in the centre, not connected to the border.
		setPixel(data, width, 2, 2, [255, 255, 255, 255]);

		const removed = removeBackground(
			data,
			width,
			height,
			{ r: 255, g: 255, b: 255 },
			0,
		);

		// Only the 16 border pixels are removed (5×5 − 3×3).
		expect(removed).toBe(16);
		expect(alphaAt(data, width, 0, 0)).toBe(0);
		expect(alphaAt(data, width, 4, 4)).toBe(0);
		// The interior white pixel survives — flood fill never reached it.
		expect(alphaAt(data, width, 2, 2)).toBe(255);
		// A red pixel survives and keeps its colour.
		expect(alphaAt(data, width, 1, 1)).toBe(255);
	});

	it("removes nothing when no border pixel matches the background", () => {
		const data = filled(3, 3, [10, 20, 30, 255]);
		const removed = removeBackground(data, 3, 3, { r: 255, g: 255, b: 255 }, 4);
		expect(removed).toBe(0);
	});
});

describe("trimBounds", () => {
	it("returns the bounding box of non-transparent pixels", () => {
		const width = 4;
		const height = 4;
		const data = filled(width, height, [0, 0, 0, 0]);
		setPixel(data, width, 1, 1, [1, 1, 1, 255]);
		setPixel(data, width, 2, 2, [1, 1, 1, 255]);
		expect(trimBounds(data, width, height)).toEqual({
			left: 1,
			top: 1,
			width: 2,
			height: 2,
		});
	});

	it("returns null when everything is transparent", () => {
		const data = filled(3, 3, [0, 0, 0, 0]);
		expect(trimBounds(data, 3, 3)).toBeNull();
	});

	it("honours the alpha threshold", () => {
		const data = filled(2, 2, [0, 0, 0, 0]);
		setPixel(data, 2, 0, 0, [0, 0, 0, 5]);
		setPixel(data, 2, 1, 1, [0, 0, 0, 255]);
		expect(trimBounds(data, 2, 2, 10)).toEqual({
			left: 1,
			top: 1,
			width: 1,
			height: 1,
		});
	});
});

describe("bodyCropBounds", () => {
	it("crops side protrusions to the body width", () => {
		const width = 200;
		const height = 200;
		const data = new Uint8Array(width * height * 4);
		const set = (x: number, y: number) => {
			const i = (y * width + x) * 4;
			data[i] = 240;
			data[i + 1] = 235;
			data[i + 2] = 225;
			data[i + 3] = 255;
		};
		// Body 50..149 × 0..199.
		for (let y = 0; y < height; y++) {
			for (let x = 50; x < 150; x++) set(x, y);
		}
		// Jack barrels protrude 20px on each side around y=90..109.
		for (let y = 90; y < 110; y++) {
			for (let x = 30; x < 50; x++) set(x, y);
			for (let x = 150; x < 170; x++) set(x, y);
		}
		const bounds = trimBounds(data, width, height);
		expect(bounds).toEqual({ left: 30, top: 0, width: 140, height: 200 });
		if (!bounds) throw new Error("missing bounds");
		expect(bodyCropBounds(data, width, bounds)).toEqual({
			left: 50,
			top: 0,
			width: 100,
			height: 200,
		});
	});

	it("returns the original bounds when the body fills them", () => {
		const width = 100;
		const height = 200;
		const data = new Uint8Array(width * height * 4);
		for (let i = 0; i < data.length; i += 4) {
			data[i] = 240;
			data[i + 1] = 235;
			data[i + 2] = 225;
			data[i + 3] = 255;
		}
		const bounds = trimBounds(data, width, height);
		if (!bounds) throw new Error("missing bounds");
		expect(bodyCropBounds(data, width, bounds)).toEqual(bounds);
	});
});
