import { describe, expect, it } from "vitest";
import { guardBatchPr } from "./guard.ts";

describe("batch PR guard", () => {
	it("allows raw records, assets and the batch task file", () => {
		expect(
			guardBatchPr([
				"data/catalog/research/pedals/acme/batch-1.json",
				"public/pedal-assets/pedals/800/acme-alpha.png",
				"docs/tasks/P5-03-pedals-acme-1.md",
			]),
		).toEqual([]);
	});

	it("rejects mapped/runtime and feature-code edits in a batch PR", () => {
		expect(
			guardBatchPr([
				"data/catalog/research/pedals/acme/batch-1.json",
				"data/catalog/pedals/acme/batch-1.json",
				"src/catalog/data/pedals.json",
				"src/lib/thing.ts",
			]),
		).toEqual([
			"data/catalog/pedals/acme/batch-1.json",
			"src/catalog/data/pedals.json",
			"src/lib/thing.ts",
		]);
	});
});
