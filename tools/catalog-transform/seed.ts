import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import {
	type CatalogBoard,
	CatalogBoardSchema,
	type CatalogPedal,
	CatalogPedalSchema,
} from "../../src/catalog/schema.ts";
import { type RenditionSize, renderPng } from "./image.ts";

/**
 * Procedural ("mocked") images for the committed catalog. Real images are the
 * one part gated on clearance (ADR-003), so every item gets a generated
 * placeholder drawn from its id/dimensions. Deterministic: the same catalog
 * always yields byte-identical PNGs, which is what lets fresh clones and CI
 * regenerate and verify them without any external data.
 */

export type SeedImage = { path: string; buffer: Buffer };

const SIZES: RenditionSize[] = [800, 350];

/** Short, human-distinguishable label for the placeholder art. */
export function labelFor(name: string): string {
	const code = name
		.replace(/\(.*?\)/g, "")
		.replace(/\s+/g, "")
		.toUpperCase()
		.slice(0, 8);
	return code || "PEDAL";
}

/** Render every catalog image (pedals + boards, both renditions) into buffers. */
export async function renderCatalogImages(
	pedals: CatalogPedal[],
	boards: CatalogBoard[],
	assetsDir: string,
): Promise<SeedImage[]> {
	const images: SeedImage[] = [];

	for (const pedal of pedals) {
		for (const size of SIZES) {
			images.push({
				path: join(assetsDir, "pedals", String(size), pedal.image),
				buffer: await renderPng({
					id: pedal.id,
					label: labelFor(pedal.name),
					widthCm: pedal.widthCm,
					heightCm: pedal.heightCm,
					size,
				}),
			});
		}
	}

	for (const board of boards) {
		for (const size of SIZES) {
			images.push({
				path: join(assetsDir, "boards", String(size), board.image),
				buffer: await renderPng({
					id: board.id,
					label: labelFor(board.name),
					widthCm: board.widthCm,
					heightCm: board.heightCm,
					size,
				}),
			});
		}
	}

	return images;
}

/**
 * Regenerate the committed mocked PNGs from the committed catalog JSON.
 *
 * The rendition dirs (`pedals|boards/{800,350}`) are **generator-managed**: this
 * removes every `.png` in them that is not in the current manifest, so a
 * renamed/removed item never leaves a stale image shipping. Do not hand-place
 * files there — real images belong to P2-04's pipeline, not these dirs.
 */
export async function writeSeedImages(
	catalogDir: string,
	assetsDir: string,
): Promise<{ pedals: number; boards: number; images: number }> {
	// Validate before touching the filesystem — never build paths from
	// unvalidated `image` fields.
	const pedalsResult = CatalogPedalSchema.array().safeParse(
		JSON.parse(await readFile(join(catalogDir, "pedals.json"), "utf8")),
	);
	if (!pedalsResult.success) {
		throw new Error(
			`pedals.json: ${pedalsResult.error.issues[0]?.message ?? "invalid"}`,
		);
	}
	const boardsResult = CatalogBoardSchema.array().safeParse(
		JSON.parse(await readFile(join(catalogDir, "boards.json"), "utf8")),
	);
	if (!boardsResult.success) {
		throw new Error(
			`boards.json: ${boardsResult.error.issues[0]?.message ?? "invalid"}`,
		);
	}

	const images = await renderCatalogImages(
		pedalsResult.data,
		boardsResult.data,
		assetsDir,
	);
	for (const image of images) {
		await mkdir(dirname(image.path), { recursive: true });
		await writeFile(image.path, image.buffer);
	}

	const owned = new Set(images.map((image) => resolve(image.path)));
	for (const dir of [
		join(assetsDir, "pedals", "800"),
		join(assetsDir, "pedals", "350"),
		join(assetsDir, "boards", "800"),
		join(assetsDir, "boards", "350"),
	]) {
		let entries: string[];
		try {
			entries = await readdir(dir);
		} catch {
			continue;
		}
		for (const entry of entries) {
			if (!entry.endsWith(".png")) continue;
			const full = resolve(join(dir, entry));
			if (!owned.has(full)) await rm(full, { force: true });
		}
	}

	return {
		pedals: pedalsResult.data.length,
		boards: boardsResult.data.length,
		images: images.length,
	};
}
