import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { renderPedalArt } from "./render.ts";

const USAGE = `asset-pedal-art — render a Catalog Specimen art spec to AVIF (P5-03c)

Usage:
  asset-pedal-art --spec <file.json> [--assets-dir public/pedal-assets]
                  [--quality 90] [--png-out <file.png>] [--svg-out <file.svg>]

Writes <assets-dir>/pedals/800/<id>.avif, /350/<id>.avif, a PNG + SVG reference
under work/catalog/pedal-art/, and prints the paths. Reference pixels never ship.
Run asset:analyze + the design/visual review afterwards.

Spec schema + SOP: docs/catalog/pedal-art.md.
`;

type Args = {
	spec?: string;
	assetsDir?: string;
	quality?: number;
	pngOut?: string;
	svgOut?: string;
	help: boolean;
};

function parseArgs(argv: string[]): Args {
	const args: Args = { help: false };
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		switch (arg) {
			case "--spec":
				args.spec = argv[++i];
				break;
			case "--assets-dir":
				args.assetsDir = argv[++i];
				break;
			case "--quality": {
				const value = Number(argv[++i]);
				if (!Number.isInteger(value) || value < 1 || value > 100) {
					throw new Error("--quality must be an integer 1–100");
				}
				args.quality = value;
				break;
			}
			case "--png-out":
				args.pngOut = argv[++i];
				break;
			case "--svg-out":
				args.svgOut = argv[++i];
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
	if (!args.spec) throw new Error("--spec is required");

	const specPath = resolve(process.cwd(), args.spec);
	const spec = JSON.parse(await readFile(specPath, "utf8")) as unknown;
	const result = await renderPedalArt(spec, {
		assetsDir: args.assetsDir,
		quality: args.quality,
		pngPath: args.pngOut,
		svgPath: args.svgOut,
	});

	console.log(`spec: ${specPath}`);
	console.log(`png:  ${result.pngPath}`);
	console.log(`svg:  ${result.svgPath}`);
	for (const rendition of result.renditions) {
		console.log(
			`${rendition.size}: ${rendition.path} (${rendition.bytes} bytes)`,
		);
	}
}

main().catch((error: unknown) => {
	console.error(`error: ${error instanceof Error ? error.message : error}`);
	process.exitCode = 1;
});
