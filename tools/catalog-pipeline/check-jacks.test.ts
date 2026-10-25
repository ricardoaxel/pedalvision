import { describe, expect, it } from "vitest";
import type { RawPedalRecord } from "../../src/catalog/rawSchema.ts";
import { checkJackLayouts } from "./check-jacks.ts";

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
