import { describe, expect, it } from "vitest";
import { psnrRgba } from "./psnr.ts";

const base = {
	width: 2,
	height: 1,
	channels: 4,
	data: new Uint8Array([10, 20, 30, 255, 40, 50, 60, 255]),
};

describe("psnrRgba", () => {
	it("returns Infinity for identical images", () => {
		expect(psnrRgba(base, { ...base, data: new Uint8Array(base.data) })).toBe(
			Number.POSITIVE_INFINITY,
		);
	});

	it("computes a finite PSNR for a changed image", () => {
		const changed = new Uint8Array(base.data);
		changed[0] = 20;
		const psnr = psnrRgba(base, { ...base, data: changed });
		expect(Number.isFinite(psnr)).toBe(true);
		expect(psnr).toBeGreaterThan(30);
	});

	it("ignores fully transparent pixels", () => {
		const transparent = new Uint8Array(base.data);
		transparent[3] = 0;
		transparent[0] = 255;
		const psnr = psnrRgba(base, { ...base, data: transparent });
		expect(psnr).toBeGreaterThan(30);
	});

	it("fails a fully transparent image instead of passing it", () => {
		const transparent = {
			...base,
			data: new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0]),
		};
		expect(psnrRgba(transparent, transparent)).toBe(Number.NEGATIVE_INFINITY);
	});

	it("throws on a size mismatch", () => {
		expect(() => psnrRgba(base, { ...base, width: 3 })).toThrow(
			/size mismatch/,
		);
	});
});
