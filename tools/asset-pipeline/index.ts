import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { SOURCE_TAGS, type SourceTag } from "../../src/catalog/schema.ts";
import { analyzeImage } from "./analyze.ts";
import { buildDraftEntry, type DraftInput } from "./draft.ts";
import {
	type AssetKind,
	imageFilename,
	outputPath,
	RENDITIONS,
	slugId,
} from "./naming.ts";
import { DEFAULT_TOLERANCE, renderRenditions } from "./render.ts";

let writeSequence = 0;

/**
 * `tools/asset-pipeline` — a dev-only CLI (P2-04).
 *
 * Turns a raw top-down image into the two committed renditions the app serves,
 * plus a JSON draft catalog entry:
 *
 *   node --experimental-strip-types tools/asset-pipeline/index.ts \
 *     --input raw.png --kind pedal --brand "BOSS" --name "TR-2 Tremolo" \
 *     --width-cm 7.3 --height-cm 12.9
 *
 * It writes `public/pedal-assets/{pedals,boards}/{800,350}/<slug>.png` and prints
 * the draft (or writes it with `--draft <file>`). Rights-first: it only processes a
 * file the operator already has the right to use — no download, no scraping
 * (ADR-003). Provenance is never named here.
 */

const DEFAULTS = {
	kind: "pedal" as AssetKind,
	assetsDir: "public/pedal-assets",
	source: "placeholder" as SourceTag,
	category: "pedal" as const,
	tolerance: DEFAULT_TOLERANCE,
};

const USAGE = `asset-pipeline — raw image → committed renditions (800/350) + a catalog draft

Usage:
  asset-pipeline --input <raw.png> --brand <brand> --name <name>
                 --width-cm <n> --height-cm <n>
                 [--kind pedal|board] [--id <slug>] [--category pedal|supply]
                 [--source <tag>] [--variant-of <id>]
                 [--assets-dir <dir>] [--draft <file>] [--tolerance <0-255>]
                 [--matte flood|soft] [--analyze <report.json>] [--force]
  --help

Writes:
  <assets-dir>/<pedals|boards>/{800,350}/<id>.png
  a one-entry JSON array draft (stdout, or --draft <file>)

Source tags: ${SOURCE_TAGS.join(" | ")}
The draft is catalog-shaped (imageSource "static"); merge it into
src/catalog/data/{pedals,boards}.json, then re-run \`catalog:seed\` — the seed
prunes asset-dir PNGs the catalog does not reference.`;

type Args = {
	input?: string;
	kind: AssetKind;
	id?: string;
	brand?: string;
	name?: string;
	widthCm?: number;
	heightCm?: number;
	category: "pedal" | "supply";
	categoryProvided: boolean;
	source: SourceTag;
	variantOf?: string;
	assetsDir: string;
	draft?: string;
	tolerance: number;
	matte: "flood" | "soft";
	analyze?: string;
	force: boolean;
	help: boolean;
};

function readNumber(argv: string[], index: number, flag: string): number {
	const raw = argv[index + 1];
	const value = Number(raw);
	if (!Number.isFinite(value) || value <= 0) {
		throw new Error(`${flag} must be a positive number (got "${raw}")`);
	}
	return value;
}

function parseArgs(argv: string[]): Args {
	const args: Args = {
		kind: DEFAULTS.kind,
		category: DEFAULTS.category,
		categoryProvided: false,
		source: DEFAULTS.source,
		assetsDir: DEFAULTS.assetsDir,
		tolerance: DEFAULTS.tolerance,
		matte: "flood",
		force: false,
		help: false,
	};
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		switch (arg) {
			case "--input":
				args.input = argv[++i];
				break;
			case "--kind": {
				const value = argv[++i];
				if (value !== "pedal" && value !== "board") {
					throw new Error(`--kind must be pedal|board (got "${value}")`);
				}
				args.kind = value;
				break;
			}
			case "--id":
				args.id = argv[++i];
				break;
			case "--brand":
				args.brand = argv[++i];
				break;
			case "--name":
				args.name = argv[++i];
				break;
			case "--width-cm":
				args.widthCm = readNumber(argv, i, arg);
				i++;
				break;
			case "--height-cm":
				args.heightCm = readNumber(argv, i, arg);
				i++;
				break;
			case "--category": {
				const value = argv[++i];
				if (value !== "pedal" && value !== "supply") {
					throw new Error(`--category must be pedal|supply (got "${value}")`);
				}
				args.category = value;
				args.categoryProvided = true;
				break;
			}
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
			case "--variant-of":
				args.variantOf = argv[++i];
				break;
			case "--assets-dir":
				args.assetsDir = argv[++i];
				break;
			case "--draft":
				args.draft = argv[++i];
				break;
			case "--tolerance": {
				const value = Number(argv[++i]);
				if (!Number.isInteger(value) || value < 0 || value > 255) {
					throw new Error(`--tolerance must be an integer 0-255`);
				}
				args.tolerance = value;
				break;
			}
			case "--matte": {
				const value = argv[++i];
				if (value !== "flood" && value !== "soft") {
					throw new Error(`--matte must be flood|soft (got "${value}")`);
				}
				args.matte = value;
				break;
			}
			case "--analyze":
				args.analyze = argv[++i];
				break;
			case "--force":
				args.force = true;
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

async function writeFileAtomic(path: string, content: Buffer): Promise<void> {
	const temp = `${path}.tmp-${process.pid}-${writeSequence++}`;
	await writeFile(temp, content);
	await rename(temp, path);
}

/** The catalog id: an explicit `--id`, else a slug of brand + name. */
function resolveId(args: Args): string {
	if (!args.brand || !args.name) {
		throw new Error("--brand and --name are required");
	}
	return args.id ?? slugId(args.brand, args.name);
}

async function main(): Promise<void> {
	const args = parseArgs(process.argv.slice(2));
	if (args.help) {
		console.log(USAGE);
		return;
	}
	if (!args.input) throw new Error("--input <raw image> is required");
	if (args.kind === "board" && args.variantOf) {
		throw new Error("--variant-of is pedal-only");
	}
	if (args.kind === "board" && args.categoryProvided) {
		throw new Error("--category is pedal-only");
	}
	if (args.widthCm === undefined || args.heightCm === undefined) {
		throw new Error(
			"--width-cm and --height-cm are required (the true footprint)",
		);
	}

	const id = resolveId(args);
	const filename = imageFilename(id);
	const assetsDir = resolve(process.cwd(), args.assetsDir);

	// Validate the draft (id, brand/name, footprint) BEFORE touching the
	// filesystem, so an invalid id never leaves orphan PNGs behind.
	const draftInput: DraftInput = {
		kind: args.kind,
		id,
		brand: args.brand as string,
		name: args.name as string,
		widthCm: args.widthCm,
		heightCm: args.heightCm,
		source: args.source,
		variantOf: args.variantOf,
		...(args.kind === "pedal" ? { category: args.category } : {}),
	};
	const draft = `${JSON.stringify([buildDraftEntry(draftInput)], null, 2)}\n`;

	const input = await readFile(resolve(process.cwd(), args.input));

	if (args.analyze) {
		const report = await analyzeImage(input, {
			kind: args.kind,
			widthCm: args.widthCm,
			heightCm: args.heightCm,
			tolerance: args.tolerance,
		});
		const path = resolve(process.cwd(), args.analyze);
		await mkdir(dirname(path), { recursive: true });
		await writeFile(path, `${JSON.stringify(report, null, 2)}\n`);
		console.error(
			`analyzer: ${report.verdict}${report.reasons.length ? ` — ${report.reasons.join(" | ")}` : ""}`,
		);
		if (report.verdict === "reject" && !args.force) {
			throw new Error(
				"image rejected by the analyzer (use --force only for a deliberate manual override)",
			);
		}
	}

	const renditions = await renderRenditions(input, {
		tolerance: args.tolerance,
		matte: args.matte,
	});

	for (const size of RENDITIONS) {
		const path = outputPath(assetsDir, args.kind, size, filename);
		await mkdir(dirname(path), { recursive: true });
		await writeFileAtomic(path, renditions[size]);
		// Progress on stderr so a piped stdout stays valid JSON (draft only).
		console.error(`wrote ${path}`);
	}

	if (args.draft) {
		const path = resolve(process.cwd(), args.draft);
		await mkdir(dirname(path), { recursive: true });
		await writeFileAtomic(path, Buffer.from(draft));
		console.error(`wrote draft ${path}`);
	} else {
		console.log(draft);
	}
}

main().catch((error: unknown) => {
	console.error(`error: ${error instanceof Error ? error.message : error}`);
	process.exitCode = 1;
});
