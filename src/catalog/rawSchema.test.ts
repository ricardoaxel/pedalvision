import { describe, expect, it } from "vitest";
import h90 from "../../data/catalog/fixtures/eventide-h90.json";
import {
	RawBoardRecordSchema,
	RawPedalBatchSchema,
	RawPedalRecordSchema,
} from "./rawSchema";

describe("raw research archive schema", () => {
	it("validates the checked-in H90 stress fixture", () => {
		const parsed = RawPedalRecordSchema.parse(h90);
		expect(parsed.id).toBe("eventide-h90");
		expect(parsed.jacks).toHaveLength(14);
		// Positions are unknown (rear-panel order is not a measured anchor):
		// every connector omits `pos` instead of inventing one.
		expect(parsed.jacks?.every((jack) => jack.pos === undefined)).toBe(true);
		expect(parsed.jacks?.every((jack) => jack.edge === "top")).toBe(true);
		expect(parsed.power).toMatchObject({
			voltage: 12,
			acDc: "DC",
			currentMa: 600,
		});
		expect(parsed.jacks?.filter((jack) => jack.kind === "in")).toHaveLength(4);
		expect(parsed.jacks?.filter((jack) => jack.kind === "out")).toHaveLength(4);
		expect(parsed.jacks?.filter((jack) => jack.kind === "exp")).toHaveLength(2);
		expect(parsed.jacks?.filter((jack) => jack.kind === "midi")).toHaveLength(
			2,
		);
		expect(parsed.jacks?.some((jack) => jack.connector === "usb-c")).toBe(true);
		expect(parsed.jacks?.some((jack) => jack.connector === "barrel")).toBe(
			true,
		);
	});

	it("validates a pedal batch array", () => {
		expect(RawPedalBatchSchema.safeParse([h90]).success).toBe(true);
	});

	it("keeps unknown verified facts in `extra`", () => {
		const parsed = RawPedalRecordSchema.safeParse({
			...h90,
			extra: { mysteryVerifiedFact: "a fact with no first-class field yet" },
		});
		expect(parsed.success).toBe(true);
	});

	it("validates typed image provenance", () => {
		const official = RawPedalRecordSchema.safeParse({
			...h90,
			imageProvenance: {
				kind: "official",
				sourceUrl: "https://static.roland.com/a.jpg",
				status: "chosen",
				note: "official top-down",
			},
		});
		expect(official.success).toBe(true);
		const pending = RawPedalRecordSchema.safeParse({
			...h90,
			imageProvenance: { kind: "planner", status: "pending-replacement" },
		});
		expect(pending.success).toBe(true);
		const bad = RawPedalRecordSchema.safeParse({
			...h90,
			imageProvenance: { kind: "unknown-source" },
		});
		expect(bad.success).toBe(false);
	});

	it("rejects unknown top-level keys (facts belong in `extra`)", () => {
		const parsed = RawPedalRecordSchema.safeParse({
			...h90,
			notAField: true,
		});
		expect(parsed.success).toBe(false);
	});

	it("validates a board record with the board contract fields", () => {
		const board = {
			id: "pedaltrain-classic-2",
			brand: "Pedaltrain",
			name: "Classic 2",
			category: "board",
			widthCm: 61,
			heightCm: 31.8,
			thicknessCm: 8.9,
			maxHeightCm: 8.9,
			weightG: 1900,
			material: "aluminum",
			boardType: "angled",
			tiers: 1,
			surface: "velcro",
			bagIncluded: true,
			caseIncluded: false,
			powerMount: "universal bracket",
			cableRouting: "slots",
			maxPedalHeightCm: 8.9,
			status: "current",
			sources: [
				{ url: "https://pedaltrain.com/products/classic-2", kind: ["info"] },
			],
			confidence: "confirmed",
			lastVerified: "2026-10-21",
		};
		expect(RawBoardRecordSchema.safeParse(board).success).toBe(true);
	});

	it("rejects a board without its footprint", () => {
		expect(
			RawBoardRecordSchema.safeParse({
				id: "acme-board",
				brand: "Acme",
				name: "Board",
				category: "board",
			}).success,
		).toBe(false);
	});

	it("allows edge-only jacks and exact jack positions side by side", () => {
		const parsed = RawPedalRecordSchema.safeParse({
			...h90,
			jacks: [
				{ kind: "in", edge: "top" },
				{ kind: "out", edge: "left", pos: 0.25 },
			],
		});
		expect(parsed.success).toBe(true);
	});
});
