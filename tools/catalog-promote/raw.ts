import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { RawPedalBatchSchema } from "../../src/catalog/rawSchema.ts";

/**
 * Every id already present in a raw pedal batch. `skipPath` excludes the batch
 * being (re)written, so `--force` can regenerate its own output without tripping
 * the duplicate guard.
 */
export async function existingRawIds(
	root: string,
	skipPath?: string,
): Promise<string[]> {
	const researchRoot = resolve(root, "data/catalog/research/pedals");
	const skipped = skipPath ? resolve(skipPath) : undefined;
	let brands: string[];
	try {
		brands = await readdir(researchRoot);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
		throw error;
	}
	const ids: string[] = [];
	for (const brand of brands) {
		const dir = join(researchRoot, brand);
		let files: string[];
		try {
			files = await readdir(dir);
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
			throw error;
		}
		for (const file of files) {
			if (!file.endsWith(".json")) continue;
			const path = join(dir, file);
			if (skipped && resolve(path) === skipped) continue;
			const parsed = RawPedalBatchSchema.safeParse(
				JSON.parse(await readFile(path, "utf8")),
			);
			if (!parsed.success) {
				throw new Error(
					`${path}: invalid raw batch — ${parsed.error.issues[0]?.message ?? "unknown error"}`,
				);
			}
			ids.push(...parsed.data.map((record) => record.id));
		}
	}
	return ids;
}
