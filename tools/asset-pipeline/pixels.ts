/**
 * Pure pixel math for the asset pipeline — no filesystem, no sharp. The CLI
 * (`index.ts`) converts an input image to raw RGBA (sharp) and hands the buffer
 * here; keeping this module IO-free is what makes it unit-testable on tiny
 * synthetic buffers.
 *
 * "Background removal" is a deterministic **corner key**: the four corner pixels
 * are averaged to a background colour, then a flood fill from the image borders
 * turns every border-connected pixel within `tolerance` fully transparent. A flood
 * fill (rather than a whole-image threshold) means an interior pixel that happens
 * to match the background is *kept* — so white/neutral details inside the subject
 * survive.
 */

export type BackgroundColor = { r: number; g: number; b: number };

export type Bounds = {
	left: number;
	top: number;
	width: number;
	height: number;
};

/** Channels per pixel of the raw RGBA buffers this module operates on. */
const CHANNELS = 4;

/**
 * Average the four corner pixels into a background colour (rounded). Works for
 * any buffer with `width`/`height` of at least 1.
 */
export function sampleBackgroundColor(
	data: Uint8Array,
	width: number,
	height: number,
): BackgroundColor {
	const corners = [
		[0, 0],
		[width - 1, 0],
		[0, height - 1],
		[width - 1, height - 1],
	] as const;
	let r = 0;
	let g = 0;
	let b = 0;
	for (const [x, y] of corners) {
		const i = (y * width + x) * CHANNELS;
		r += data[i];
		g += data[i + 1];
		b += data[i + 2];
	}
	const n = corners.length;
	return { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) };
}

/** Whether an RGB pixel is within `tolerance` (per channel) of `background`. */
export function isBackground(
	r: number,
	g: number,
	b: number,
	background: BackgroundColor,
	tolerance: number,
): boolean {
	return (
		Math.abs(r - background.r) <= tolerance &&
		Math.abs(g - background.g) <= tolerance &&
		Math.abs(b - background.b) <= tolerance
	);
}

/**
 * Flood-fill background removal: starting from every border pixel that matches
 * `background` within `tolerance`, turn all 4-connected matching pixels
 * transparent (alpha 0) in place. Returns the number of pixels made transparent.
 */
export function removeBackground(
	data: Uint8Array,
	width: number,
	height: number,
	background: BackgroundColor,
	tolerance: number,
): number {
	const visited = new Uint8Array(width * height);
	// Each pixel is enqueued at most once (guarded by `visited`), so the pixel
	// count is a safe upper bound — a typed queue avoids unbounded `number[]`.
	const queue = new Uint32Array(width * height);
	let tail = 0;

	const matches = (x: number, y: number): boolean => {
		const p = y * width + x;
		if (visited[p]) return false;
		const i = p * CHANNELS;
		return isBackground(
			data[i],
			data[i + 1],
			data[i + 2],
			background,
			tolerance,
		);
	};

	const push = (x: number, y: number): void => {
		if (x < 0 || y < 0 || x >= width || y >= height) return;
		if (!matches(x, y)) return;
		const p = y * width + x;
		visited[p] = 1;
		queue[tail++] = p;
	};

	for (let x = 0; x < width; x++) {
		push(x, 0);
		push(x, height - 1);
	}
	for (let y = 0; y < height; y++) {
		push(0, y);
		push(width - 1, y);
	}

	let removed = 0;
	for (let head = 0; head < tail; head++) {
		const p = queue[head];
		const x = p % width;
		const y = (p - x) / width;
		data[p * CHANNELS + 3] = 0;
		removed++;
		push(x + 1, y);
		push(x - 1, y);
		push(x, y + 1);
		push(x, y - 1);
	}
	return removed;
}

/**
 * Bounding box of the non-transparent pixels (alpha > `alphaThreshold`). Returns
 * `null` when every pixel is transparent (nothing to trim to).
 */
export function trimBounds(
	data: Uint8Array,
	width: number,
	height: number,
	alphaThreshold = 0,
): Bounds | null {
	let left = width;
	let top = height;
	let right = -1;
	let bottom = -1;

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			if (data[(y * width + x) * CHANNELS + 3] <= alphaThreshold) continue;
			if (x < left) left = x;
			if (x > right) right = x;
			if (y < top) top = y;
			if (y > bottom) bottom = y;
		}
	}

	if (right < left || bottom < top) return null;
	return { left, top, width: right - left + 1, height: bottom - top + 1 };
}
