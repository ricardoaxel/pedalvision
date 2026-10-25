/**
 * AVIF quality gate helper (P5 guardrail, 2026-10-25). Compares an encoded
 * AVIF against the pre-encode PNG cutout on RGB where alpha > 0. PSNR >= 40 dB
 * is the policy floor; if it fails, re-encode at q90/q100 or keep PNG.
 */

export type Rgba = {
	data: Uint8Array | Buffer;
	width: number;
	height: number;
	channels: number;
};

export function psnrRgba(a: Rgba, b: Rgba): number {
	if (a.width !== b.width || a.height !== b.height) {
		throw new Error(
			`size mismatch: ${a.width}x${a.height} vs ${b.width}x${b.height}`,
		);
	}
	if (a.channels !== 4 || b.channels !== 4) {
		throw new Error("PSNR needs RGBA buffers");
	}
	let sum = 0;
	let samples = 0;
	for (let i = 0; i < a.data.length; i += 4) {
		if ((a.data[i + 3] ?? 0) === 0 || (b.data[i + 3] ?? 0) === 0) continue;
		for (let c = 0; c < 3; c++) {
			const diff = (a.data[i + c] ?? 0) - (b.data[i + c] ?? 0);
			sum += diff * diff;
			samples += 1;
		}
	}
	if (samples === 0) return Number.POSITIVE_INFINITY;
	const mse = sum / samples;
	return mse === 0
		? Number.POSITIVE_INFINITY
		: 10 * Math.log10((255 * 255) / mse);
}
