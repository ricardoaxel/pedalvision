import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runDryRun } from "./dry-run.ts";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

describe("P5-02 dry run", () => {
	it("builds 3 synthetic pedals and verifies stop/pause/resume/global STOP", async () => {
		await expect(runDryRun(repoRoot)).resolves.toBeUndefined();
	}, 60_000);
});
