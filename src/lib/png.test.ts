import { describe, expect, it } from "vitest";
import { addPngDpiChunk, readPngDpi } from "./png";

/** Minimal synthetic PNG: signature + IHDR + IEND (no pixel data). */
function headerOnlyPng(): Uint8Array {
	const signature = new Uint8Array([
		0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
	]);
	const ihdrData = new Uint8Array(13);
	const ihdr = new Uint8Array(12 + 13);
	const view = new DataView(ihdr.buffer);
	view.setUint32(0, 13);
	ihdr.set(new TextEncoder().encode("IHDR"), 4);
	ihdr.set(ihdrData, 8);
	const iend = new Uint8Array(12);
	new DataView(iend.buffer).setUint32(0, 0);
	iend.set(new TextEncoder().encode("IEND"), 4);
	const result = new Uint8Array(signature.length + ihdr.length + iend.length);
	result.set(signature, 0);
	result.set(ihdr, signature.length);
	result.set(iend, signature.length + ihdr.length);
	return result;
}

describe("addPngDpiChunk", () => {
	it("inserts a pHYs chunk after IHDR", () => {
		const png = addPngDpiChunk(headerOnlyPng(), 81);
		expect(new TextDecoder().decode(png.subarray(37, 41))).toBe("pHYs");
		expect(readPngDpi(png)).toBe(81);
	});

	it("writes a well-formed 21-byte chunk after IHDR", () => {
		const base = headerOnlyPng();
		const png = addPngDpiChunk(base, 81);
		expect(png.length - base.length).toBe(21);
		const view = new DataView(png.buffer);
		expect(view.getUint32(33)).toBe(9);
		expect(new TextDecoder().decode(png.subarray(37, 41))).toBe("pHYs");
	});

	it("matches a known CRC vector for 81 PPI", () => {
		const png = addPngDpiChunk(headerOnlyPng(), 81);
		const view = new DataView(png.buffer);
		// pHYs(81): x=y=3189 px/m, unit=1 -> CRC32 0x2d789475.
		expect(view.getUint32(50)).toBe(0x2d789475);
	});

	it("rounds PPI to the PNG metre unit", () => {
		expect(readPngDpi(addPngDpiChunk(headerOnlyPng(), 300))).toBe(300);
	});

	it("rejects a non-PNG buffer", () => {
		expect(() => addPngDpiChunk(new Uint8Array([1, 2, 3]), 81)).toThrow();
	});
});
