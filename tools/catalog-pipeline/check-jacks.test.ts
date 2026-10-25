import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { RawPedalRecord } from "../../src/catalog/rawSchema.ts";
import { checkJackLayoutFiles, checkJackLayouts } from "./check-jacks.ts";

function pedal(overrides: Partial<RawPedalRecord> = {}): RawPedalRecord {
	return {
		id: "acme-test",
		brand: "Acme",
		name: "Test",
		category: "pedal",
		widthCm: 10,
		heightCm: 12,
		...overrides,
	};
}

describe("checkJackLayouts", () => {
	it("accepts a verified layout source", () => {
		const issues = checkJackLayouts([
			pedal({
				jacks: [{ kind: "in", edge: "top" }],
				jackLayout: {
					source: "https://example.com/rear.jpg",
					confidence: "verified",
				},
			}),
		]);
		expect(issues).toEqual([]);
	});

	it("rejects an edge without a jack layout source", () => {
		const issues = checkJackLayouts([
			pedal({ jacks: [{ kind: "in", edge: "top" }] }),
		]);
		expect(issues).toHaveLength(1);
		expect(issues[0]?.id).toBe("acme-test");
		expect(issues[0]?.message).toContain("no jackLayout.source");
	});

	it("rejects an estimated layout (the edge must be omitted)", () => {
		const issues = checkJackLayouts([
			pedal({
				jacks: [{ kind: "in", edge: "top" }],
				jackLayout: {
					source: "https://example.com/rear.jpg",
					confidence: "estimated",
				},
			}),
		]);
		expect(issues).toHaveLength(1);
		expect(issues[0]?.message).toContain("not verified");
	});

	it("ignores records whose jacks have no edge", () => {
		const issues = checkJackLayouts([
			pedal({
				jacks: [
					{ kind: "midi", connector: "din5" },
					{ kind: "power", connector: "barrel" },
				],
			}),
		]);
		expect(issues).toEqual([]);
	});
});

describe("checkJackLayoutFiles", () => {
	it("fails when the raw pedal directory is missing or empty", async () => {
		const root = await mkdtemp(join(tmpdir(), "pedalvision-jacks-"));
		try {
			const result = await checkJackLayoutFiles(root);
			expect(result.files).toBe(0);
			expect(result.issues).toHaveLength(1);
			expect(result.issues[0]?.message).toContain("no raw pedal batch files");
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});
});
