import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import {
	type CatalogBoard,
	CatalogBoardSchema,
	CatalogPedalSchema,
	SOURCE_TAGS,
	type SourceTag,
} from "../../src/catalog/schema.ts";
import {
	convertBoards,
	convertPedals,
	type ExternalRow,
	mergeExisting,
	normalizeVariantFootprints,
} from "./convert.ts";
import {
	CURATED_EFFECTS,
	deriveCategory,
	deriveEffectTypes,
} from "./curated.ts";
import { resolveImages } from "./images.ts";
import { buildInventory } from "./inventory.ts";
import { writeSeedImages } from "./seed.ts";
import { validateSeed } from "./seed-validation.ts";
import {
	DEFAULT_SELECT,
	type SelectOptions,
	selectBoards,
	selectPedals,
} from "./select.ts";

/**
 * `tools/catalog-transform` — a one-off dev CLI (ADR-003).
 *
 *   # Import an external catalog into the committed seed (real data, mocked images)
 *   node --experimental-strip-types tools/catalog-transform/index.ts import \
 *     --input pedals.json --boards pedalboards.json
 *
 *   # (Re)generate the mocked PNGs from the committed catalog JSON
 *   node --experimental-strip-types tools/catalog-transform/index.ts seed
 *
 * Provenance: never name or link the source here or in any output. Input/output
 * paths are always explicit CLI args.
 */

const DEFAULTS = {
	outDir: "src/catalog/data",
	catalogDir: "src/catalog/data",
	assetsDir: "public/pedal-assets",
	source: "placeholder" as SourceTag,
	boardLimit: 10,
	select: DEFAULT_SELECT,
};

const USAGE = `catalog-transform — external catalog → our schema, plus mocked seed images

Usage:
  import --input <pedals.json> [--boards <boards.json>]
         [--out-dir <dir>] [--source <tag>]
         [--brand-limit <n>] [--top-brand-cap <n>] [--per-brand-cap <n>]
         [--supply-limit <n>] [--board-limit <n>] [--allow-removals]
  seed   [--catalog-dir <dir>] [--assets-dir <dir>]
  reclassify [--catalog-dir <dir>]
  resolve-images [--catalog-dir <dir>]
  inventory --pedals <pedals.json> --boards <boards.json>
            [--out <inventory.json>] [--seed-dir <dir>] [--generated-at <YYYY-MM-DD>]
  validate-seed [--catalog-dir <dir>] [--assets-dir <dir>]
                [--out <seed-validation.json>] [--generated-at <YYYY-MM-DD>]
  --help

Source tags: ${SOURCE_TAGS.join(" | ")}
Note: --source tags NEWLY imported items only; existing ids keep their curated
provenance tag (a re-import preserves curation by stable id).`;

type Args = {
	command: string;
	input?: string;
	boards?: string;
	outDir: string;
	catalogDir: string;
	assetsDir: string;
	source: SourceTag;
	boardLimit: number;
	select: SelectOptions;
	allowRemovals: boolean;
	out?: string;
	seedDir: string;
	generatedAt: string;
	help: boolean;
};

function readNumber(argv: string[], index: number, flag: string): number {
	const raw = argv[index + 1];
	const value = Number(raw);
	if (!Number.isInteger(value) || value <= 0) {
		throw new Error(`${flag} must be a positive integer (got "${raw}")`);
	}
	return value;
}

function parseArgs(argv: string[]): Args {
	const args: Args = {
		command: argv[0] ?? "",
		outDir: DEFAULTS.outDir,
		catalogDir: DEFAULTS.catalogDir,
		assetsDir: DEFAULTS.assetsDir,
		source: DEFAULTS.source,
		boardLimit: DEFAULTS.boardLimit,
		select: { ...DEFAULTS.select },
		allowRemovals: false,
		seedDir: "src/catalog/data",
		generatedAt: new Date().toISOString().slice(0, 10),
		help: false,
	};
	if (args.command === "--help" || args.command === "-h") {
		args.help = true;
		return args;
	}

	for (let i = 1; i < argv.length; i++) {
		const arg = argv[i];
		switch (arg) {
			case "--input":
			case "--pedals":
				args.input = argv[++i];
				break;
			case "--boards":
				args.boards = argv[++i];
				break;
			case "--out-dir":
				args.outDir = argv[++i];
				break;
			case "--catalog-dir":
				args.catalogDir = argv[++i];
				break;
			case "--assets-dir":
				args.assetsDir = argv[++i];
				break;
			case "--source": {
				const value = argv[++i];
				if (!SOURCE_TAGS.includes(value as SourceTag)) {
					throw new Error(
						`--source must be one of: ${SOURCE_TAGS.join(", ")} (got "${value}")`,
					);
				}
				args.source = value as SourceTag;
				break;
			}
			case "--brand-limit":
				args.select.brandLimit = readNumber(argv, i, arg);
				i++;
				break;
			case "--top-brand-cap":
				args.select.topBrandCap = readNumber(argv, i, arg);
				i++;
				break;
			case "--per-brand-cap":
				args.select.perBrandCap = readNumber(argv, i, arg);
				i++;
				break;
			case "--supply-limit":
				args.select.supplyLimit = readNumber(argv, i, arg);
				i++;
				break;
			case "--board-limit":
				args.boardLimit = readNumber(argv, i, arg);
				i++;
				break;
			case "--allow-removals":
				args.allowRemovals = true;
				break;
			case "--out":
				args.out = argv[++i];
				break;
			case "--seed-dir":
				args.seedDir = argv[++i];
				break;
			case "--generated-at": {
				const value = argv[++i];
				if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? "")) {
					throw new Error(`--generated-at must be YYYY-MM-DD (got "${value}")`);
				}
				args.generatedAt = value;
				break;
			}
			case "--help":
			case "-h":
				args.help = true;
				break;
			default:
				throw new Error(`unknown argument "${arg}"`);
		}
	}
	return args;
}

async function readRows(path: string): Promise<ExternalRow[]> {
	const parsed = JSON.parse(
		await readFile(resolve(process.cwd(), path), "utf8"),
	);
	if (!Array.isArray(parsed)) {
		throw new Error(`${path}: expected a JSON array of catalog rows`);
	}
	return parsed as ExternalRow[];
}

/**
 * Read an existing catalog file for the curation merge; `[]` if absent. Returns
 * the raw parsed JSON — `mergeExisting` schema-validates it (malformed JSON or
 * shape fails loudly rather than silently dropping curation).
 */
async function readExisting(path: string): Promise<unknown> {
	let raw: string;
	try {
		raw = await readFile(path, "utf8");
	} catch (error) {
		// A missing file is fine (fresh import); anything else is a real error.
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
		throw error;
	}
	return JSON.parse(raw);
}

/**
 * A re-import that no longer selects an existing id writes it out (with its
 * curation). Require an explicit `--allow-removals` opt-in instead of dropping
 * silently; the default throws.
 */
function guardRemovals<T extends { id: string }>(
	args: Args,
	kind: string,
	dropped: T[],
	warn: (message: string) => void,
): void {
	if (dropped.length === 0) return;
	const ids = dropped.map((item) => item.id);
	const sample = ids.slice(0, 10).join(", ");
	const more = ids.length > 10 ? ` … (+${ids.length - 10} more)` : "";
	const message = `import would drop ${ids.length} existing ${kind} id(s): ${sample}${more}`;
	if (!args.allowRemovals) {
		throw new Error(`${message}. Re-run with --allow-removals to confirm.`);
	}
	warn(message);
}

async function runImport(args: Args): Promise<void> {
	if (!args.input) throw new Error("import requires --input <pedals.json>");
	const outDir = resolve(process.cwd(), args.outDir);
	const warn = (message: string) => console.warn(`warn: ${message}`);

	const pedals = convertPedals(await readRows(args.input), {
		source: args.source,
		warn,
	});
	// Always keep the verified override set so the seed stays reproducible and
	// every curated key remains a real entry (no-dead-keys invariant).
	const selectedPedals = selectPedals(pedals.items, {
		...args.select,
		keepIds: Object.keys(CURATED_EFFECTS),
	});

	// Preserve curation (sources, rights tag, specs, cleared image state) for
	// surviving ids — a re-import must never wipe provenance/assets added by
	// hand or research.
	const pedalsMerge = mergeExisting(
		selectedPedals,
		await readExisting(`${outDir}/pedals.json`),
		CatalogPedalSchema.array(),
	);
	guardRemovals(args, "pedal", pedalsMerge.dropped, warn);
	const mergedPedals = pedalsMerge.items;
	// Re-normalize AFTER the merge: a curated base footprint must propagate to a
	// newly-added colorway (otherwise variant/base dims can silently diverge).
	normalizeVariantFootprints(mergedPedals);

	// Boards are only touched when explicitly imported — a pedals-only import
	// must never blank `boards.json`.
	let mergedBoards: CatalogBoard[] | null = null;
	if (args.boards) {
		const boards = convertBoards(await readRows(args.boards), {
			source: args.source,
			warn,
		});
		const boardsMerge = mergeExisting(
			selectBoards(boards.items, args.boardLimit),
			await readExisting(`${outDir}/boards.json`),
			CatalogBoardSchema.array(),
		);
		guardRemovals(args, "board", boardsMerge.dropped, warn);
		mergedBoards = boardsMerge.items;
	}

	// Fail loudly rather than writing data the app cannot load.
	const pedalCheck = CatalogPedalSchema.array().safeParse(mergedPedals);
	if (!pedalCheck.success) {
		throw new Error(
			`invalid pedal output: ${pedalCheck.error.issues[0]?.message}`,
		);
	}
	if (mergedBoards) {
		const boardCheck = CatalogBoardSchema.array().safeParse(mergedBoards);
		if (!boardCheck.success) {
			throw new Error(
				`invalid board output: ${boardCheck.error.issues[0]?.message}`,
			);
		}
	}

	await mkdir(outDir, { recursive: true });
	await writeFile(
		`${outDir}/pedals.json`,
		`${JSON.stringify(mergedPedals, null, 2)}\n`,
	);
	if (mergedBoards) {
		await writeFile(
			`${outDir}/boards.json`,
			`${JSON.stringify(mergedBoards, null, 2)}\n`,
		);
	}

	console.log(
		`imported ${mergedPedals.length} pedals${
			mergedBoards ? ` / ${mergedBoards.length} boards` : " (boards untouched)"
		} → ${outDir}`,
	);
	console.log(
		`  (kept ${new Set(mergedPedals.map((p) => p.brand)).size} brands; run \`seed\` to render images)`,
	);
}

async function runSeed(args: Args): Promise<void> {
	const catalogDir = resolve(process.cwd(), args.catalogDir);
	const assetsDir = resolve(process.cwd(), args.assetsDir);
	const summary = await writeSeedImages(catalogDir, assetsDir);
	console.log(
		`seed: ${summary.pedals} pedals, ${summary.boards} boards, ${summary.images} PNGs`,
	);
	console.log(`  json  → ${catalogDir}`);
	console.log(`  pngs  → ${assetsDir}`);
}

/**
 * Recompute `effectTypes` for the committed catalog in place (curated override
 * + classifier), so taxonomy/curated changes can be applied without the
 * external input file. Deterministic; touches nothing else.
 */
async function runReclassify(args: Args): Promise<void> {
	const catalogDir = resolve(process.cwd(), args.catalogDir);
	const path = `${catalogDir}/pedals.json`;
	const parsed = CatalogPedalSchema.array().safeParse(
		JSON.parse(await readFile(path, "utf8")),
	);
	if (!parsed.success) {
		throw new Error(`pedals.json: ${parsed.error.issues[0]?.message}`);
	}
	let changed = 0;
	const next = parsed.data.map((pedal) => {
		const input = {
			brand: pedal.brand,
			name: pedal.name,
			variantOf: pedal.variantOf,
		};
		const effectTypes = deriveEffectTypes(input);
		const category = deriveCategory(input);
		if (
			JSON.stringify(effectTypes) !== JSON.stringify(pedal.effectTypes) ||
			category !== pedal.category
		) {
			changed++;
		}
		return { ...pedal, effectTypes, category };
	});
	// Validate the output before writing (consistency with the import path).
	const check = CatalogPedalSchema.array().safeParse(next);
	if (!check.success) {
		throw new Error(
			`reclassify output invalid: ${check.error.issues[0]?.message}`,
		);
	}
	if (changed > 0) {
		await writeFile(path, `${JSON.stringify(next, null, 2)}\n`);
	}
	console.log(
		`reclassify: ${next.length} pedals, ${changed} updated → ${path}`,
	);
}

/**
 * Resolve `image`/`imageSource` from each item's recorded `sources` in place:
 * a direct official image URL becomes the rendered image (`url`); everything
 * else keeps its mock. Deterministic; touches nothing else. Run before `seed`
 * (which then only draws the remaining mocks).
 */
async function runResolveImages(args: Args): Promise<void> {
	const catalogDir = resolve(process.cwd(), args.catalogDir);
	const pedalPath = `${catalogDir}/pedals.json`;
	const boardPath = `${catalogDir}/boards.json`;

	const pedals = CatalogPedalSchema.array().safeParse(
		JSON.parse(await readFile(pedalPath, "utf8")),
	);
	if (!pedals.success) {
		throw new Error(`pedals.json: ${pedals.error.issues[0]?.message}`);
	}
	const boards = CatalogBoardSchema.array().safeParse(
		JSON.parse(await readFile(boardPath, "utf8")),
	);
	if (!boards.success) {
		throw new Error(`boards.json: ${boards.error.issues[0]?.message}`);
	}

	const pedalChanged = resolveImages(pedals.data);
	const boardChanged = resolveImages(boards.data);

	// Validate the output before writing (consistency with the other commands).
	const pedalCheck = CatalogPedalSchema.array().safeParse(pedals.data);
	if (!pedalCheck.success) {
		throw new Error(
			`resolve-images pedal output invalid: ${pedalCheck.error.issues[0]?.message}`,
		);
	}
	const boardCheck = CatalogBoardSchema.array().safeParse(boards.data);
	if (!boardCheck.success) {
		throw new Error(
			`resolve-images board output invalid: ${boardCheck.error.issues[0]?.message}`,
		);
	}

	await writeFile(pedalPath, `${JSON.stringify(pedals.data, null, 2)}\n`);
	await writeFile(boardPath, `${JSON.stringify(boards.data, null, 2)}\n`);
	console.log(
		`resolve-images: ${pedalChanged}/${pedals.data.length} pedals, ${boardChanged}/${boards.data.length} boards → ${catalogDir}`,
	);
}

/**
 * Read the committed seed's brand/name pairs for the inventory overlap flag.
 * A missing seed file is fine (fresh repo).
 */
async function readSeedNames(
	path: string,
): Promise<Array<{ id: string; brand: string; name: string }>> {
	let raw: string;
	try {
		raw = await readFile(path, "utf8");
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
		throw error;
	}
	const parsed = JSON.parse(raw);
	if (!Array.isArray(parsed)) return [];
	return parsed
		.filter(
			(item): item is { id: string; brand: string; name: string } =>
				typeof item === "object" &&
				item !== null &&
				typeof (item as { id?: unknown }).id === "string" &&
				typeof (item as { brand?: unknown }).brand === "string" &&
				typeof (item as { name?: unknown }).name === "string",
		)
		.map((item) => ({ id: item.id, brand: item.brand, name: item.name }));
}

/** Build the off-runtime master inventory from the discovery lists. */
async function runInventory(args: Args): Promise<void> {
	if (!args.input || !args.boards) {
		throw new Error(
			"inventory requires --pedals <pedals.json> --boards <boards.json>",
		);
	}
	const pedalRows = await readRows(args.input);
	const boardRows = await readRows(args.boards);
	const seedDir = resolve(process.cwd(), args.seedDir);
	const inventory = buildInventory(pedalRows, boardRows, {
		generatedAt: args.generatedAt,
		seedPedals: await readSeedNames(join(seedDir, "pedals.json")),
		seedBoards: await readSeedNames(join(seedDir, "boards.json")),
	});
	const out = resolve(process.cwd(), args.out ?? "data/catalog/inventory.json");
	await mkdir(dirname(out), { recursive: true });
	await writeFile(out, `${JSON.stringify(inventory, null, 2)}\n`);
	const { pedals, boards } = inventory.summary;
	console.log(
		`inventory: ${pedals.unique}/${pedals.discovered} pedals (${pedals.brands} brands) + ${boards.unique}/${boards.discovered} boards (${boards.brands} brands) → ${out}`,
	);
	console.log(
		`  tiers pedals A=${pedals.tierA} B=${pedals.tierB} C=${pedals.tierC}; boards A=${boards.tierA} B=${boards.tierB} C=${boards.tierC}`,
	);
	console.log(
		`  duplicates removed ${pedals.duplicatesRemoved} pedals / ${boards.duplicatesRemoved} boards; seed overlap ${pedals.seedOverlap} pedals / ${boards.seedOverlap} boards`,
	);
}

/** Validate the committed seed and write the keep/repair/replace/drop report. */
async function runValidateSeed(args: Args): Promise<void> {
	const catalogDir = resolve(process.cwd(), args.catalogDir);
	const assetsDir = resolve(process.cwd(), args.assetsDir);
	const pedals = JSON.parse(
		await readFile(join(catalogDir, "pedals.json"), "utf8"),
	);
	const boards = JSON.parse(
		await readFile(join(catalogDir, "boards.json"), "utf8"),
	);
	if (!Array.isArray(pedals) || !Array.isArray(boards)) {
		throw new Error("seed validation expects pedals.json/boards.json arrays");
	}
	const hasStaticImage = (kind: "pedal" | "board", image: string): boolean => {
		const folder = kind === "pedal" ? "pedals" : "boards";
		return [800, 350].every((size) =>
			existsSync(join(assetsDir, folder, String(size), image)),
		);
	};
	const report = validateSeed(pedals, boards, {
		generatedAt: args.generatedAt,
		hasStaticImage,
	});
	const out = resolve(
		process.cwd(),
		args.out ?? "data/catalog/seed-validation.json",
	);
	await mkdir(dirname(out), { recursive: true });
	await writeFile(out, `${JSON.stringify(report, null, 2)}\n`);
	console.log(
		`seed validation: ${report.source.pedals} pedals / ${report.source.boards} boards → ${out}`,
	);
	console.log(
		`  pedals keep=${report.summary.pedals.keep} repair=${report.summary.pedals.repair} replace=${report.summary.pedals.replace} drop=${report.summary.pedals.drop}`,
	);
	console.log(
		`  boards keep=${report.summary.boards.keep} repair=${report.summary.boards.repair} replace=${report.summary.boards.replace} drop=${report.summary.boards.drop}`,
	);
}

async function main(): Promise<void> {
	const args = parseArgs(process.argv.slice(2));
	if (args.help || !args.command) {
		console.log(USAGE);
		if (!args.command) process.exitCode = 1;
		return;
	}
	switch (args.command) {
		case "import":
			await runImport(args);
			return;
		case "seed":
			await runSeed(args);
			return;
		case "reclassify":
			await runReclassify(args);
			return;
		case "resolve-images":
			await runResolveImages(args);
			return;
		case "inventory":
			await runInventory(args);
			return;
		case "validate-seed":
			await runValidateSeed(args);
			return;
		default:
			throw new Error(`unknown command "${args.command}"`);
	}
}

main().catch((error: unknown) => {
	console.error(`error: ${error instanceof Error ? error.message : error}`);
	process.exitCode = 1;
});
