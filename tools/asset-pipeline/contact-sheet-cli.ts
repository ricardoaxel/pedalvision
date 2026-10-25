import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { buildContactSheet, type ContactSheetItem } from "./contact-sheet.ts";

const USAGE = `asset-contact-sheet — vision QA contact sheet (P5-02)

Usage:
  asset-contact-sheet --images <manifest.json> --out <sheet.png>
                      [--columns 5] [--cell 240]

The manifest is a JSON array or {"items": [...]} of { "id", "image" }.
10–30 images per call; the sidecar <sheet>.json maps every grid cell back to
the catalog id and source hash. Never call vision per image.`;

type Args = {
	images?: string;
	out?: string;
	columns: number;
	cell: number;
	help: boolean;
};

function readNumber(argv: string[], index: number, flag: string): number {
	const value = Number(argv[index + 1]);
	if (!Number.isInteger(value) || value <= 0) {
		throw new Error(`${flag} must be a positive integer`);
	}
	return value;
}

function parseArgs(argv: string[]): Args {
	const args: Args = { columns: 5, cell: 240, help: false };
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		switch (arg) {
			case "--images":
				args.images = argv[++i];
				break;
			case "--out":
				args.out = argv[++i];
				break;
			case "--columns":
				args.columns = readNumber(argv, i, arg);
				i++;
				break;
			case "--cell":
				args.cell = readNumber(argv, i, arg);
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

async function readManifest(path: string): Promise<ContactSheetItem[]> {
	const parsed = JSON.parse(await readFile(path, "utf8")) as unknown;
	const items = Array.isArray(parsed)
		? parsed
		: (parsed as { items?: unknown }).items;
	if (!Array.isArray(items))
		throw new Error(`${path}: expected an array of items`);
	return items.map((item) => {
		if (
			typeof item !== "object" ||
			item === null ||
			typeof (item as ContactSheetItem).id !== "string" ||
			typeof (item as ContactSheetItem).image !== "string"
		) {
			throw new Error(`${path}: each item needs { id, image }`);
		}
		return {
			id: (item as ContactSheetItem).id,
			image: resolve((item as ContactSheetItem).image),
		};
	});
}

async function main(): Promise<void> {
	const args = parseArgs(process.argv.slice(2));
	if (args.help) {
		console.log(USAGE);
		return;
	}
	if (!args.images || !args.out) {
		throw new Error("--images and --out are required");
	}
	const items = await readManifest(resolve(process.cwd(), args.images));
	const sheet = await buildContactSheet(items, {
		columns: args.columns,
		cell: args.cell,
	});
	const out = resolve(process.cwd(), args.out);
	await mkdir(dirname(out), { recursive: true });
	await writeFile(out, sheet.png);
	const sidecar = out.replace(/\.png$/i, ".json");
	await writeFile(sidecar, `${JSON.stringify(sheet.manifest, null, 2)}\n`);
	console.log(`wrote ${out} (${items.length} images)`);
	console.log(`wrote ${sidecar}`);
}

main().catch((error: unknown) => {
	console.error(`error: ${error instanceof Error ? error.message : error}`);
	process.exitCode = 1;
});
