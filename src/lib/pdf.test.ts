import { describe, expect, it } from "vitest";
import { buildPdfFromJpeg, cmToPt } from "./pdf";

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0xff, 0xd9]);

describe("buildPdfFromJpeg", () => {
	it("wraps an image in a one-page PDF with an exact cm page size", () => {
		const bytes = buildPdfFromJpeg({
			jpeg: JPEG,
			widthPx: 2000,
			heightPx: 1000,
			widthCm: 63.88,
			heightCm: 43.23,
		});
		const text = Buffer.from(bytes).toString("latin1");

		expect(text.startsWith("%PDF-1.4\n")).toBe(true);
		expect(text).toContain("/Type /Catalog");
		expect(text).toContain("/Count 1");
		expect(text).toContain("/Subtype /Image");
		expect(text).toContain("/Filter /DCTDecode");
		expect(text).toContain("/Width 2000 /Height 1000");
		expect(text).toContain(
			`/MediaBox [0 0 ${cmToPt(63.88).toFixed(3)} ${cmToPt(43.23).toFixed(3)}]`,
		);
		expect(text).toContain(
			`q\n${cmToPt(63.88).toFixed(3)} 0 0 ${cmToPt(43.23).toFixed(3)} 0 0 cm\n/Im0 Do\nQ`,
		);
	});

	it("embeds the JPEG bytes verbatim and ends with a valid xref/trailer", () => {
		const bytes = buildPdfFromJpeg({
			jpeg: JPEG,
			widthPx: 2000,
			heightPx: 1000,
			widthCm: 63.88,
			heightCm: 43.23,
		});
		const text = Buffer.from(bytes).toString("latin1");
		const jpegIndex = text.indexOf(Buffer.from(JPEG).toString("latin1"));
		expect(jpegIndex).toBeGreaterThan(0);

		const startxref = Number(text.match(/startxref\n(\d+)/)?.[1]);
		expect(Number.isFinite(startxref)).toBe(true);
		expect(text.slice(startxref, startxref + 4)).toBe("xref");
		expect(text.trimEnd().endsWith("%%EOF")).toBe(true);
	});
});
