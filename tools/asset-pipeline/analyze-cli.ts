import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { analyzeImage } from "./analyze.ts";
import { findCached, hashBytes, readQaCache, recordQa } from "./qa-cache.ts";

const USAGE = `asset-analyze — deterministic image quality report (P5-02)

Usage:
  asset-analyze --input <image> --width-cm <n> --height-cm <n>
                [--kind pedal|board] [--id <catalog-id>] [--tolerance <0-255>]
                [--cache <file>] [--batch <batch-id>] [--out <report.json>]

Checks: min 800px long edge, background uniformity, alpha, trim bbox,
aspect vs the cm footprint (<=10% pass, 10-15% flag, >15% reject),
rotation/skew >2°, shadow/perspective signals, board top-down signals.
No AI. No downloads.`;

type Args = {
	input?: string;
	widthCm?: number;
	heightCm?: number;
	kind: "pedal" | "board";
	id?: string;
	tolerance?: number;
	cache?: string;
	batch?: string;
	out?: string;
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
	const args: Args = { kind: "pedal", help: false };
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		switch (arg) {
			case "--input":
				args.input = argv[++i];
				break;
			case "--width-cm":
				args.widthCm = readNumber(argv, i, arg);
				i++;
				break;
			case "--height-cm":
				args.heightCm = readNumber(argv, i, arg);
				i++;
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
			case "--tolerance": {
				const value = Number(argv[++i]);
				if (!Number.isInteger(value) || value < 0 || value > 255) {
					throw new Error("--tolerance must be an integer 0-255");
				}
				args.tolerance = value;
				break;
			}
			case "--cache":
				args.cache = argv[++i];
				break;
			case "--batch":
				args.batch = argv[++i];
				break;
			case "--out":
				args.out = argv[++i];
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

function defaultCachePath(batch: string): string {
	const work = process.env.CATALOG_WORK_DIR ?? "work/catalog";
	return resolve(work, "image-qa", `${batch.replaceAll("/", "__")}.json`);
}

async function main(): Promise<void> {
	const args = parseArgs(process.argv.slice(2));
	if (args.help) {
		console.log(USAGE);
		return;
	}
	if (!args.input) throw new Error("--input <image> is required");
	if (args.widthCm === undefined || args.heightCm === undefined) {
		throw new Error("--width-cm and --height-cm are required");
	}
	const inputPath = resolve(process.cwd(), args.input);
	const input = await readFile(inputPath);
	const id =
		args.id ?? basename(args.input, ".png").replace(/\.(jpg|jpeg|webp)$/i, "");
	const sha256 = hashBytes(input);
	const cachePath =
		args.cache ?? (args.batch ? defaultCachePath(args.batch) : undefined);
	const cached = cachePath
		? findCached(await readQaCache(cachePath, args.batch ?? id), sha256)
		: undefined;

	const report = await analyzeImage(input, {
		kind: args.kind,
		widthCm: args.widthCm,
		heightCm: args.heightCm,
		tolerance: args.tolerance,
	});
	const output = {
		...report,
		id,
		sha256,
		cached: Boolean(cached),
		...(cached
			? {
					verdict: cached.verdict,
					reasons: cached.reasons,
					reviewedAt: cached.reviewedAt,
				}
			: {}),
	};

	if (cachePath && !cached) {
		await recordQa(cachePath, args.batch ?? id, id, {
			sha256,
			verdict: report.verdict,
			reasons: report.reasons,
			reviewedAt: new Date().toISOString(),
			reviewer: "analyzer",
		});
	}

	if (args.out) {
		const path = resolve(process.cwd(), args.out);
		await mkdir(dirname(path), { recursive: true });
		await writeFile(path, `${JSON.stringify(output, null, 2)}\n`);
		console.error(`wrote ${path}`);
	} else {
		console.log(JSON.stringify(output, null, 2));
	}
	console.error(
		`${id}: ${output.verdict}${output.reasons.length ? ` — ${output.reasons.join(" | ")}` : ""}`,
	);
	if (output.verdict === "reject") process.exitCode = 2;
}

main().catch((error: unknown) => {
	console.error(`error: ${error instanceof Error ? error.message : error}`);
	process.exitCode = 1;
});
