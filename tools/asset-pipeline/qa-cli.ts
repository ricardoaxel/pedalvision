import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { hashBytes, type QaVerdict, recordQa } from "./qa-cache.ts";

const USAGE = `asset-qa — record a cached image QA verdict (P5-02)

Usage:
  asset-qa --id <catalog-id> --verdict accept|flag|reject --reason <text>
           [--reason <text>...] [--image <file> | --sha <sha256>]
           [--batch <batch-id>] [--cache <file>] [--reviewer <name>]

Writes work/catalog/image-qa/<batch>.json by default. The contact-sheet
reviewer returns verdicts; the coordinator records them here so an image is
never re-reviewed unnecessarily.`;

type Args = {
	id?: string;
	verdict?: QaVerdict;
	reasons: string[];
	image?: string;
	sha?: string;
	batch?: string;
	cache?: string;
	reviewer: string;
	help: boolean;
};

function parseArgs(argv: string[]): Args {
	const args: Args = { reasons: [], reviewer: "contact-sheet", help: false };
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		switch (arg) {
			case "--id":
				args.id = argv[++i];
				break;
			case "--verdict": {
				const value = argv[++i];
				if (value !== "accept" && value !== "flag" && value !== "reject") {
					throw new Error("--verdict must be accept|flag|reject");
				}
				args.verdict = value;
				break;
			}
			case "--reason":
				args.reasons.push(argv[++i] ?? "");
				break;
			case "--image":
				args.image = argv[++i];
				break;
			case "--sha":
				args.sha = argv[++i];
				break;
			case "--batch":
				args.batch = argv[++i];
				break;
			case "--cache":
				args.cache = argv[++i];
				break;
			case "--reviewer":
				args.reviewer = argv[++i] ?? "contact-sheet";
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
	if (!args.id || !args.verdict) {
		throw new Error("--id and --verdict are required");
	}
	if (!args.cache && !args.batch) {
		throw new Error("--batch or --cache is required");
	}
	const sha = args.image
		? hashBytes(await readFile(resolve(process.cwd(), args.image)))
		: args.sha;
	if (!sha) throw new Error("--image or --sha is required");
	const batch = args.batch ?? args.id;
	const cache = args.cache ?? defaultCachePath(batch);
	await recordQa(cache, batch, args.id, {
		sha256: sha,
		verdict: args.verdict,
		reasons: args.reasons,
		reviewedAt: new Date().toISOString(),
		reviewer: args.reviewer,
	});
	console.log(`cached ${args.verdict} for ${args.id} → ${cache}`);
}

main().catch((error: unknown) => {
	console.error(`error: ${error instanceof Error ? error.message : error}`);
	process.exitCode = 1;
});
