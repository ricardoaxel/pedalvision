import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { sampleBoardColor } from "./board-color.ts";

const USAGE = `asset-board-color — sample a reference board color (P5-03)

Usage:
  asset-board-color --input <reference-image> [--out <file.json>]
                    [--tolerance <0-255>]

Prints the median/average opaque board color and hex. Use the median hex in the
generated board SVG so the art matches the reference. Transparent references are
supported (alpha-0 corners are treated as a transparent background).
`;

type Args = {
	input?: string;
	out?: string;
	tolerance?: number;
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
			case "--out":
				args.out = argv[++i];
				break;
			case "--tolerance": {
				const value = Number(argv[++i]);
				if (!Number.isInteger(value) || value < 0 || value > 255) {
					throw new Error("--tolerance must be an integer 0-255");
				}
				args.tolerance = value;
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

async function main(): Promise<void> {
	const args = parseArgs(process.argv.slice(2));
	if (args.help) {
		console.log(USAGE);
		return;
	}
	if (!args.input) throw new Error("--input is required");
	const input = resolve(process.cwd(), args.input);
	const result = {
		...(await sampleBoardColor(await readFile(input), {
			tolerance: args.tolerance,
		})),
		input: args.input,
	};
	const json = `${JSON.stringify(result, null, 2)}\n`;
	if (args.out) {
		const out = resolve(process.cwd(), args.out);
		await mkdir(dirname(out), { recursive: true });
		await writeFile(out, json);
		console.log(`wrote ${args.out}`);
	} else {
		process.stdout.write(json);
	}
	console.error(
		`board color: ${result.median.hex} (median) · ${result.samples} samples`,
	);
}

await main();
