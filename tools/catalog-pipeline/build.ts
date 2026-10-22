import type { Dirent } from "node:fs";
import {
	copyFile,
	mkdir,
	mkdtemp,
	readdir,
	readFile,
	rename,
	rm,
	rmdir,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import {
	type CatalogBoard,
	CatalogBoardSchema,
	type CatalogPedal,
	CatalogPedalSchema,
} from "../../src/catalog/schema.ts";
import { discoverBatches, type RawBatch } from "./batch.ts";
import {
	LEGACY_DIR,
	MAPPED_DIR,
	mappedRoot,
	RUNTIME_DIR,
	registryPath,
	runtimePath,
} from "./paths.ts";
import { projectBoard, projectPedal } from "./project.ts";
import {
	buildRegistry,
	type CatalogRegistry,
	writeRegistry,
} from "./registry.ts";
import { formatIssues, validateCatalog } from "./validate.ts";

let writeSequence = 0;

/**
 * Deterministic raw → mapped → runtime build (P5-02).
 *
 * `data/catalog/legacy` is the frozen seed baseline. Raw batch records are
 * projected over it by stable id, so a batch can replace a legacy item without
 * re-researching it. The build writes only generated files; brand agents never
 * do.
 */

export type BuildOptions = {
	root: string;
	/** Root that receives generated files. Defaults to `root`. */
	outRoot?: string;
	/** Root holding `data/catalog/legacy`. Defaults to `root`. */
	legacyRoot?: string;
	/** Assets used for validation. Defaults to `root/public/pedal-assets`. */
	assetsRoot?: string;
};

export type BuildResult = {
	root: string;
	outRoot: string;
	batches: RawBatch[];
	pedals: CatalogPedal[];
	boards: CatalogBoard[];
	registry: CatalogRegistry;
	mappedFiles: string[];
	runtimeFiles: string[];
};

function json(value: unknown): string {
	return `${JSON.stringify(value, null, 2)}\n`;
}

async function writeJson(path: string, value: unknown): Promise<void> {
	await mkdir(dirname(path), { recursive: true });
	const temp = `${path}.tmp-${process.pid}-${writeSequence++}`;
	await writeFile(temp, json(value));
	await rename(temp, path);
}

type ArrayParser<T> = {
	safeParse: (
		value: unknown,
	) =>
		| { success: true; data: T[] }
		| { success: false; error: { issues: Array<{ message: string }> } };
};

async function readCatalogArray<T>(
	path: string,
	parse: ArrayParser<T>,
): Promise<T[]> {
	let raw: unknown;
	try {
		raw = JSON.parse(await readFile(path, "utf8"));
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			throw new Error(
				`${path}: missing frozen legacy baseline — run the P5-02 setup first`,
			);
		}
		throw error;
	}
	const parsed = parse.safeParse(raw);
	if (!parsed.success) {
		throw new Error(
			`${path}: ${parsed.error.issues[0]?.message ?? "invalid catalog baseline"}`,
		);
	}
	return parsed.data;
}

function assertRecordFacts(batch: RawBatch): void {
	for (const record of batch.records) {
		const hasImageSource =
			record.sources?.some((source) => source.kind.includes("image")) ?? false;
		if (!hasImageSource) {
			throw new Error(
				`${batch.relativePath}: "${record.id}" needs a sources[] entry with kind "image"`,
			);
		}
		if (
			batch.kind === "pedals" &&
			record.category === "pedal" &&
			(record.effectTypes?.length ?? 0) === 0
		) {
			throw new Error(
				`${batch.relativePath}: pedal "${record.id}" needs at least one effectType`,
			);
		}
	}
}

function assertBatchIds(batch: RawBatch): void {
	const seen = new Set<string>();
	for (const record of batch.records) {
		if (seen.has(record.id)) {
			throw new Error(
				`${batch.relativePath}: duplicate id "${record.id}" inside the batch`,
			);
		}
		seen.add(record.id);
	}
}

function mergeBatches(
	legacyPedals: CatalogPedal[],
	legacyBoards: CatalogBoard[],
	batches: RawBatch[],
): {
	pedals: CatalogPedal[];
	boards: CatalogBoard[];
	mapped: Map<string, Array<CatalogPedal | CatalogBoard>>;
} {
	const pedals = [...legacyPedals];
	const boards = [...legacyBoards];
	const pedalIndex = new Map(pedals.map((item, index) => [item.id, index]));
	const boardIndex = new Map(boards.map((item, index) => [item.id, index]));
	const claimed = new Set<string>();
	const mapped = new Map<string, Array<CatalogPedal | CatalogBoard>>();

	for (const batch of [...batches].sort((a, b) =>
		`${a.kind}/${a.brandKey}/${a.batch}`.localeCompare(
			`${b.kind}/${b.brandKey}/${b.batch}`,
		),
	)) {
		assertBatchIds(batch);
		assertRecordFacts(batch);
		const projected =
			batch.kind === "pedals"
				? batch.records.map((record) => projectPedal(record))
				: batch.records.map((record) => projectBoard(record));
		const sorted = [...projected].sort((a, b) => a.id.localeCompare(b.id));

		for (const item of sorted) {
			const key = `${batch.kind}:${item.id}`;
			if (claimed.has(key)) {
				throw new Error(
					`${batch.relativePath}: id "${item.id}" is also provided by another batch`,
				);
			}
			claimed.add(key);
			if (batch.kind === "pedals") {
				const index = pedalIndex.get(item.id);
				if (index === undefined) {
					pedalIndex.set(item.id, pedals.length);
					pedals.push(item as CatalogPedal);
				} else {
					pedals[index] = item as CatalogPedal;
				}
			} else {
				const index = boardIndex.get(item.id);
				if (index === undefined) {
					boardIndex.set(item.id, boards.length);
					boards.push(item as CatalogBoard);
				} else {
					boards[index] = item as CatalogBoard;
				}
			}
		}
		mapped.set(`${batch.kind}/${batch.brandKey}/${batch.batch}`, sorted);
	}

	return { pedals, boards, mapped };
}

async function pruneMapped(root: string, expected: Set<string>): Promise<void> {
	for (const kind of ["pedals", "boards"] as const) {
		const base = mappedRoot(root, kind);
		let brandDirs: string[];
		try {
			brandDirs = await readdir(base);
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
			throw error;
		}
		for (const brand of brandDirs) {
			const dir = join(base, brand);
			const entries = await readdir(dir);
			for (const entry of entries) {
				const relative = `${MAPPED_DIR}/${kind}/${brand}/${entry}`;
				if (entry.endsWith(".json") && !expected.has(relative)) {
					await rm(join(dir, entry));
				}
			}
			const remaining = await readdir(dir);
			if (remaining.length === 0) await rmdir(dir);
		}
	}
}

export async function buildCatalog(
	options: BuildOptions,
): Promise<BuildResult> {
	const root = resolve(options.root);
	const outRoot = resolve(options.outRoot ?? root);
	const legacyRoot = resolve(options.legacyRoot ?? root);
	const assetsRoot = resolve(
		options.assetsRoot ?? join(root, "public/pedal-assets"),
	);

	const legacyPedals = await readCatalogArray<CatalogPedal>(
		join(legacyRoot, LEGACY_DIR, "pedals.json"),
		CatalogPedalSchema.array(),
	);
	const legacyBoards = await readCatalogArray<CatalogBoard>(
		join(legacyRoot, LEGACY_DIR, "boards.json"),
		CatalogBoardSchema.array(),
	);

	const batches = await discoverBatches(root);
	const merged = mergeBatches(legacyPedals, legacyBoards, batches);
	const registry = buildRegistry(batches);

	const expectedMapped = new Set(
		batches.map((batch) => batch.mappedRelativePath),
	);
	for (const [key, items] of merged.mapped) {
		const batch = batches.find(
			(entry) => `${entry.kind}/${entry.brandKey}/${entry.batch}` === key,
		);
		if (!batch) continue;
		await writeJson(join(outRoot, batch.mappedRelativePath), items);
	}
	await pruneMapped(outRoot, expectedMapped);

	const mappedFiles = batches
		.map((batch) => join(outRoot, batch.mappedRelativePath))
		.sort();
	const runtimeFiles = [
		runtimePath(outRoot, "pedals"),
		runtimePath(outRoot, "boards"),
	];
	await writeJson(runtimeFiles[0], merged.pedals);
	await writeJson(runtimeFiles[1], merged.boards);
	await writeRegistry(registryPath(outRoot), registry);

	const validation = await validateCatalog({
		catalogDir: resolve(outRoot, RUNTIME_DIR),
		assetsDir: assetsRoot,
	});
	if (validation.issues.length > 0) {
		throw new Error(
			`catalog validation failed:\n${formatIssues(validation.issues)}`,
		);
	}

	return {
		root,
		outRoot,
		batches,
		pedals: merged.pedals,
		boards: merged.boards,
		registry,
		mappedFiles,
		runtimeFiles,
	};
}

async function listFiles(base: string, prefix = ""): Promise<string[]> {
	let entries: Dirent[];
	try {
		entries = await readdir(base, { withFileTypes: true });
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
		throw error;
	}
	const files: string[] = [];
	for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
		const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
		if (entry.isDirectory()) {
			files.push(...(await listFiles(join(base, entry.name), relative)));
		} else if (entry.isFile()) {
			files.push(relative);
		}
	}
	return files;
}

async function compareTree(
	label: string,
	expectedBase: string,
	actualBase: string,
): Promise<string[]> {
	const expected = await listFiles(expectedBase);
	const actual = await listFiles(actualBase);
	const drift: string[] = [];
	for (const file of expected) {
		if (!actual.includes(file)) {
			drift.push(`${label}: missing ${file}`);
			continue;
		}
		const [left, right] = await Promise.all([
			readFile(join(expectedBase, file)),
			readFile(join(actualBase, file)),
		]);
		if (!left.equals(right)) drift.push(`${label}: stale ${file}`);
	}
	for (const file of actual) {
		if (!expected.includes(file)) drift.push(`${label}: unexpected ${file}`);
	}
	return drift;
}

export type DriftResult = { ok: boolean; drift: string[] };

/**
 * Regenerate into a temp dir and byte-compare mapped + runtime + registry to the
 * committed generated files. Fails on additions, deletions, or stale content.
 */
export async function checkDrift(options: BuildOptions): Promise<DriftResult> {
	const temp = await mkdtemp(join(tmpdir(), "pedalvision-catalog-check-"));
	try {
		await buildCatalog({
			...options,
			outRoot: temp,
			assetsRoot: options.assetsRoot,
		});
		const drift: string[] = [];
		for (const kind of ["pedals", "boards"] as const) {
			drift.push(
				...(await compareTree(
					`mapped/${kind}`,
					resolve(temp, MAPPED_DIR, kind),
					resolve(options.root, MAPPED_DIR, kind),
				)),
			);
		}
		drift.push(
			...(await compareTree(
				"runtime",
				resolve(temp, RUNTIME_DIR),
				resolve(options.root, RUNTIME_DIR),
			)),
		);
		const [expectedRegistry, actualRegistry] = await Promise.all([
			readFile(registryPath(temp)).catch(() => Buffer.from("")),
			readFile(registryPath(options.root)).catch(() => Buffer.from("")),
		]);
		if (!expectedRegistry.equals(actualRegistry)) {
			drift.push("registry: stale data/catalog/registry.json");
		}
		return { ok: drift.length === 0, drift };
	} finally {
		await rm(temp, { recursive: true, force: true });
	}
}

/**
 * CI helper: build into temp (validated) and copy only the runtime into the app
 * workspace. The copied runtime is intentionally uncommitted so Playwright and
 * the app build can see this PR's new items.
 */
export async function buildForCi(options: BuildOptions): Promise<BuildResult> {
	const temp = await mkdtemp(join(tmpdir(), "pedalvision-catalog-ci-"));
	try {
		const result = await buildCatalog({ ...options, outRoot: temp });
		for (const file of result.runtimeFiles) {
			const relative = file.slice(temp.length + 1);
			const target = resolve(options.root, relative);
			await mkdir(join(target, ".."), { recursive: true });
			await copyFile(file, target);
		}
		return result;
	} finally {
		await rm(temp, { recursive: true, force: true });
	}
}
