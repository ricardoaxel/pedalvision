import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { buildCatalog, buildForCi, checkDrift } from "./build.ts";
import { formatCounts } from "./caps.ts";
import { runDryRun } from "./dry-run.ts";
import { formatGuardViolations, guardBatchPr } from "./guard.ts";
import { formatIssues, validateCatalog } from "./validate.ts";

const USAGE = `catalog-pipeline — P5 batch build, validation and quality gates

Usage:
  catalog-pipeline build [--root <dir>] [--temp-dir <dir>]
  catalog-pipeline validate [--catalog-dir <dir>] [--assets-dir <dir>]
                           [--json <file>] [--skip-assets] [--skip-caps]
  catalog-pipeline check [--root <dir>]
  catalog-pipeline ci [--root <dir>]
  catalog-pipeline post-merge [--root <dir>]
  catalog-pipeline guard-batch-pr [--base <ref>]
  catalog-pipeline dry-run [--root <dir>]
  --help

Build flow: legacy baseline (data/catalog/legacy) + raw batches
(data/catalog/research/**) -> mapped (data/catalog/{pedals,boards}/**)
+ runtime (src/catalog/data/*.json) + registry (data/catalog/registry.json).
Brand agents never edit the generated mapped/runtime files.`;

type Args = {
	command: string;
	root: string;
	tempDir?: string;
	catalogDir?: string;
	assetsDir?: string;
	json?: string;
	skipAssets: boolean;
	skipCaps: boolean;
	base: string;
	help: boolean;
};

function parseArgs(argv: string[]): Args {
	const args: Args = {
		command: argv[0] ?? "",
		root: process.cwd(),
		skipAssets: false,
		skipCaps: false,
		base: "origin/main",
		help: false,
	};
	for (let i = 1; i < argv.length; i++) {
		const arg = argv[i];
		switch (arg) {
			case "--root":
				args.root = resolve(process.cwd(), argv[++i]);
				break;
			case "--temp-dir":
				args.tempDir = resolve(process.cwd(), argv[++i]);
				break;
			case "--catalog-dir":
				args.catalogDir = resolve(process.cwd(), argv[++i]);
				break;
			case "--assets-dir":
				args.assetsDir = resolve(process.cwd(), argv[++i]);
				break;
			case "--json":
				args.json = resolve(process.cwd(), argv[++i]);
				break;
			case "--skip-assets":
				args.skipAssets = true;
				break;
			case "--skip-caps":
				args.skipCaps = true;
				break;
			case "--base":
				args.base = argv[++i];
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

async function runBuild(args: Args): Promise<void> {
	const result = await buildCatalog({
		root: args.root,
		outRoot: args.tempDir,
	});
	console.log(
		`catalog build: ${result.pedals.length} pedals / ${result.boards.length} boards from ${result.batches.length} raw batch(es)`,
	);
	console.log(`  mapped   → ${resolve(result.outRoot, "data/catalog")}`);
	console.log(`  runtime  → ${resolve(result.outRoot, "src/catalog/data")}`);
	console.log(
		`  registry → ${resolve(result.outRoot, "data/catalog/registry.json")}`,
	);
}

async function runValidate(args: Args): Promise<void> {
	const result = await validateCatalog({
		catalogDir: args.catalogDir ?? resolve(args.root, "src/catalog/data"),
		assetsDir: args.assetsDir ?? resolve(args.root, "public/pedal-assets"),
		checkAssets: !args.skipAssets,
		checkCaps: !args.skipCaps,
	});
	if (args.json) {
		await mkdir(dirname(args.json), { recursive: true });
		await writeFile(
			args.json,
			`${JSON.stringify(
				{
					version: 1,
					pedals: result.pedals.length,
					boards: result.boards.length,
					counts: result.counts,
					issues: result.issues,
				},
				null,
				2,
			)}\n`,
		);
	}
	if (result.issues.length > 0) {
		console.error("catalog validation failed:");
		console.error(formatIssues(result.issues));
		process.exitCode = 1;
		return;
	}
	console.log(
		`catalog valid: ${result.pedals.length} pedals / ${result.boards.length} boards`,
	);
	if (result.counts) console.log(`  ${formatCounts(result.counts)}`);
}

async function runCheck(args: Args): Promise<void> {
	const result = await checkDrift({ root: args.root });
	if (!result.ok) {
		console.error("catalog drift detected — run `pnpm catalog:build`:");
		for (const line of result.drift) console.error(`  ${line}`);
		process.exitCode = 1;
		return;
	}
	console.log(
		"catalog drift check: clean (mapped + runtime + registry are current)",
	);
}

async function runCi(args: Args): Promise<void> {
	const result = await buildForCi({ root: args.root });
	console.log(
		`catalog ci: validated ${result.pedals.length} pedals / ${result.boards.length} boards; uncommitted runtime updated for the app/Playwright`,
	);
}

async function runPostMerge(args: Args): Promise<void> {
	await runBuild(args);
	const check = await checkDrift({ root: args.root });
	if (!check.ok) {
		console.error("post-merge drift check failed:");
		for (const line of check.drift) console.error(`  ${line}`);
		process.exitCode = 1;
		return;
	}
	console.log("post-merge build: deterministic (drift check clean)");
}

function changedFiles(base: string): string[] {
	try {
		const output = execFileSync(
			"git",
			["diff", "--name-only", `${base}...HEAD`],
			{ encoding: "utf8" },
		);
		return output
			.split("\n")
			.map((line) => line.trim())
			.filter(Boolean);
	} catch (error) {
		throw new Error(
			`could not diff against "${base}" (${error instanceof Error ? error.message : error})`,
		);
	}
}

async function runGuard(args: Args): Promise<void> {
	const violations = guardBatchPr(changedFiles(args.base));
	if (violations.length > 0) {
		console.error(formatGuardViolations(violations));
		process.exitCode = 1;
		return;
	}
	console.log("batch PR guard: clean (raw records + assets only)");
}

async function main(): Promise<void> {
	const args = parseArgs(process.argv.slice(2));
	if (args.help || !args.command) {
		console.log(USAGE);
		if (!args.command) process.exitCode = 1;
		return;
	}
	switch (args.command) {
		case "build":
			await runBuild(args);
			return;
		case "validate":
			await runValidate(args);
			return;
		case "check":
			await runCheck(args);
			return;
		case "ci":
			await runCi(args);
			return;
		case "post-merge":
			await runPostMerge(args);
			return;
		case "guard-batch-pr":
			await runGuard(args);
			return;
		case "dry-run":
			await runDryRun(args.root);
			return;
		default:
			throw new Error(`unknown command "${args.command}"`);
	}
}

main().catch((error: unknown) => {
	console.error(`error: ${error instanceof Error ? error.message : error}`);
	process.exitCode = 1;
});
