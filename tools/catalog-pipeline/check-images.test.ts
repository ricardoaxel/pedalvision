import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
	checkImageProvenance,
	checkImageProvenanceFiles,
	isPlannerUrl,
} from "./check-images.ts";

const planner = "https://pedalplayground.com/public/images/pedals/boss-dc2.png";

describe("image provenance gate", () => {
	it("flags a planner URL with no provenance", () => {
		const { issues, warnings } = checkImageProvenance([
			{ id: "x", imageCandidates: [{ url: planner }] },
		]);
		expect(issues).toHaveLength(1);
		expect(warnings).toHaveLength(0);
		expect(issues[0]?.message).toMatch(/missing imageProvenance/);
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
				sources: [{ url: planner, kind: ["image"] }],
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
				imageProvenance: {
					kind: "official",
					sourceUrl: planner,
					status: "chosen",
				},
			},
		]);
		expect(issues).toHaveLength(1);
		expect(issues[0]?.message).toMatch(/kind=official/);
	});

	it("passes a recorded official source with no planner URL", () => {
		const { issues, warnings } = checkImageProvenance([
			{
				id: "x",
				imageCandidates: [{ url: "https://static.roland.com/a.jpg" }],
				imageProvenance: {
					kind: "official",
					sourceUrl: "https://static.roland.com/a.jpg",
					status: "chosen",
				},
			},
		]);
		expect(issues).toHaveLength(0);
		expect(warnings).toHaveLength(0);
	});

	it("rejects a chosen official image without a recorded source", () => {
		const { issues } = checkImageProvenance([
			{ id: "x", imageProvenance: { kind: "official", status: "chosen" } },
		]);
		expect(issues).toHaveLength(1);
		expect(issues[0]?.message).toMatch(/sourceUrl/);
	});

	it("allows a planner last-resort with a recorded source", () => {
		const { issues, warnings } = checkImageProvenance([
			{
				id: "x",
				imageCandidates: [{ url: planner }],
				imageProvenance: {
					kind: "planner",
					sourceUrl: planner,
					status: "last-resort",
				},
			},
		]);
		expect(issues).toHaveLength(0);
		expect(warnings).toHaveLength(1);
		expect(warnings[0]?.category).toBe("planner-last-resort");
		expect(warnings[0]?.message).toMatch(/last resort/);
	});

	it("rejects a planner URL mislabelled as generated art", () => {
		const { issues } = checkImageProvenance([
			{
				id: "x",
				imageCandidates: [{ url: planner }],
				imageProvenance: {
					kind: "own",
					status: "chosen",
					note: "generated from an official reference",
				},
			},
		]);
		expect(issues).toHaveLength(1);
		expect(issues[0]?.message).toMatch(/kind=own/);
	});

	it("rejects a planner chosen/last-resort without a source", () => {
		const chosen = checkImageProvenance([
			{
				id: "x",
				imageCandidates: [{ url: planner }],
				imageProvenance: { kind: "planner", status: "chosen" },
			},
		]);
		expect(chosen.issues).toHaveLength(1);
		const noSource = checkImageProvenance([
			{
				id: "x",
				imageCandidates: [{ url: planner }],
				imageProvenance: { kind: "planner", status: "last-resort" },
			},
		]);
		expect(noSource.issues).toHaveLength(1);
		expect(noSource.issues[0]?.message).toMatch(/sourceUrl/);
	});

	it("requires a note for own/generated art and ignores referenceUrl", () => {
		const ok = checkImageProvenance([
			{
				id: "x",
				imageProvenance: {
					kind: "own",
					status: "chosen",
					referenceUrl: "https://www.boss.info/us/products/ds-1/",
					note: "generated from the official reference",
				},
			},
		]);
		expect(ok.issues).toHaveLength(0);
		const missing = checkImageProvenance([
			{ id: "x", imageProvenance: { kind: "own", status: "chosen" } },
		]);
		expect(missing.issues).toHaveLength(1);
	});

	it("does not flag an info-only planner reference", () => {
		const { issues, warnings } = checkImageProvenance([
			{
				id: "x",
				imageCandidates: [{ url: "https://static.roland.com/a.jpg" }],
				sources: [{ url: planner, kind: ["info"] }],
				imageProvenance: {
					kind: "official",
					sourceUrl: "https://static.roland.com/a.jpg",
					status: "chosen",
				},
			},
		]);
		expect(issues).toHaveLength(0);
		expect(warnings).toHaveLength(0);
	});

	it("warns on a legacy pending asset and rejects a chosen legacy", () => {
		const pending = checkImageProvenance([
			{
				id: "x",
				imageProvenance: { kind: "legacy", status: "pending-replacement" },
			},
		]);
		expect(pending.issues).toHaveLength(0);
		expect(pending.warnings).toHaveLength(1);
		const chosen = checkImageProvenance([
			{ id: "x", imageProvenance: { kind: "legacy", status: "chosen" } },
		]);
		expect(chosen.issues).toHaveLength(1);
	});

	it("checks imageProvenance.sourceUrl too", () => {
		const { issues } = checkImageProvenance([
			{
				id: "x",
				imageProvenance: {
					kind: "official",
					status: "chosen",
					sourceUrl: planner,
				},
			},
		]);
		expect(issues).toHaveLength(1);
	});

	it("merges legacy/planner gaps into one warning per category", async () => {
		const root = await mkdtemp(join(tmpdir(), "pedalvision-images-"));
		try {
			const dir = join(root, "data/catalog/research/pedals/acme");
			await mkdir(dir, { recursive: true });
			const record = (id: string) => ({
				id,
				brand: "Acme",
				name: id,
				category: "pedal",
				widthCm: 7,
				heightCm: 12,
				effectTypes: [],
				imageProvenance: {
					kind: "legacy",
					status: "pending-replacement",
				},
			});
			await writeFile(join(dir, "a.json"), JSON.stringify([record("acme-a")]));
			await writeFile(join(dir, "b.json"), JSON.stringify([record("acme-b")]));
			const result = await checkImageProvenanceFiles(root);
			expect(result.issues).toHaveLength(0);
			expect(result.warnings).toHaveLength(1);
			expect(result.warnings[0]?.category).toBe("legacy-pending");
			expect(result.warnings[0]?.count).toBe(2);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	it("refuses a green gate over an empty/missing research dir", async () => {
		const root = await mkdtemp(join(tmpdir(), "pedalvision-images-"));
		try {
			const result = await checkImageProvenanceFiles(root);
			expect(result.files).toBe(0);
			expect(
				result.issues.some((issue) => /empty\/missing/.test(issue.message)),
			).toBe(true);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	it("detects the planner host case-insensitively", () => {
		expect(isPlannerUrl("https://WWW.PedalPlayground.com/x.png")).toBe(true);
		expect(isPlannerUrl("https://static.roland.com/x.jpg")).toBe(false);
		expect(isPlannerUrl(undefined)).toBe(false);
	});
});
