import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { renderBoardArt } from "./board-art.ts";

const USAGE = `asset-board-art — render a flat board SVG to committed AVIF (P5-03)

Usage:
  asset-board-art --input <source.svg> --id <catalog-id>
                  [--assets-dir public/pedal-assets]
                  [--quality 90] [--png-out <file.png>]

Writes <assets-dir>/boards/800/<id>.avif, /350/<id>.avif and a PNG reference.
Run asset:analyze + design reviewer + app QA afterwards. No reference pixels.
`;

type Args = {
	input?: string;
	id?: string;
	assetsDir?: string;
	quality?: number;
	pngOut?: string;
	help: boolean;
};

function parseArgs(argv: string[]): Args {
	const args: Args = { help: false };
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		switch (arg) {
			case "--input":
				args.input = argv[++i];
				break;
			case "--id":
				args.id = argv[++i];
				break;
			case "--assets-dir":
				args.assetsDir = argv[++i];
				break;
			case "--quality": {
				const value = Number(argv[++i]);
				if (!Number.isInteger(value) || value < 1 || value > 100) {
					throw new Error("--quality must be an integer 1-100");
				}
				args.quality = value;
				break;
			}
			case "--png-out":
				args.pngOut = argv[++i];
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

async function main(): Promise<void> {
	const args = parseArgs(process.argv.slice(2));
	if (args.help) {
		console.log(USAGE);
		return;
	}
	if (!args.input) throw new Error("--input is required");
	if (!args.id) throw new Error("--id is required");

	const result = await renderBoardArt(
		await readFile(resolve(process.cwd(), args.input)),
		args.id,
		{
			assetsDir: args.assetsDir,
			quality: args.quality,
			pngPath: args.pngOut,
		},
	);

	console.log(`png: ${result.pngPath}`);
	for (const rendition of result.renditions) {
		console.log(
			`${rendition.size}: ${rendition.path} (${rendition.bytes} bytes)`,
		);
	}
}

await main();
