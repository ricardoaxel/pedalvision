import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import sharp from "sharp";
import { imageFilename, outputPath, RENDITIONS } from "./naming.ts";

/**
 * Render a self-drawn board SVG to the committed 800/350 AVIF renditions.
 *
 * Board art is authored as an SVG under `tools/asset-pipeline/board-art/`; the
 * generated board must have a true footprint aspect, transparent openings and
 * no white/bg residue. This renderer writes the PNG reference plus both AVIFs;
 * the analyzer/design-reviewer/app QA still gate the result.
 */

export type BoardArtOptions = {
	/** Parent of the `boards/<size>/` folders; defaults to public/pedal-assets. */
	assetsDir?: string;
	/** AVIF quality (1-100); defaults to 90 for generated flat art. */
	quality?: number;
	/** PNG reference path; defaults to work/catalog/board-art/<id>.png. */
	pngPath?: string;
};

export type BoardArtRendition = {
	size: number;
	path: string;
	bytes: number;
};

export type BoardArtResult = {
	id: string;
	pngPath: string;
	renditions: BoardArtRendition[];
};

export async function renderBoardArt(
	input: Buffer | string,
	id: string,
	options: BoardArtOptions = {},
): Promise<BoardArtResult> {
	const pngPath = options.pngPath ?? `work/catalog/board-art/${id}.png`;
	const assetsDir = options.assetsDir ?? "public/pedal-assets";
	const quality = options.quality ?? 90;
	const filename = imageFilename(id, "avif");

	const png = await sharp(input).png().toBuffer();
	await mkdir(dirname(pngPath), { recursive: true });
	await writeFile(pngPath, png);

	const renditions: BoardArtRendition[] = [];
	for (const size of RENDITIONS) {
		const buffer = await sharp(input)
			.resize({ width: size, withoutEnlargement: true })
			.avif({ quality, chromaSubsampling: "4:4:4" })
			.toBuffer();
		const path = outputPath(assetsDir, "board", size, filename);
		await mkdir(dirname(path), { recursive: true });
		await writeFile(path, buffer);
		renditions.push({ size, path, bytes: buffer.length });
	}

	return { id, pngPath, renditions };
}
