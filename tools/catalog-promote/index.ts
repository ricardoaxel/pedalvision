import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { toSlug } from "../catalog-transform/slug.ts";
import {
	type PromoteProvenance,
	promoteLegacy,
	type RuntimePedalLike,
} from "./promote.ts";
import { existingRawIds } from "./raw.ts";

const USAGE = `catalog-promote-legacy — legacy seed → raw-research scaffold (T-1)

Usage:
  catalog-promote-legacy --brand <brand> --ids <file> [--batch <slug>]
                         [--id <id> ...] [--out <file>] [--root <dir>]
                         [--provenance legacy|official]
                         [--source-url <url> | --source-urls <map.json>]
                         [--force] [--dry-run]

Copies existing legacy/runtime facts by id into a raw batch file under
data/catalog/research/pedals/<brand>/<batch>.json. No research, no image slot,
no planner URLs. Default provenance: legacy/pending-replacement.

--source-url is for exactly one id; --source-urls is a JSON map { id: url } for
a multi-item cleanup batch. The ids file is a JSON id array, {"ids": [...]}, or
a newline/comma list. The batch session still re-sources the asset (official or
generated flat art).
`;

type Args = {
	brand?: string;
	ids?: string;
	idsList: string[];
	batch?: string;
	out?: string;
	root: string;
	provenance: "legacy" | "official";
	sourceUrl?: string;
	sourceUrls?: string;
	force: boolean;
	dryRun: boolean;
	help: boolean;
};

function parseArgs(argv: string[]): Args {
	const args: Args = {
		idsList: [],
		root: process.cwd(),
		provenance: "legacy",
		force: false,
		dryRun: false,
		help: false,
	};
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		switch (arg) {
			case "--brand":
				args.brand = argv[++i];
				break;
			case "--ids":
				args.ids = argv[++i];
				break;
			case "--id":
				args.idsList.push(argv[++i]);
				break;
			case "--batch":
				args.batch = argv[++i];
				break;
			case "--out":
				args.out = argv[++i];
				break;
			case "--root":
				args.root = resolve(process.cwd(), argv[++i]);
				break;
			case "--provenance": {
				const value = argv[++i];
				if (value !== "legacy" && value !== "official") {
					throw new Error("--provenance must be legacy or official");
				}
				args.provenance = value;
				break;
			}
			case "--source-url":
				args.sourceUrl = argv[++i];
				break;
			case "--source-urls":
				args.sourceUrls = argv[++i];
				break;
			case "--force":
				args.force = true;
				break;
			case "--dry-run":
				args.dryRun = true;
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

async function readIds(path: string): Promise<string[]> {
	const text = await readFile(path, "utf8");
	try {
		const parsed = JSON.parse(text) as unknown;
		if (Array.isArray(parsed) && parsed.every((id) => typeof id === "string")) {
			return parsed;
		}
		if (
			typeof parsed === "object" &&
			parsed !== null &&
			Array.isArray((parsed as { ids?: unknown }).ids) &&
			(parsed as { ids: unknown[] }).ids.every((id) => typeof id === "string")
		) {
			return (parsed as { ids: string[] }).ids;
		}
		throw new Error(`${path}: expected a JSON id array or {"ids": [...]}`);
	} catch (error) {
		if (error instanceof SyntaxError) {
			return text
				.split(/[\n,]+/)
				.map((id) => id.trim())
				.filter(Boolean);
		}
		throw error;
	}
}

async function readJsonArray(path: string): Promise<unknown[]> {
	const parsed = JSON.parse(await readFile(path, "utf8")) as unknown;
	if (!Array.isArray(parsed)) throw new Error(`${path}: expected a JSON array`);
	return parsed;
}

async function readSourceUrls(path: string): Promise<Record<string, string>> {
	const parsed = JSON.parse(await readFile(path, "utf8")) as unknown;
	if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
		throw new Error(`${path}: --source-urls must be an object { id: url }`);
	}
	const urls: Record<string, string> = {};
	for (const [id, url] of Object.entries(parsed)) {
		if (typeof url !== "string") {
			throw new Error(`${path}: --source-urls[${id}] must be a URL string`);
		}
		urls[id] = url;
	}
	return urls;
}

async function fileExists(path: string): Promise<boolean> {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

async function main(): Promise<void> {
	const args = parseArgs(process.argv.slice(2));
	if (args.help) {
		console.log(USAGE);
		return;
	}
	if (!args.brand) throw new Error("--brand is required");
	if (!args.ids && args.idsList.length === 0) {
		throw new Error("--ids <file> or at least one --id is required");
	}

	const ids = [
		...(args.ids ? await readIds(resolve(args.ids)) : []),
		...args.idsList,
	];
	const uniqueIds = [...new Set(ids)];
	const brandKey = toSlug(args.brand);
	const batch = args.batch ?? `${brandKey}-cleanup-1`;
	if (!/^[a-z0-9][a-z0-9-]*$/.test(batch)) {
		throw new Error("--batch must be a lowercase hyphenated slug");
	}

	const outPath = args.out
		? resolve(process.cwd(), args.out)
		: resolve(
				args.root,
				"data/catalog/research/pedals",
				brandKey,
				`${batch}.json`,
			);

	const sourceUrls = args.sourceUrls
		? await readSourceUrls(resolve(process.cwd(), args.sourceUrls))
		: {};
	if (args.sourceUrl) {
		if (uniqueIds.length !== 1) {
			throw new Error(
				"--source-url requires exactly one id; use --source-urls <map.json> for a batch",
			);
		}
		sourceUrls[uniqueIds[0] as string] = args.sourceUrl;
	}
	if (args.provenance === "official" && Object.keys(sourceUrls).length === 0) {
		throw new Error(
			"--provenance official requires --source-url (one id) or --source-urls (map)",
		);
	}
	if (args.provenance === "legacy" && Object.keys(sourceUrls).length > 0) {
		throw new Error(
			"--source-url/--source-urls only apply to official provenance",
		);
	}
	const provenance: PromoteProvenance =
		args.provenance === "official"
			? { kind: "official", sourceUrls }
			: { kind: "legacy" };

	const runtime = (await readJsonArray(
		resolve(args.root, "src/catalog/data/pedals.json"),
	)) as RuntimePedalLike[];
	const legacy = (await readJsonArray(
		resolve(args.root, "data/catalog/legacy/pedals.json"),
	)) as RuntimePedalLike[];

	const result = promoteLegacy({
		brand: args.brand,
		ids,
		batch,
		runtime,
		legacy,
		provenance,
		// Skip the batch being rewritten so --force can regenerate it.
		existingRawIds: await existingRawIds(args.root, outPath),
	});

	if (args.dryRun) {
		console.log(JSON.stringify(result.records, null, 2));
		for (const warning of result.warnings) console.warn(`warning: ${warning}`);
		return;
	}

	if (!args.force && (await fileExists(outPath))) {
		throw new Error(`${outPath} already exists; pass --force to overwrite`);
	}
	await mkdir(dirname(outPath), { recursive: true });
	await writeFile(
		outPath,
		`${JSON.stringify(result.records, null, 2)}\n`,
		"utf8",
	);
	console.log(`promoted ${result.records.length} legacy item(s) → ${outPath}`);
	for (const warning of result.warnings) console.warn(`warning: ${warning}`);
}

main().catch((error: unknown) => {
	console.error(`error: ${error instanceof Error ? error.message : error}`);
	process.exitCode = 1;
});
