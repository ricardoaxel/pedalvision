import { readdir, readFile } from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";
import {
	RawBoardBatchSchema,
	type RawBoardRecord,
	RawPedalBatchSchema,
	type RawPedalRecord,
} from "../../src/catalog/rawSchema.ts";
import { toSlug } from "../catalog-transform/slug.ts";
import {
	type BatchKind,
	mappedRelativePath,
	researchRelativePath,
	researchRoot,
} from "./paths.ts";

/**
 * Discovery for raw research batches. One file = one batch, and the folder name
 * must match the brand slug so two agents can never collide in the same brand.
 */

export type RawPedalBatch = {
	kind: "pedals";
	brandKey: string;
	brand: string;
	batch: string;
	relativePath: string;
	mappedRelativePath: string;
	records: RawPedalRecord[];
};

export type RawBoardBatch = {
	kind: "boards";
	brandKey: string;
	brand: string;
	batch: string;
	relativePath: string;
	mappedRelativePath: string;
	records: RawBoardRecord[];
};

export type RawBatch = RawPedalBatch | RawBoardBatch;

const BATCH_NAME = /^[a-z0-9][a-z0-9-]*$/;

function assertBatchName(name: string, path: string): void {
	if (!BATCH_NAME.test(name)) {
		throw new Error(`${path}: batch name must be a lowercase hyphenated slug`);
	}
}

function assertBrandFolder(
	kind: BatchKind,
	brandKey: string,
	records: Array<{ id: string; brand: string }>,
	path: string,
): string {
	const brand = records[0]?.brand;
	if (!brand) throw new Error(`${path}: batch is empty`);
	for (const record of records) {
		if (toSlug(record.brand) !== brandKey) {
			throw new Error(
				`${path}: "${record.id}" brand "${record.brand}" does not match folder "${brandKey}"`,
			);
		}
		if (toSlug(record.brand) !== toSlug(brand)) {
			throw new Error(`${path}: batch mixes brands (${kind})`);
		}
	}
	return brand;
}

async function readBatchFile(
	root: string,
	kind: BatchKind,
	brandKey: string,
	batch: string,
): Promise<RawBatch> {
	const path = resolve(root, researchRelativePath(kind, brandKey, batch));
	const raw = JSON.parse(await readFile(path, "utf8")) as unknown;
	const relativePath = relative(root, path).replaceAll("\\", "/");

	if (kind === "pedals") {
		const parsed = RawPedalBatchSchema.safeParse(raw);
		if (!parsed.success) {
			throw new Error(`${relativePath}: ${parsed.error.issues[0]?.message}`);
		}
		const brand = assertBrandFolder(kind, brandKey, parsed.data, relativePath);
		return {
			kind,
			brandKey,
			brand,
			batch,
			relativePath,
			mappedRelativePath: mappedRelativePath(kind, brandKey, batch),
			records: parsed.data,
		};
	}

	const parsed = RawBoardBatchSchema.safeParse(raw);
	if (!parsed.success) {
		throw new Error(`${relativePath}: ${parsed.error.issues[0]?.message}`);
	}
	const brand = assertBrandFolder(kind, brandKey, parsed.data, relativePath);
	return {
		kind,
		brandKey,
		brand,
		batch,
		relativePath,
		mappedRelativePath: mappedRelativePath(kind, brandKey, batch),
		records: parsed.data,
	};
}

async function listBrandDirs(root: string, kind: BatchKind): Promise<string[]> {
	try {
		const entries = await readdir(researchRoot(root, kind), {
			withFileTypes: true,
		});
		return entries
			.filter((entry) => entry.isDirectory())
			.map((entry) => entry.name)
			.sort();
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
		throw error;
	}
}

async function listBatchFiles(
	root: string,
	kind: BatchKind,
	brandKey: string,
): Promise<string[]> {
	try {
		const entries = await readdir(join(researchRoot(root, kind), brandKey), {
			withFileTypes: true,
		});
		return entries
			.filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
			.map((entry) => basename(entry.name, ".json"))
			.sort();
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
		throw error;
	}
}

/** Read every raw batch under `data/catalog/research` (or an explicit root). */
export async function discoverBatches(root: string): Promise<RawBatch[]> {
	const batches: RawBatch[] = [];
	for (const kind of ["pedals", "boards"] as const) {
		for (const brandKey of await listBrandDirs(root, kind)) {
			for (const batch of await listBatchFiles(root, kind, brandKey)) {
				assertBatchName(
					batch,
					join(researchRoot(root, kind), brandKey, `${batch}.json`),
				);
				batches.push(await readBatchFile(root, kind, brandKey, batch));
			}
		}
	}
	return batches;
}

/** Batch ids must be unique across the whole archive. */
export function assertUniqueBatches(batches: RawBatch[]): void {
	const seen = new Set<string>();
	for (const batch of batches) {
		const id = `${batch.kind}/${batch.brandKey}/${batch.batch}`;
		if (seen.has(id)) throw new Error(`duplicate raw batch "${id}"`);
		seen.add(id);
	}
}

/** A friendly display id used in logs and the registry. */
export function batchLabel(batch: RawBatch): string {
	return `${batch.kind}/${batch.brandKey}/${batch.batch}`;
}

/** Resolve the directory a mapped batch belongs in (for pruning). */
export function mappedBatchDir(root: string, batch: RawBatch): string {
	return join(resolve(root), dirname(batch.mappedRelativePath));
}
