import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { RawBatch } from "./batch.ts";

/**
 * Generated catalog registry (P5-02). This is a build manifest, not the control
 * plane: it lists every raw batch and the mapped file it produces. The runner's
 * live status lives under `work/catalog/`.
 */

export type RegistryBatch = {
	batch: string;
	raw: string;
	mapped: string;
	items: number;
};

export type RegistryBrand = {
	brand: string;
	batches: RegistryBatch[];
};

export type CatalogRegistry = {
	version: 1;
	pedals: Record<string, RegistryBrand>;
	boards: Record<string, RegistryBrand>;
};

export function buildRegistry(batches: RawBatch[]): CatalogRegistry {
	const registry: CatalogRegistry = { version: 1, pedals: {}, boards: {} };
	for (const batch of [...batches].sort((a, b) =>
		`${a.kind}/${a.brandKey}/${a.batch}`.localeCompare(
			`${b.kind}/${b.brandKey}/${b.batch}`,
		),
	)) {
		const target = registry[batch.kind];
		const brand = target[batch.brandKey] ?? {
			brand: batch.brand,
			batches: [],
		};
		brand.batches.push({
			batch: batch.batch,
			raw: batch.relativePath,
			mapped: batch.mappedRelativePath,
			items: batch.records.length,
		});
		target[batch.brandKey] = brand;
	}
	return registry;
}

export async function writeRegistry(
	path: string,
	registry: CatalogRegistry,
): Promise<void> {
	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, `${JSON.stringify(registry, null, 2)}\n`);
}
