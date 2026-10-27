import { describe, expect, it } from "vitest";
import {
	buildLedger,
	classifyItem,
	isPlannerUrl,
	type LicenseFile,
	type RawRecord,
	type RuntimeItem,
	renderLedgerDoc,
} from "./index.ts";

const brands: LicenseFile["brands"] = {
	BOSS: { status: "not-requested" },
	Meris: { status: "granted", licenseRef: "email 2026-10-26" },
};

function pedal(id: string, overrides: Partial<RuntimeItem> = {}): RuntimeItem {
	return {
		id,
		brand: "BOSS",
		name: id,
		image: `${id}.avif`,
		imageSource: "static",
		source: "public-asset",
		...overrides,
	};
}

describe("image license ledger", () => {
	it("classifies a self-hosted official image as license-pending", () => {
		const row = classifyItem(pedal("a"), "pedal", undefined, brands);
		expect(row.licenseStatus).toBe("license-pending");
		expect(row.imageHosting).toBe("static");
		expect(row.sourceKind).toBe("official");
	});

	it("records the private source URL and does not flag an official image", () => {
		const row = classifyItem(
			pedal("a"),
			"pedal",
			{
				id: "a",
				imageProvenance: {
					kind: "official",
					sourceUrl: "https://static.roland.com/a.jpg",
					status: "chosen",
				},
			},
			brands,
		);
		expect(row.sourceKind).toBe("official");
		expect(row.sourceUrl).toBe("https://static.roland.com/a.jpg");
		expect(row.improve).toBe(false);
	});

	it("classifies retailer/community/archive sources", () => {
		for (const kind of ["retailer", "community", "archive"] as const) {
			const row = classifyItem(
				pedal(kind),
				"pedal",
				{
					id: kind,
					imageProvenance: {
						kind,
						sourceUrl: "https://example.com/x.jpg",
						status: "chosen",
					},
				},
				brands,
			);
			expect(row.sourceKind).toBe(kind);
			expect(row.licenseStatus).toBe("license-pending");
			expect(row.improve).toBe(false);
		}
	});

	it("classifies planner last-resort as a recorded source gap", () => {
		const row = classifyItem(
			pedal("p"),
			"pedal",
			{
				id: "p",
				imageProvenance: {
					kind: "planner",
					sourceUrl: "https://www.pedalplayground.com/x.png",
					status: "last-resort",
				},
			},
			brands,
		);
		expect(row.sourceKind).toBe("planner");
		expect(row.licenseStatus).toBe("license-pending");
		expect(row.improve).toBe(true);
		expect(row.replacementTarget).toMatch(/better source/);
		expect(row.sourceUrl).toBe("https://www.pedalplayground.com/x.png");
		expect(row.gapReason).toBe("planner");
	});

	it("classifies a recorded but hotlinked official image as a gap", () => {
		const row = classifyItem(
			pedal("h", {
				imageSource: "url",
				source: "public-asset",
				image: "https://example.com/h.jpg",
			}),
			"pedal",
			{
				id: "h",
				imageProvenance: {
					kind: "official",
					sourceUrl: "https://example.com/h.jpg",
					status: "chosen",
				},
			},
			brands,
		);
		expect(row.imageHosting).toBe("hotlinked");
		expect(row.improve).toBe(true);
		expect(row.gapReason).toBe("hotlinked");
		expect(row.replacementTarget).toMatch(/BOSS/);
	});

	it("renders source-gap rows without a misleading hosting column", () => {
		const ledger = buildLedger(
			{
				pedals: [
					pedal("a"),
					pedal("b"),
					pedal("c", { imageSource: "mock", source: "placeholder" }),
				],
				boards: [],
			},
			new Map<string, RawRecord>([
				["a", { id: "a", imageProvenance: { kind: "legacy" } }],
				[
					"b",
					{
						id: "b",
						imageProvenance: {
							kind: "planner",
							sourceUrl: "https://www.pedalplayground.com/x.png",
							status: "last-resort",
						},
					},
				],
			]),
			brands,
		);
		const doc = renderLedgerDoc(ledger);
		expect(doc).toContain("## Source gaps");
		expect(doc).toMatch(/\| BOSS \| legacy \| 1 \|/);
		expect(doc).toMatch(/\| BOSS \| planner \| 1 \|/);
		expect(doc).not.toContain("| Brand | Source | Hosting | Items |");
	});

	it("classifies a legacy provenance as replacement-needed", () => {
		const raw = new Map<string, RawRecord>([
			[
				"b",
				{
					id: "b",
					imageProvenance: { kind: "legacy", status: "pending-replacement" },
				},
			],
		]);
		const row = classifyItem(pedal("b"), "pedal", raw.get("b"), brands);
		expect(row.licenseStatus).toBe("replacement-needed");
		expect(row.sourceKind).toBe("legacy");
		expect(row.replacementTarget).toMatch(/BOSS/);
	});

	it("classifies a planner URL without provenance as replacement-needed", () => {
		const raw = new Map<string, RawRecord>([
			[
				"c",
				{
					id: "c",
					imageCandidates: [{ url: "https://pedalplayground.com/x.png" }],
				},
			],
		]);
		const row = classifyItem(pedal("c"), "pedal", raw.get("c"), brands);
		expect(row.licenseStatus).toBe("replacement-needed");
	});

	it("flags hotlinked and mock images as improve, and records hotlink URLs", () => {
		const hot = classifyItem(
			pedal("h", {
				imageSource: "url",
				source: "placeholder",
				image: "https://example.com/h.jpg",
			}),
			"pedal",
			undefined,
			brands,
		);
		expect(hot.improve).toBe(true);
		expect(hot.gapReason).toBe("hotlinked");
		expect(hot.sourceUrl).toBe("https://example.com/h.jpg");
		const mock = classifyItem(
			pedal("m", { imageSource: "mock", source: "placeholder" }),
			"pedal",
			undefined,
			brands,
		);
		expect(mock.improve).toBe(true);
		expect(mock.gapReason).toBe("mock");
	});

	it("classifies hotlinked official images and mock art", () => {
		const hot = classifyItem(
			pedal("d", {
				imageSource: "url",
				source: "placeholder",
				image: "https://example.com/d.jpg",
			}),
			"pedal",
			undefined,
			brands,
		);
		expect(hot.imageHosting).toBe("hotlinked");
		expect(hot.licenseStatus).toBe("license-pending");
		const mock = classifyItem(
			pedal("e", { imageSource: "mock", source: "placeholder" }),
			"pedal",
			undefined,
			brands,
		);
		expect(mock.imageHosting).toBe("mock");
		expect(mock.licenseStatus).toBe("own");
	});

	it("classifies generated board art as own and a granted brand as licensed", () => {
		const board = classifyItem(
			{
				id: "b1",
				brand: "Pedaltrain",
				name: "Board",
				image: "b.avif",
				imageSource: "static",
				source: "public-asset",
			},
			"board",
			{ id: "b1", imageProvenance: { kind: "own" } },
			brands,
		);
		expect(board.licenseStatus).toBe("own");
		const granted = classifyItem(
			{
				...pedal("g"),
				brand: "Meris",
			},
			"pedal",
			undefined,
			brands,
		);
		expect(granted.licenseStatus).toBe("licensed");
		expect(granted.licenseRef).toBe("email 2026-10-26");
	});

	it("does not label a board without own provenance as our art", () => {
		const board = classifyItem(
			{
				id: "b2",
				brand: "Pedaltrain",
				name: "Board",
				image: "b.avif",
				imageSource: "static",
				source: "public-asset",
			},
			"board",
			undefined,
			brands,
		);
		expect(board.licenseStatus).toBe("license-pending");
		expect(board.sourceKind).toBe("official");
	});

	it("matches the GitHub raw planner URL form", () => {
		expect(
			isPlannerUrl(
				"https://raw.githubusercontent.com/PedalPlayground/pedalplayground/master/public/images/pedalboards/temple-duo24-gray.png",
			),
		).toBe(true);
		expect(isPlannerUrl("https://pedalplayground.com/x.png")).toBe(true);
		expect(
			isPlannerUrl("https://raw.githubusercontent.com/other/repo/x.png"),
		).toBe(false);
	});

	it("summarizes every runtime item", () => {
		const ledger = buildLedger(
			{
				pedals: [pedal("a"), pedal("b"), pedal("c")],
				boards: [
					{
						id: "d",
						brand: "Pedaltrain",
						name: "Board",
						image: "d.avif",
						imageSource: "static",
						source: "public-asset",
					},
				],
			},
			new Map<string, RawRecord>([
				["b", { id: "b", imageProvenance: { kind: "legacy" } }],
				["d", { id: "d", imageProvenance: { kind: "own" } }],
			]),
			brands,
		);
		expect(ledger.summary.items).toBe(4);
		expect(ledger.summary.byStatus["license-pending"]).toBe(2);
		expect(ledger.summary.byStatus["replacement-needed"]).toBe(1);
		expect(ledger.summary.byStatus.own).toBe(1);
		expect(ledger.summary.needsImprovement).toBe(3);
		expect(ledger.summary.byGapReason.legacy).toBe(1);
		expect(ledger.summary.byGapReason["missing-source"]).toBe(2);
	});
});
