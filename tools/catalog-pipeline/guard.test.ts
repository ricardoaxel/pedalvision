import { describe, expect, it } from "vitest";
import { guardBatchPr } from "./guard.ts";

describe("batch PR guard", () => {
	it("allows raw records, assets and the batch task file", () => {
		expect(
			guardBatchPr([
				"data/catalog/research/pedals/acme/batch-1.json",
				"public/pedal-assets/pedals/800/acme-alpha.png",
				"public/pedal-assets/pedals/800/acme-alpha.avif",
				"docs/tasks/P5-03-pedals-acme-1.md",
			]),
		).toEqual([]);
	});

	it("allows the owner-approved pilot pipeline only with allowPipeline", () => {
		const batch = [
			"data/catalog/research/pedals/acme/batch-1.json",
			"public/pedal-assets/pedals/800/acme-alpha.avif",
		];
		const pipeline = [
			"src/lib/cdn.ts",
			"src/lib/jackAnchor.ts",
			"src/state/scene.ts",
			"tools/asset-pipeline/index.ts",
			"docs/design.md",
			"e2e/picker-choka.spec.ts",
		];
		expect(guardBatchPr([...batch, ...pipeline])).toEqual(pipeline);
		expect(
			guardBatchPr([...batch, ...pipeline], { allowPipeline: true }),
		).toEqual([]);
		// Generated runtime/mapped files stay forbidden even with the exception.
		expect(
			guardBatchPr(
				[
					...batch,
					"src/catalog/data/pedals.json",
					"data/catalog/pedals/acme/batch-1.json",
				],
				{ allowPipeline: true },
			),
		).toEqual([
			"src/catalog/data/pedals.json",
			"data/catalog/pedals/acme/batch-1.json",
		]);
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
