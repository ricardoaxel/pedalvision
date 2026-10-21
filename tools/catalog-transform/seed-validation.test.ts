import { describe, expect, it } from "vitest";
import { type SeedValidation, validateSeed } from "./seed-validation.ts";

const pedal = (overrides: Record<string, unknown> = {}) => ({
	id: "acme-big-fuzz",
	brand: "Acme",
	name: "Big Fuzz",
	widthCm: 6.35,
	heightCm: 11.94,
	image: "acme-big-fuzz.png",
	imageSource: "static",
	effectTypes: ["fuzz"],
	category: "pedal",
	source: "placeholder",
	...overrides,
});

const board = (overrides: Record<string, unknown> = {}) => ({
	id: "acme-terra-24",
	brand: "Acme",
	name: "Terra 24",
	widthCm: 60,
	heightCm: 30,
	image: "acme-terra-24.png",
	imageSource: "static",
	source: "placeholder",
	...overrides,
});

function summary(report: SeedValidation) {
	return report.summary;
}

describe("validateSeed", () => {
	it("classifies the placeholder seed as replace (facts survive, image re-sourced)", () => {
		const report = validateSeed([pedal()], [board()], {
			generatedAt: "2026-10-21",
			hasStaticImage: () => true,
		});
		expect(report.items.map((item) => item.verdict)).toEqual([
			"replace",
			"replace",
		]);
		expect(report.items[0]?.reasons).toContain(
			"replace:rights tag is placeholder, not public-asset",
		);
		expect(summary(report).pedals.replace).toBe(1);
		expect(summary(report).boards.replace).toBe(1);
	});

	it("keeps a fully cleared hosted item", () => {
		const report = validateSeed(
			[pedal({ source: "public-asset" })],
			[board({ source: "public-asset" })],
			{ generatedAt: "2026-10-21", hasStaticImage: () => true },
		);
		expect(report.items.map((item) => item.verdict)).toEqual(["keep", "keep"]);
	});

	it("repairs implausible dimensions and missing effect types", () => {
		const report = validateSeed(
			[pedal({ widthCm: 500, effectTypes: [] })],
			[],
			{ generatedAt: "2026-10-21", hasStaticImage: () => true },
		);
		expect(report.items[0]?.verdict).toBe("repair");
		expect(report.items[0]?.reasons.join(" ")).toMatch(/implausible dims/);
		expect(report.items[0]?.reasons.join(" ")).toMatch(/effectTypes missing/);
	});

	it("drops invalid and duplicate ids", () => {
		const report = validateSeed(
			[pedal(), pedal({ name: "Another" })],
			[{ id: "broken" }],
			{ generatedAt: "2026-10-21", hasStaticImage: () => true },
		);
		expect(report.items[0]?.verdict).toBe("replace");
		expect(report.items[1]?.verdict).toBe("drop");
		expect(report.items[1]?.reasons).toContain("drop:duplicate id");
		expect(report.items[2]?.verdict).toBe("drop");
	});

	it("repairs a missing static rendition", () => {
		const report = validateSeed([pedal({ source: "public-asset" })], [], {
			generatedAt: "2026-10-21",
			hasStaticImage: () => false,
		});
		expect(report.items[0]?.verdict).toBe("repair");
		expect(report.items[0]?.reasons).toContain(
			"repair:image file missing for a static asset",
		);
	});
});
