import { resolve } from "node:path";
import sharp from "sharp";
import { psnrRgba } from "./psnr.ts";

const USAGE = `asset-psnr — AVIF quality gate (P5)

Usage:
  asset-psnr --png <cutout.png> --avif <asset.avif> [--min 40]

Compares RGB where alpha > 0 (dimensions must match). Exit 1 when PSNR is below
--min (default 40 dB). Generate the reference PNG with asset:process --format png
in a temporary assets dir; never ship the PNG reference.`;

type Args = { png?: string; avif?: string; min: number; help: boolean };

function parseArgs(argv: string[]): Args {
	const args: Args = { min: 40, help: false };
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		switch (arg) {
			case "--png":
				args.png = argv[++i];
				break;
			case "--avif":
				args.avif = argv[++i];
				break;
			case "--min": {
				const value = Number(argv[++i]);
				if (!Number.isFinite(value) || value <= 0) {
					throw new Error("--min must be a positive number");
				}
				args.min = value;
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

async function rgba(path: string) {
	const { data, info } = await sharp(path)
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });
	return {
		data,
		width: info.width,
		height: info.height,
		channels: info.channels,
	};
}

async function main(): Promise<void> {
	const args = parseArgs(process.argv.slice(2));
	if (args.help) {
		console.log(USAGE);
		return;
	}
	if (!args.png || !args.avif) throw new Error("--png and --avif are required");
	const [reference, encoded] = await Promise.all([
		rgba(resolve(process.cwd(), args.png)),
		rgba(resolve(process.cwd(), args.avif)),
	]);
	const psnr = psnrRgba(reference, encoded);
	const value = Number.isFinite(psnr) ? psnr.toFixed(2) : "Infinity";
	console.log(`PSNR ${value} dB (min ${args.min}) — ${args.avif}`);
	if (psnr < args.min) {
		console.error(
			`AVIF quality gate failed (<${args.min} dB): re-encode at q90/q100 or keep PNG`,
		);
		process.exitCode = 1;
	}
}

main().catch((error: unknown) => {
	console.error(`error: ${error instanceof Error ? error.message : error}`);
	process.exitCode = 1;
});
