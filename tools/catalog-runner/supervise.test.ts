import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { startBatch, stopBatch } from "./runner.ts";
import { readState } from "./state.ts";
import { supervise } from "./supervise.ts";

const dirs: string[] = [];

afterEach(async () => {
	await Promise.all(
		dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
	);
});

async function waitForPid(root: string, batchId: string): Promise<number> {
	for (let attempt = 0; attempt < 100; attempt++) {
		const state = await readState(root, batchId);
		if (state.pid) return state.pid;
		await new Promise((resolve) => setTimeout(resolve, 25));
	}
	throw new Error("supervisor never wrote a child pid");
}

describe("supervisor stop fallback", () => {
	it("SIGTERMs then SIGKILLs a child that ignores SIGTERM", async () => {
		const root = await mkdtemp(join(tmpdir(), "pedalvision-supervise-"));
		dirs.push(root);
		process.env.CATALOG_STOP_GRACE_MS = "100";
		process.env.CATALOG_KILL_GRACE_MS = "150";
		await startBatch({
			root,
			batchId: "acme/pedals-1",
			kind: "pedals",
			brand: "Acme",
			total: 3,
			worktree: root,
			assetsDir: join(root, "assets"),
		});

		const marker = join(root, "marker");
		const script = `process.on('SIGTERM',()=>{}); require('node:fs').writeFileSync(${JSON.stringify(marker)},'started'); setInterval(()=>{},1000)`;
		const supervised = supervise({
			root,
			batchId: "acme/pedals-1",
			command: process.execPath,
			args: ["-e", script],
			pollMs: 25,
		});

		const pid = await waitForPid(root, "acme/pedals-1");
		expect(pid).toBeGreaterThan(0);
		for (let attempt = 0; attempt < 100; attempt++) {
			try {
				if ((await readFile(marker, "utf8")) === "started") break;
			} catch {
				// Not written yet.
			}
			await new Promise((resolve) => setTimeout(resolve, 25));
		}
		await stopBatch(root, "acme/pedals-1");
		const code = await supervised;
		expect(code).not.toBe(0);
		const state = await readState(root, "acme/pedals-1");
		expect(state.status).toBe("stopped");
		expect(state.stopRequested).toBe(true);
		expect(await readFile(marker, "utf8")).toBe("started");
	}, 10_000);
});
