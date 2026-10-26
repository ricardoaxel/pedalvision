import { describe, expect, it } from "vitest";
import {
	buildLedger,
	classifyItem,
	isPlannerUrl,
	type LicenseFile,
	type RawRecord,
	type RuntimeItem,
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
		expect(ledger.summary.byStatus["own"]).toBe(1);
	});
});
