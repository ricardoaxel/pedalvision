import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

/**
 * End-to-end checks of the CLI orchestration in `index.ts` — specifically the
 * ordering guarantee that a bad input is rejected BEFORE any file is written
 * (so a failed run can never leave orphan PNGs in the asset dirs). Runs the
 * real CLI in a child process, like an operator would.
 */

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
const indexPath = fileURLToPath(new URL("./index.ts", import.meta.url));

function runCli(args: string[]): void {
	execFileSync(
		process.execPath,
		["--experimental-strip-types", indexPath, ...args],
		{ cwd: repoRoot, stdio: "pipe" },
	);
}

async function writeRawPng(dir: string): Promise<string> {
	const width = 40;
	const height = 20;
	const data = Buffer.alloc(width * height * 4, 255);
	for (let y = 6; y < 14; y++) {
		for (let x = 8; x < 32; x++) {
			const i = (y * width + x) * 4;
			data[i] = 20;
			data[i + 1] = 40;
			data[i + 2] = 60;
		}
	}
	const path = join(dir, "raw.png");
	await sharp(data, { raw: { width, height, channels: 4 } })
		.png()
		.toFile(path);
	return path;
}

describe("asset-pipeline CLI", () => {
	it("writes both renditions and a draft on a valid run", async () => {
		const dir = mkdtempSync(join(tmpdir(), "pedalvision-cli-ok-"));
		try {
			const input = await writeRawPng(dir);
			const assets = join(dir, "out");
			runCli([
				"--input",
				input,
				"--brand",
				"Acme",
				"--name",
				"Big Fuzz",
				"--width-cm",
				"6",
				"--height-cm",
				"10",
				"--assets-dir",
				assets,
				"--draft",
				join(dir, "draft.json"),
			]);
			expect(existsSync(join(assets, "pedals/800/acme-big-fuzz.png"))).toBe(
				true,
			);
			expect(existsSync(join(assets, "pedals/350/acme-big-fuzz.png"))).toBe(
				true,
			);
			expect(existsSync(join(dir, "draft.json"))).toBe(true);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	}, 30_000);

	it("rejects a schema-invalid --id before writing any PNGs", () => {
		const dir = mkdtempSync(join(tmpdir(), "pedalvision-cli-bad-"));
		try {
			const assets = join(dir, "out");
			// "a--b" passes IMAGE_PATTERN but fails the catalog ID_PATTERN, so it
			// is only caught by the draft validation — which must run pre-write.
			expect(() =>
				runCli([
					"--input",
					join(dir, "does-not-exist.png"),
					"--brand",
					"Acme",
					"--name",
					"Big Fuzz",
					"--id",
					"a--b",
					"--width-cm",
					"6",
					"--height-cm",
					"10",
					"--assets-dir",
					assets,
				]),
			).toThrow();
			// No orphan asset dir / PNGs were created.
			expect(existsSync(assets)).toBe(false);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	}, 30_000);
});
