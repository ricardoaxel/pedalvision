import { createHash } from "node:crypto";
import type { Dirent } from "node:fs";
import {
	copyFile,
	cp,
	mkdir,
	mkdtemp,
	readdir,
	readFile,
	rm,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import sharp from "sharp";
import {
	checkpoint,
	pauseBatch,
	resumeBatch,
	startBatch,
	stopAll,
	stopBatch,
} from "../catalog-runner/runner.ts";
import { renderStatus } from "../catalog-runner/status.ts";
import { buildCatalog } from "./build.ts";
import { validateCatalog } from "./validate.ts";

/**
 * P5-02 dry run: three synthetic pedals through the build, then three fake
 * batches through the control plane. No downloads, no real catalog assets, and
 * all generated output stays in a temp directory.
 */

const PEDALS = [
	{
		id: "acme-alpha-drive",
		brand: "Acme",
		name: "Alpha Drive",
		category: "pedal",
		effectTypes: ["overdrive"],
		widthCm: 6,
		heightCm: 10,
		sources: [
			{ url: "https://example.com/acme-alpha-drive", kind: ["info", "image"] },
		],
	},
	{
		id: "acme-beta-fuzz",
		brand: "Acme",
		name: "Beta Fuzz",
		category: "pedal",
		effectTypes: ["fuzz"],
		widthCm: 7,
		heightCm: 11,
		sources: [
			{ url: "https://example.com/acme-beta-fuzz", kind: ["info", "image"] },
		],
	},
	{
		id: "acme-gamma-delay",
		brand: "Acme",
		name: "Gamma Delay",
		category: "pedal",
		effectTypes: ["delay"],
		widthCm: 7.5,
		heightCm: 12,
		sources: [
			{ url: "https://example.com/acme-gamma-delay", kind: ["info", "image"] },
		],
	},
];

async function writeJson(path: string, value: unknown): Promise<void> {
	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function syntheticPng(path: string): Promise<void> {
	await mkdir(dirname(path), { recursive: true });
	await sharp({
		create: {
			width: 8,
			height: 8,
			channels: 4,
			background: { r: 0, g: 0, b: 0, alpha: 0 },
		},
	})
		.png()
		.toFile(path);
}

async function hashFile(path: string): Promise<string> {
	try {
		return createHash("sha256")
			.update(await readFile(path))
			.digest("hex");
	} catch {
		return "missing";
	}
}

async function hashTree(path: string): Promise<string> {
	const parts: string[] = [];
	async function walk(base: string, prefix: string): Promise<void> {
		let entries: Dirent[];
		try {
			entries = await readdir(base, { withFileTypes: true });
		} catch {
			return;
		}
		for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
			const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
			if (entry.isDirectory()) await walk(join(base, entry.name), relative);
			else if (entry.isFile()) {
				parts.push(
					`${relative}:${createHash("sha256")
						.update(await readFile(join(base, entry.name)))
						.digest("hex")}`,
				);
			}
		}
	}
	await walk(path, "");
	return createHash("sha256").update(parts.join("\n")).digest("hex");
}

export async function runDryRun(repoRoot: string): Promise<void> {
	const root = resolve(repoRoot);
	const beforeRuntime = {
		pedals: await hashFile(join(root, "src/catalog/data/pedals.json")),
		boards: await hashFile(join(root, "src/catalog/data/boards.json")),
		mappedPedals: await hashTree(join(root, "data/catalog/pedals")),
		mappedBoards: await hashTree(join(root, "data/catalog/boards")),
		registry: await hashFile(join(root, "data/catalog/registry.json")),
	};
	const temp = await mkdtemp(join(tmpdir(), "pedalvision-catalog-dry-"));
	try {
		await mkdir(join(temp, "data/catalog/legacy"), { recursive: true });
		for (const kind of ["pedals", "boards"]) {
			await copyFile(
				join(root, "data/catalog/legacy", `${kind}.json`),
				join(temp, "data/catalog/legacy", `${kind}.json`),
			);
		}
		await cp(
			join(root, "public/pedal-assets"),
			join(temp, "public/pedal-assets"),
			{ recursive: true },
		);
		await writeJson(
			join(temp, "data/catalog/research/pedals/acme/batch-1.json"),
			PEDALS,
		);
		for (const pedal of PEDALS) {
			for (const size of ["800", "350"]) {
				await syntheticPng(
					join(temp, "public/pedal-assets/pedals", size, `${pedal.id}.png`),
				);
			}
		}

		const build = await buildCatalog({
			root: temp,
			outRoot: join(temp, "out"),
		});
		const validation = await validateCatalog({
			catalogDir: join(temp, "out/src/catalog/data"),
			assetsDir: join(temp, "public/pedal-assets"),
		});
		if (validation.issues.length > 0) {
			throw new Error("dry-run catalog did not validate");
		}

		const second = await buildCatalog({
			root: temp,
			outRoot: join(temp, "out-2"),
		});
		const firstRuntime = await readFile(
			join(temp, "out/src/catalog/data/pedals.json"),
		);
		const secondRuntime = await readFile(
			join(temp, "out-2/src/catalog/data/pedals.json"),
		);
		if (!firstRuntime.equals(secondRuntime)) {
			throw new Error("dry-run build is not deterministic");
		}
		if (build.pedals.length !== 210 || second.pedals.length !== 210) {
			throw new Error(
				`dry-run expected 210 pedals, got ${build.pedals.length}`,
			);
		}

		const runnerRoot = join(temp, "runner");
		await mkdir(runnerRoot, { recursive: true });
		for (const batch of [
			{ batchId: "acme/pedals-1", kind: "pedals" as const },
			{ batchId: "acme/pedals-2", kind: "pedals" as const },
			{ batchId: "beta/boards-1", kind: "boards" as const },
		]) {
			await startBatch({
				root: runnerRoot,
				batchId: batch.batchId,
				kind: batch.kind,
				brand: batch.batchId.split("/")[0] as string,
				total: 1,
				worktree: temp,
				assetsDir: join(temp, "public/pedal-assets"),
			});
		}
		const status = await renderStatus(runnerRoot);
		for (const id of ["acme/pedals-1", "acme/pedals-2", "beta/boards-1"]) {
			if (!status.includes(id)) {
				throw new Error(`dry-run status did not list ${id}`);
			}
		}

		await pauseBatch(runnerRoot, "acme/pedals-1");
		const paused = await checkpoint({
			root: runnerRoot,
			batchId: "acme/pedals-1",
			itemId: "acme-alpha-drive",
		});
		if (paused.exitCode !== 75) {
			throw new Error("dry-run pause was not honoured at the checkpoint");
		}
		await resumeBatch(runnerRoot, "acme/pedals-1");
		const afterPause = await checkpoint({
			root: runnerRoot,
			batchId: "acme/pedals-1",
			itemId: "acme-alpha-drive",
		});
		if (afterPause.exitCode !== 0) {
			throw new Error("dry-run resume after pause did not continue");
		}
		await stopBatch(runnerRoot, "acme/pedals-2");
		const stopped = await checkpoint({
			root: runnerRoot,
			batchId: "acme/pedals-2",
			itemId: "acme-beta-fuzz",
		});
		if (stopped.exitCode !== 75) {
			throw new Error("dry-run stop was not honoured at the checkpoint");
		}
		await resumeBatch(runnerRoot, "acme/pedals-2");
		const resumed = await checkpoint({
			root: runnerRoot,
			batchId: "acme/pedals-2",
			itemId: "acme-beta-fuzz",
		});
		if (resumed.exitCode !== 0) {
			throw new Error("dry-run resume did not continue");
		}
		await stopAll(runnerRoot, "dry-run global stop");
		const global = await checkpoint({
			root: runnerRoot,
			batchId: "beta/boards-1",
			itemId: "beta-board",
		});
		if (global.exitCode !== 75) {
			throw new Error("dry-run global STOP was not honoured");
		}

		const afterRuntime = {
			pedals: await hashFile(join(root, "src/catalog/data/pedals.json")),
			boards: await hashFile(join(root, "src/catalog/data/boards.json")),
			mappedPedals: await hashTree(join(root, "data/catalog/pedals")),
			mappedBoards: await hashTree(join(root, "data/catalog/boards")),
			registry: await hashFile(join(root, "data/catalog/registry.json")),
		};
		if (JSON.stringify(beforeRuntime) !== JSON.stringify(afterRuntime)) {
			throw new Error("dry-run wrote mapped/runtime files into the workspace");
		}

		console.log("catalog dry run: PASS");
		console.log("  3 synthetic pedals projected into a temp runtime");
		console.log(
			`  build deterministic (${build.pedals.length} pedals / ${build.boards.length} boards)`,
		);
		console.log("  status listed 3 fake batches");
		console.log("  pause + stop honoured at checkpoints; resume continued");
		console.log("  global STOP honoured for the remaining batch");
		console.log("  no mapped/runtime files were written into the workspace");
	} finally {
		await rm(temp, { recursive: true, force: true });
	}
}
