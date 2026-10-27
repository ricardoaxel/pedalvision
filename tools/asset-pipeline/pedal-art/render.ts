import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import sharp from "sharp";
import { imageFilename, outputPath, RENDITIONS } from "../naming.ts";
import { type PedalArtSpec, parsePedalArtSpec } from "./spec.ts";
import { buildPedalArtSvg } from "./svg.ts";

/**
 * Render a per-item art spec to the committed 800/350 AVIF renditions, plus a
 * PNG + SVG reference for QA. Deterministic: the same spec produces identical
 * SVG/PNG bytes; AVIF is encoded with fixed options by the pinned sharp build.
 */

export type PedalArtRenderOptions = {
	/** Parent of the `pedals/<size>/` folders; defaults to public/pedal-assets. */
	assetsDir?: string;
	/** AVIF quality (1–100); defaults to 90. */
	quality?: number;
	/** PNG reference; defaults to work/catalog/pedal-art/<id>.png. */
	pngPath?: string;
	/** SVG reference; defaults to work/catalog/pedal-art/<id>.svg. */
	svgPath?: string;
};

export type PedalArtRendition = {
	size: number;
	path: string;
	bytes: number;
};

export type PedalArtRenderResult = {
	id: string;
	pngPath: string;
	svgPath: string;
	width: number;
	height: number;
	renditions: PedalArtRendition[];
};

export async function renderPedalArt(
	input: unknown,
	options: PedalArtRenderOptions = {},
): Promise<PedalArtRenderResult> {
	const spec: PedalArtSpec = parsePedalArtSpec(input);
	const pngPath = options.pngPath ?? `work/catalog/pedal-art/${spec.id}.png`;
	const svgPath = options.svgPath ?? `work/catalog/pedal-art/${spec.id}.svg`;
	const assetsDir = options.assetsDir ?? "public/pedal-assets";
	const quality = options.quality ?? 90;
	if (!Number.isInteger(quality) || quality < 1 || quality > 100) {
		throw new Error("quality must be an integer 1–100");
	}
	const filename = imageFilename(spec.id, "avif");

	const master = buildPedalArtSvg(spec, { longEdge: 800 });
	const png = await sharp(Buffer.from(master.svg)).png().toBuffer();
	await mkdir(dirname(pngPath), { recursive: true });
	await writeFile(pngPath, png);
	await mkdir(dirname(svgPath), { recursive: true });
	await writeFile(svgPath, master.svg);

	const renditions: PedalArtRendition[] = [];
	for (const size of RENDITIONS) {
		const built =
			size === 800 ? master : buildPedalArtSvg(spec, { longEdge: size });
		const buffer = await sharp(Buffer.from(built.svg))
			.avif({ quality, effort: 6, chromaSubsampling: "4:4:4" })
			.toBuffer();
		const path = outputPath(assetsDir, "pedal", size, filename);
		await mkdir(dirname(path), { recursive: true });
		await writeFile(path, buffer);
		renditions.push({ size, path, bytes: buffer.length });
	}

	return {
		id: spec.id,
		pngPath,
		svgPath,
		width: master.width,
		height: master.height,
		renditions,
	};
}
