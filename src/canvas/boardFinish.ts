import type { BoardTexture } from "../lib/boardTexture";
import { BOARD_FINISH, type CanvasTheme } from "../styles/theme";

/**
 * Procedural custom-board finishes (P2-05 "Substrate") for the Konva canvas.
 *
 * Konva can't read CSS variables and we refuse new dependencies/assets, so each
 * pattern is drawn once into a tiny offscreen tile and applied via Konva's
 * `fillPatternImage` (a single GPU fill even on a 2 m board). Tiles are cached
 * per (finish, theme) and rebuilt when the theme changes because the cache key
 * includes the resolved colours. Contrast stays deliberately low (the token
 * values), so a textured board never out-reads the drafting grid or the pedals
 * sitting on top.
 */

const TILE = 24;

const cache = new Map<string, HTMLImageElement | null>();

/** The finish's solid base fill (from the canvas theme map). */
export function finishBaseColor(
	finish: BoardTexture,
	theme: CanvasTheme,
): string {
	return theme[BOARD_FINISH[finish].base];
}

/**
 * A repeating pattern tile for `finish`, or null when the finish has no pattern
 * (matte) or there is no DOM canvas (SSR/unit tests). The returned canvas is
 * cached — callers must not mutate it.
 *
 * The return type is `HTMLImageElement` only because that is the declared type
 * of Konva's `fillPatternImage`; Konva's runtime accepts an `HTMLCanvasElement`
 * too (its docs: "Image, Canvas, or Video element"), so the cast is safe and
 * avoids an async data-URL round-trip.
 */
export function finishPatternTile(
	finish: BoardTexture,
	theme: CanvasTheme,
): HTMLImageElement | null {
	const spec = BOARD_FINISH[finish];
	if (!spec.pattern) return null;
	const base = theme[spec.base];
	const ink = theme[spec.pattern];
	const key = `${finish}|${base}|${ink}`;
	if (cache.has(key)) return cache.get(key) ?? null;

	let tile: HTMLCanvasElement | null = null;
	if (typeof document !== "undefined") {
		const canvas = document.createElement("canvas");
		canvas.width = TILE;
		canvas.height = TILE;
		const ctx = canvas.getContext("2d");
		if (ctx) {
			drawTile(ctx, finish, base, ink);
			tile = canvas;
		}
	}
	cache.set(key, tile as unknown as HTMLImageElement | null);
	return cache.get(key) ?? null;
}

function drawTile(
	ctx: CanvasRenderingContext2D,
	finish: BoardTexture,
	base: string,
	ink: string,
): void {
	ctx.fillStyle = base;
	ctx.fillRect(0, 0, TILE, TILE);
	ctx.fillStyle = ink;
	ctx.strokeStyle = ink;
	ctx.lineWidth = 1;

	if (finish === "brushed") {
		// Fine horizontal hairlines — a brushed-metal sheen.
		for (let y = 1; y < TILE; y += 3) {
			ctx.fillRect(0, y, TILE, 1);
		}
		return;
	}

	if (finish === "wood") {
		// Soft vertical grain strands with a gentle wandering so they don't
		// read as ruled lines.
		for (let x = 3; x < TILE; x += 7) {
			ctx.beginPath();
			for (let y = 0; y <= TILE; y += 3) {
				const wobble = Math.sin((y / TILE) * Math.PI * 2) * 1.2;
				const px = x + wobble;
				if (y === 0) ctx.moveTo(px, y);
				else ctx.lineTo(px, y);
			}
			ctx.stroke();
		}
		return;
	}

	if (finish === "tolex") {
		// A small pebble/vinyl matrix.
		for (let y = 3; y < TILE; y += 6) {
			for (let x = 3; x < TILE; x += 6) {
				ctx.beginPath();
				ctx.arc(x, y, 1.2, 0, Math.PI * 2);
				ctx.fill();
			}
		}
	}
}
