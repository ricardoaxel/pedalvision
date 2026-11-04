/**
 * Minimal PNG DPI metadata writer (Q-02, zero dependencies).
 *
 * Canvas PNGs have no physical-density chunk, so a print dialog has to guess
 * 72/96 PPI. Inserting a standard `pHYs` chunk after `IHDR` tells apps that
 * honour PNG density what the plan's intended PPI is. The pixel data is
 * untouched; the file remains a normal PNG.
 */

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const CRC_TABLE = (() => {
	const table = new Uint32Array(256);
	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) {
			c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		}
		table[n] = c >>> 0;
	}
	return table;
})();

function crc32(bytes: Uint8Array): number {
	let crc = 0xffffffff;
	for (const byte of bytes) {
		crc = (CRC_TABLE[(crc ^ byte) & 0xff] as number) ^ (crc >>> 8);
	}
	return (crc ^ 0xffffffff) >>> 0;
}

function writeUint32(value: number): Uint8Array {
	const bytes = new Uint8Array(4);
	new DataView(bytes.buffer).setUint32(0, value >>> 0);
	return bytes;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
	const typeBytes = new TextEncoder().encode(type);
	const body = new Uint8Array(typeBytes.length + data.length);
	body.set(typeBytes, 0);
	body.set(data, typeBytes.length);
	const result = new Uint8Array(4 + body.length + 4);
	result.set(writeUint32(data.length), 0);
	result.set(body, 4);
	result.set(writeUint32(crc32(body)), 4 + body.length);
	return result;
}

/** Read the pixel density from a PNG's `pHYs` chunk, or null. */
export function readPngDpi(bytes: Uint8Array): number | null {
	let offset = 8;
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	while (offset + 12 <= bytes.length) {
		const length = view.getUint32(offset);
		const type = new TextDecoder().decode(
			bytes.subarray(offset + 4, offset + 8),
		);
		if (type === "pHYs" && length >= 9) {
			const x = view.getUint32(offset + 8);
			const unit = bytes[offset + 16];
			if (unit !== 1) return null;
			return Math.round(x * 0.0254);
		}
		if (type === "IEND") break;
		offset += 12 + length;
	}
	return null;
}

/** Return a copy of a PNG with a `pHYs` chunk (pixels per metre) after IHDR. */
export function addPngDpiChunk(bytes: Uint8Array, ppi: number): Uint8Array {
	const matches = PNG_SIGNATURE.every((byte, index) => bytes[index] === byte);
	if (!matches) throw new Error("Not a PNG");
	const ihdrLength =
		(new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(
			8,
		) as number) + 12;
	const insertAt = 8 + ihdrLength;
	const pixelsPerMetre = Math.max(1, Math.round(ppi / 0.0254));
	const data = new Uint8Array(9);
	const view = new DataView(data.buffer);
	view.setUint32(0, pixelsPerMetre);
	view.setUint32(4, pixelsPerMetre);
	data[8] = 1; // unit: metre
	const phys = chunk("pHYs", data);
	const result = new Uint8Array(bytes.length + phys.length);
	result.set(bytes.subarray(0, insertAt), 0);
	result.set(phys, insertAt);
	result.set(bytes.subarray(insertAt), insertAt + phys.length);
	return result;
}
