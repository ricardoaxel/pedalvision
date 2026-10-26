import { describe, expect, it } from "vitest";
import { checkImageProvenance, isPlannerUrl } from "./check-images.ts";

const planner = "https://pedalplayground.com/public/images/pedals/boss-dc2.png";

describe("image provenance gate", () => {
	it("flags a planner URL with no provenance", () => {
		const { issues, warnings } = checkImageProvenance([
			{ id: "x", imageCandidates: [{ url: planner }] },
		]);
		expect(issues).toHaveLength(1);
		expect(warnings).toHaveLength(0);
		expect(issues[0]?.message).toMatch(/without imageProvenance/);
	});

	it("allows a documented pending replacement as a warning", () => {
		const { issues, warnings } = checkImageProvenance([
			{
				id: "x",
				imageCandidates: [{ url: planner }],
				imageProvenance: { kind: "planner", status: "pending-replacement" },
			},
		]);
		expect(issues).toHaveLength(0);
		expect(warnings).toHaveLength(1);
	});

	it("allows an owner-approved edge case", () => {
		const { issues, warnings } = checkImageProvenance([
			{
				id: "x",
				sources: [{ url: planner }],
				imageProvenance: {
					kind: "planner",
					status: "owner-approved-edge-case",
				},
			},
		]);
		expect(issues).toHaveLength(0);
		expect(warnings).toHaveLength(0);
	});

	it("rejects a planner URL mislabelled as official", () => {
		const { issues } = checkImageProvenance([
			{
				id: "x",
				imageCandidates: [{ url: planner }],
				imageProvenance: { kind: "official", status: "chosen" },
			},
		]);
		expect(issues).toHaveLength(1);
		expect(issues[0]?.message).toMatch(/kind=official/);
	});

	it("passes an official source with no planner URL", () => {
		const { issues, warnings } = checkImageProvenance([
			{
				id: "x",
				imageCandidates: [{ url: "https://static.roland.com/a.jpg" }],
				imageProvenance: { kind: "official", status: "chosen" },
			},
		]);
		expect(issues).toHaveLength(0);
		expect(warnings).toHaveLength(0);
	});

	it("detects the planner host case-insensitively", () => {
		expect(isPlannerUrl("https://WWW.PedalPlayground.com/x.png")).toBe(true);
		expect(isPlannerUrl("https://static.roland.com/x.jpg")).toBe(false);
		expect(isPlannerUrl(undefined)).toBe(false);
	});
});
