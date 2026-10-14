import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
	CatalogBoardSchema,
	CatalogPedalSchema,
	SOURCE_TAGS,
	type SourceTag,
} from "../../src/catalog/schema.ts";
import { convertBoards, convertPedals, type ExternalRow } from "./convert.ts";
import { deriveCategory, deriveEffectTypes } from "./curated.ts";
import { writeSeedImages } from "./seed.ts";
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
         [--supply-limit <n>] [--board-limit <n>]
  seed   [--catalog-dir <dir>] [--assets-dir <dir>]
  reclassify [--catalog-dir <dir>]
  --help

Source tags: ${SOURCE_TAGS.join(" | ")}`;

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

async function runImport(args: Args): Promise<void> {
	if (!args.input) throw new Error("import requires --input <pedals.json>");
	const outDir = resolve(process.cwd(), args.outDir);
	const warn = (message: string) => console.warn(`warn: ${message}`);

	const pedals = convertPedals(await readRows(args.input), {
		source: args.source,
		warn,
	});
	const selectedPedals = selectPedals(pedals.items, args.select);

	const boards = args.boards
		? convertBoards(await readRows(args.boards), { source: args.source, warn })
		: { items: [] };
	const selectedBoards = selectBoards(boards.items, args.boardLimit);

	// Fail loudly rather than writing data the app cannot load.
	const pedalCheck = CatalogPedalSchema.array().safeParse(selectedPedals);
	const boardCheck = CatalogBoardSchema.array().safeParse(selectedBoards);
	if (!pedalCheck.success) {
		throw new Error(
			`invalid pedal output: ${pedalCheck.error.issues[0]?.message}`,
		);
	}
	if (!boardCheck.success) {
		throw new Error(
			`invalid board output: ${boardCheck.error.issues[0]?.message}`,
		);
	}

	await mkdir(outDir, { recursive: true });
	await writeFile(
		`${outDir}/pedals.json`,
		`${JSON.stringify(selectedPedals, null, 2)}\n`,
	);
	await writeFile(
		`${outDir}/boards.json`,
		`${JSON.stringify(selectedBoards, null, 2)}\n`,
	);

	console.log(
		`imported ${selectedPedals.length} pedals / ${selectedBoards.length} boards → ${outDir}`,
	);
	console.log(
		`  (kept ${new Set(selectedPedals.map((p) => p.brand)).size} brands; run \`seed\` to render images)`,
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
	await writeFile(path, `${JSON.stringify(next, null, 2)}\n`);
	console.log(
		`reclassify: ${next.length} pedals, ${changed} updated → ${path}`,
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
		default:
			throw new Error(`unknown command "${args.command}"`);
	}
}

main().catch((error: unknown) => {
	console.error(`error: ${error instanceof Error ? error.message : error}`);
	process.exitCode = 1;
});
