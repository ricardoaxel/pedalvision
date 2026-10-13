import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { SOURCE_TAGS, type SourceTag } from "../../src/catalog/schema.ts";
import { convertExternalCatalog, type ExternalCatalog } from "./convert.ts";
import { writeSeed } from "./seed.ts";

/**
 * `tools/catalog-transform` — a one-off dev CLI (ADR-003).
 *
 *   # Convert an external catalog JSON into our schema
 *   node --experimental-strip-types tools/catalog-transform/index.ts \
 *     --input external.json --output src/catalog/data/pedals.json \
 *     --source placeholder
 *
 *   # Generate the committed synthetic seed JSON + procedural PNGs
 *   node --experimental-strip-types tools/catalog-transform/index.ts --seed
 *
 * Provenance rule (binding): never name or link a third-party dataset here or in
 * any output. Input/output paths are always explicit CLI args.
 */

const DEFAULTS = {
	outDir: "src/catalog/data",
	assetsDir: "public/pedal-assets",
	source: "placeholder" as SourceTag,
};

type Args = {
	seed: boolean;
	input?: string;
	output?: string;
	outDir: string;
	assetsDir: string;
	source: SourceTag;
	help: boolean;
};

function parseArgs(argv: string[]): Args {
	const args: Args = {
		seed: false,
		outDir: DEFAULTS.outDir,
		assetsDir: DEFAULTS.assetsDir,
		source: DEFAULTS.source,
		help: false,
	};

	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		switch (arg) {
			case "--seed":
				args.seed = true;
				break;
			case "--input":
				args.input = argv[++i];
				break;
			case "--output":
				args.output = argv[++i];
				break;
			case "--out-dir":
				args.outDir = argv[++i];
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

const USAGE = `catalog-transform — external catalog → our schema, plus the synthetic seed

Usage:
  --seed                       Generate the synthetic seed JSON + procedural PNGs
  --input <file>               External catalog JSON (required unless --seed)
  --output <file>              Output JSON path (required with --input)
  --source <tag>               Provenance tag: ${SOURCE_TAGS.join(" | ")}
  --out-dir <dir>              Seed JSON dir (default: ${DEFAULTS.outDir})
  --assets-dir <dir>           PNG dir (default: ${DEFAULTS.assetsDir})
  --help                       Show this help`;

async function runSeed(args: Args): Promise<void> {
	const outDir = resolve(process.cwd(), args.outDir);
	const assetsDir = resolve(process.cwd(), args.assetsDir);
	const summary = await writeSeed(outDir, assetsDir);
	console.log(
		`seed: wrote ${summary.pedals} pedals, ${summary.boards} boards, ${summary.images} PNGs`,
	);
	console.log(`  json → ${outDir}`);
	console.log(`  pngs → ${assetsDir}`);
}

async function runConvert(args: Args): Promise<void> {
	if (!args.input || !args.output) {
		throw new Error("--input and --output are required (or use --seed)");
	}

	const inputPath = resolve(process.cwd(), args.input);
	const outputPath = resolve(process.cwd(), args.output);
	const raw = await readFile(inputPath, "utf8");
	const external = JSON.parse(raw) as ExternalCatalog;

	const { pedals, warnings } = convertExternalCatalog(external, {
		source: args.source,
		warn: (message) => console.warn(`warn: ${message}`),
	});

	await mkdir(dirname(outputPath), { recursive: true });
	await writeFile(outputPath, `${JSON.stringify(pedals, null, 2)}\n`);
	console.log(`converted ${pedals.length} pedals → ${outputPath}`);
	if (warnings.length > 0) console.log(`  ${warnings.length} warning(s)`);
}

async function main(): Promise<void> {
	const args = parseArgs(process.argv.slice(2));
	if (args.help) {
		console.log(USAGE);
		return;
	}
	if (args.seed) {
		await runSeed(args);
		return;
	}
	if (args.input) {
		await runConvert(args);
		return;
	}
	console.log(USAGE);
	process.exitCode = 1;
}

main().catch((error: unknown) => {
	console.error(`error: ${error instanceof Error ? error.message : error}`);
	process.exitCode = 1;
});
