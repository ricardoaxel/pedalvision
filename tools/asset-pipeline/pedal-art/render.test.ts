import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { afterEach, describe, expect, it } from "vitest";
import { analyzeImage } from "../analyze.ts";
import { renderPedalArt } from "./render.ts";
import { parsePedalArtSpec } from "./spec.ts";

const DS1 = JSON.parse(
	await readFile(
		new URL("./pilots/boss-ds-1-distortion.json", import.meta.url),
		"utf8",
	),
) as unknown;

const PNG_SIGNATURE = Buffer.from([
	0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

function isAvif(buffer: Buffer): boolean {
	return (
		buffer.subarray(4, 8).toString("ascii") === "ftyp" &&
		buffer.subarray(8, 12).toString("ascii") === "avif"
	);
}

function sha(buffer: Buffer): string {
	return createHash("sha256").update(buffer).digest("hex");
}

const dirs: string[] = [];

afterEach(async () => {
	await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true })));
});

async function render(dir: string) {
	return renderPedalArt(DS1, {
		assetsDir: dir,
		pngPath: join(dir, "reference.png"),
		svgPath: join(dir, "reference.svg"),
	});
}

describe("renderPedalArt", () => {
	it("writes a PNG/SVG reference plus 800/350 AVIF with alpha", async () => {
		const dir = await mkdtemp(join(tmpdir(), "pedal-art-"));
		dirs.push(dir);
		const result = await render(dir);

		expect((await readFile(result.pngPath)).subarray(0, 8)).toEqual(
			PNG_SIGNATURE,
		);
		expect(await readFile(result.svgPath, "utf8")).toContain("<svg");

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

	it("is deterministic across runs", async () => {
		const first = await mkdtemp(join(tmpdir(), "pedal-art-a-"));
		const second = await mkdtemp(join(tmpdir(), "pedal-art-b-"));
		dirs.push(first, second);
		const one = await render(first);
		const two = await render(second);

		for (const index of [0, 1]) {
			const oneRendition = one.renditions[index];
			const twoRendition = two.renditions[index];
			const oneBytes = await readFile(oneRendition.path);
			const twoBytes = await readFile(twoRendition.path);
			expect(sha(oneBytes)).toBe(sha(twoBytes));
		}
		expect(sha(await readFile(one.pngPath))).toBe(
			sha(await readFile(two.pngPath)),
		);
	});

	it("passes the analyzer on the 800 rendition", async () => {
		const dir = await mkdtemp(join(tmpdir(), "pedal-art-analyze-"));
		dirs.push(dir);
		const result = await render(dir);
		const analysis = await analyzeImage(result.renditions[0].path, {
			kind: "pedal",
			widthCm: 7.3,
			heightCm: 12.9,
		});
		expect(analysis.aspect.verdict).toBe("pass");
		expect(analysis.shadowRatio ?? 0).toBe(0);
		expect(analysis.verdict).not.toBe("reject");
	});

	it("has clean alpha and no cyan accent pixels", async () => {
		const dir = await mkdtemp(join(tmpdir(), "pedal-art-pixels-"));
		dirs.push(dir);
		const result = await render(dir);
		const { data, info } = await sharp(result.pngPath)
			.ensureAlpha()
			.raw()
			.toBuffer({ resolveWithObject: true });

		const cornerAlpha = [
			3,
			(info.width - 1) * 4 + 3,
			(info.height - 1) * info.width * 4 + 3,
			(info.width * info.height - 1) * 4 + 3,
		].map((index) => data[index]);
		expect(cornerAlpha).toEqual([0, 0, 0, 0]);

		const center =
			(Math.floor(info.height / 2) * info.width + Math.floor(info.width / 2)) *
			4;
		expect(data[center + 3]).toBe(255);

		// Ignore near-transparent anti-alias pixels: un-premultiplying alpha 1–3
		// can distort their hue without any real cyan ink in the asset.
		let cyan = 0;
		for (let i = 0; i < data.length; i += 4) {
			const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
			if (a > 16 && g > 160 && b > 150 && r < 0.75 * g) cyan++;
		}
		expect(cyan).toBe(0);
	});

	it("rejects invalid specs", async () => {
		await expect(
			renderPedalArt({ ...(parsePedalArtSpec(DS1) as object), id: "../bad" }),
		).rejects.toThrow();
	});
});
