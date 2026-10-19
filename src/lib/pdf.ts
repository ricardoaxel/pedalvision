/**
 * Minimal single-page PDF writer for the P3-01 export (zero dependencies).
 *
 * The page is sized to the exported content in **centimetres**, and the same
 * high-resolution raster image is embedded as a DCTDecode (JPEG) XObject. This
 * makes the PDF a true-scale, printable counterpart to the PNG without
 * introducing a PDF library.
 */

export interface PdfImageInput {
	/** JPEG bytes (baseline/progressive JPEG is accepted by DCTDecode). */
	jpeg: Uint8Array;
	widthPx: number;
	heightPx: number;
	/** Physical page size in cm (the export bounds, including margin). */
	widthCm: number;
	heightCm: number;
}

/** Points per centimetre (1 in = 72 pt, 1 in = 2.54 cm). */
export function cmToPt(cm: number): number {
	return (cm / 2.54) * 72;
}

function roundPt(value: number): string {
	return (Math.round(value * 1000) / 1000).toString();
}

function concat(chunks: Uint8Array[]): Uint8Array {
	const length = chunks.reduce((total, chunk) => total + chunk.length, 0);
	const result = new Uint8Array(length);
	let offset = 0;
	for (const chunk of chunks) {
		result.set(chunk, offset);
		offset += chunk.length;
	}
	return result;
}

/**
 * Build a single-page PDF that fills the page with `jpeg` at exact physical
 * size. Returns the complete file bytes (header → xref → trailer).
 */
export function buildPdfFromJpeg({
	jpeg,
	widthPx,
	heightPx,
	widthCm,
	heightCm,
}: PdfImageInput): Uint8Array {
	const encoder = new TextEncoder();
	const widthPt = roundPt(Math.max(1, cmToPt(widthCm)));
	const heightPt = roundPt(Math.max(1, cmToPt(heightCm)));

	const content = encoder.encode(
		`q\n${widthPt} 0 0 ${heightPt} 0 0 cm\n/Im0 Do\nQ\n`,
	);

	const objects: Uint8Array[] = [
		encoder.encode("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"),
		encoder.encode(
			"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
		),
		encoder.encode(
			`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${widthPt} ${heightPt}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`,
		),
		concat([
			encoder.encode(
				`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${Math.round(widthPx)} /Height ${Math.round(heightPx)} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
			),
			jpeg,
			encoder.encode("\nendstream\nendobj\n"),
		]),
		concat([
			encoder.encode(`5 0 obj\n<< /Length ${content.length} >>\nstream\n`),
			content,
			encoder.encode("endstream\nendobj\n"),
		]),
	];

	const header = concat([
		encoder.encode("%PDF-1.4\n"),
		// Binary marker comment (a comment, not a text run) — keeps the file
		// unambiguously binary for transport.
		new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]),
	]);
	const chunks: Uint8Array[] = [header];
	const offsets: number[] = [0];
	let length = header.length;

	for (let index = 0; index < objects.length; index++) {
		offsets.push(length);
		chunks.push(objects[index] as Uint8Array);
		length += (objects[index] as Uint8Array).length;
	}

	const xrefOffset = length;
	const xrefRows = offsets.map((offset, index) => {
		if (index === 0) return "0000000000 65535 f \n";
		return `${String(offset).padStart(10, "0")} 00000 n \n`;
	});
	const trailer = encoder.encode(
		`xref\n0 ${objects.length + 1}\n${xrefRows.join("")}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`,
	);
	chunks.push(trailer);

	return concat(chunks);
}
