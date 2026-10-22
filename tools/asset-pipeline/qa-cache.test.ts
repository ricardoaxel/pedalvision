import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { findCached, hashBytes, readQaCache, recordQa } from "./qa-cache.ts";

const dirs: string[] = [];

afterEach(async () => {
	await Promise.all(
		dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
	);
});

describe("image QA cache", () => {
	it("stores and finds a verdict by source hash", async () => {
		const dir = await mkdtemp(join(tmpdir(), "pedalvision-qa-"));
		dirs.push(dir);
		const path = join(dir, "batch.json");
		const sha256 = hashBytes(Buffer.from("image bytes"));
		await recordQa(path, "acme/pedals-1", "acme-alpha", {
			sha256,
			verdict: "reject",
			reasons: ["busy background"],
			reviewedAt: "2026-10-22",
			reviewer: "contact-sheet",
		});
		const cache = await readQaCache(path, "acme/pedals-1");
		expect(cache.images["acme-alpha"]?.verdict).toBe("reject");
		expect(findCached(cache, sha256)?.reasons).toEqual(["busy background"]);
	});

	it("returns an empty cache when the file does not exist", async () => {
		const cache = await readQaCache("/tmp/does-not-exist-qa.json", "acme");
		expect(cache).toEqual({ version: 1, batch: "acme", images: {} });
	});
});
