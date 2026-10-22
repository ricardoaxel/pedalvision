import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
	checkpoint,
	pauseBatch,
	resumeAll,
	resumeBatch,
	startBatch,
	stopAll,
	stopBatch,
} from "./runner.ts";
import { readState } from "./state.ts";
import { renderStatus } from "./status.ts";

const dirs: string[] = [];

async function root(): Promise<string> {
	const dir = await mkdtemp(join(tmpdir(), "pedalvision-runner-"));
	dirs.push(dir);
	return dir;
}

async function start(
	dir: string,
	batchId: string,
	kind: "pedals" | "boards" = "pedals",
	total = 3,
): Promise<void> {
	await startBatch({
		root: dir,
		batchId,
		kind,
		brand: batchId.split("/")[0] as string,
		total,
		worktree: dir,
		assetsDir: join(dir, "assets"),
	});
}

afterEach(async () => {
	await Promise.all(
		dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
	);
});

describe("catalog runner", () => {
	it("shows 3 fake batches and refuses a fourth", async () => {
		const dir = await root();
		await start(dir, "acme/pedals-1");
		await start(dir, "acme/pedals-2");
		await start(dir, "beta/boards-1", "boards");
		const status = await renderStatus(dir);
		expect(status).toContain("acme/pedals-1");
		expect(status).toContain("acme/pedals-2");
		expect(status).toContain("beta/boards-1");
		await expect(start(dir, "acme/pedals-3")).rejects.toThrow(/max 3 batches/);
	});

	it("prints 3 fake batches through the catalog:status CLI", async () => {
		const dir = await root();
		await start(dir, "acme/pedals-1");
		await start(dir, "acme/pedals-2");
		await start(dir, "beta/boards-1", "boards");
		const cli = fileURLToPath(new URL("./index.ts", import.meta.url));
		const output = execFileSync(
			process.execPath,
			["--experimental-strip-types", cli, "status"],
			{
				encoding: "utf8",
				env: {
					...process.env,
					CATALOG_WORK_DIR: join(dir, "work/catalog"),
				},
			},
		);
		expect(output).toContain("acme/pedals-1");
		expect(output).toContain("acme/pedals-2");
		expect(output).toContain("beta/boards-1");
	});

	it("pauses at a checkpoint and resumes", async () => {
		const dir = await root();
		await start(dir, "acme/pedals-1");
		await pauseBatch(dir, "acme/pedals-1");
		const paused = await checkpoint({
			root: dir,
			batchId: "acme/pedals-1",
			itemId: "acme-alpha",
		});
		expect(paused.exitCode).toBe(75);
		expect(paused.state.status).toBe("paused");

		await resumeBatch(dir, "acme/pedals-1");
		const resumed = await checkpoint({
			root: dir,
			batchId: "acme/pedals-1",
			itemId: "acme-beta",
		});
		expect(resumed.exitCode).toBe(0);
		expect(resumed.state.done).toBe(2);
	});

	it("stops one batch at a checkpoint and resumes it", async () => {
		const dir = await root();
		await start(dir, "acme/pedals-1");
		await stopBatch(dir, "acme/pedals-1");
		const stopped = await checkpoint({
			root: dir,
			batchId: "acme/pedals-1",
			itemId: "acme-alpha",
		});
		expect(stopped.exitCode).toBe(75);
		expect(stopped.state.status).toBe("stopped");
		expect(stopped.state.done).toBe(1);

		await resumeBatch(dir, "acme/pedals-1");
		const resumed = await checkpoint({
			root: dir,
			batchId: "acme/pedals-1",
			itemId: "acme-beta",
		});
		expect(resumed.exitCode).toBe(0);
	});

	it("global STOP stops every batch at its next checkpoint", async () => {
		const dir = await root();
		await start(dir, "acme/pedals-1");
		await start(dir, "acme/pedals-2");
		await stopAll(dir);
		for (const batchId of ["acme/pedals-1", "acme/pedals-2"]) {
			const result = await checkpoint({
				root: dir,
				batchId,
				itemId: "acme-alpha",
			});
			expect(result.exitCode).toBe(75);
			expect(result.state.status).toBe("stopped");
			expect((await readState(dir, batchId)).status).toBe("stopped");
		}
		await resumeAll(dir);
		expect((await readState(dir, "acme/pedals-1")).status).toBe("running");
	});
});
