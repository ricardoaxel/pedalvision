import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { afterEach, describe, expect, it } from "vitest";
import { renderBoardArt } from "./board-art.ts";

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="408" viewBox="0 0 800 408"><title>Test board</title><rect width="800" height="408" rx="6" fill="#151515"/><rect x="40" y="80" width="720" height="60" rx="20" fill="#373737"/></svg>`;

const PNG_SIGNATURE = Buffer.from([
	0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

function isAvif(buffer: Buffer): boolean {
	return (
		buffer.subarray(4, 8).toString("ascii") === "ftyp" &&
		buffer.subarray(8, 12).toString("ascii") === "avif"
	);
}

const dirs: string[] = [];

afterEach(async () => {
	await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true })));
});

describe("renderBoardArt", () => {
	it("writes a PNG reference plus 800/350 AVIF renditions", async () => {
		const dir = await mkdtemp(join(tmpdir(), "board-art-"));
		dirs.push(dir);
		const result = await renderBoardArt(Buffer.from(SVG), "test-board", {
			assetsDir: dir,
			pngPath: join(dir, "reference.png"),
		});

		expect(result.pngPath).toBe(join(dir, "reference.png"));
		expect((await readFile(result.pngPath)).subarray(0, 8)).toEqual(
			PNG_SIGNATURE,
		);

		expect(result.renditions.map((rendition) => rendition.size)).toEqual([
			800, 350,
		]);
		for (const rendition of result.renditions) {
			const buffer = await readFile(rendition.path);
			expect(isAvif(buffer)).toBe(true);
			const meta = await sharp(buffer).metadata();
			expect(meta.hasAlpha).toBe(true);
			expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBe(rendition.size);
			expect(rendition.bytes).toBe(buffer.length);
		}
	});

	it("rejects unsafe ids", async () => {
		await expect(renderBoardArt(Buffer.from(SVG), "../bad")).rejects.toThrow(
			/safe image filename/,
		);
	});
});
