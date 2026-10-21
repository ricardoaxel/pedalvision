import { describe, expect, it } from "vitest";
import { brandKey, buildInventory, type DiscoveryRow } from "./inventory.ts";
import { CATALOG_LIMITS } from "./limits.ts";

function pedal(
	brand: string,
	name: string,
	width = 2.5,
	height = 4.5,
): DiscoveryRow {
	return { Brand: brand, Name: name, Width: width, Height: height };
}

function board(brand: string, name: string): DiscoveryRow {
	return { Brand: brand, Name: name, Width: 24, Height: 12 };
}

describe("brandKey", () => {
	it("collapses board-brand aliases", () => {
		expect(brandKey("Templeboards")).toBe("temple-audio");
		expect(brandKey("Temple Audio")).toBe("temple-audio");
		expect(brandKey("Morton Pedalboards")).toBe("morton");
		expect(brandKey("Rockboard by Warwick")).toBe("rockboard");
	});
});

describe("buildInventory", () => {
	it("dedupes, collapses colorways and converts inches to cm", () => {
		const inventory = buildInventory(
			[
				pedal("BOSS", "DS-1 Distortion"),
				pedal("BOSS", "DS-1 Distortion"),
				pedal("BOSS", "DS-1 Distortion (Black)"),
				pedal("Electro-Harmonix", "Big Muff Pi"),
			],
			[board("Pedaltrain", "Classic 2")],
			{ generatedAt: "2026-10-21" },
		);
		expect(inventory.summary.pedals.discovered).toBe(4);
		expect(inventory.summary.pedals.duplicatesRemoved).toBe(1);
		expect(inventory.summary.pedals.unique).toBe(3);
		expect(inventory.summary.pedals.variants).toBe(1);
		const ds1 = inventory.pedals.find(
			(item) => item.id === "boss-ds-1-distortion",
		);
		const black = inventory.pedals.find(
			(item) => item.id === "boss-ds-1-distortion-black",
		);
		expect(ds1?.widthCm).toBe(6.35);
		expect(ds1?.heightCm).toBe(11.43);
		expect(black?.variantOf).toBe("boss-ds-1-distortion");
	});

	it("keeps a real '+' model distinct from its base model", () => {
		const inventory = buildInventory(
			[
				pedal("Electro-Harmonix", "Pitch Fork"),
				pedal("Electro-Harmonix", "Pitch Fork+"),
			],
			[],
			{ generatedAt: "2026-10-21" },
		);
		expect(inventory.summary.pedals.unique).toBe(2);
		expect(inventory.summary.pedals.duplicatesRemoved).toBe(0);
		expect(inventory.pedals.map((item) => item.id).sort()).toEqual([
			"electro-harmonix-pitch-fork",
			"electro-harmonix-pitch-fork-plus",
		]);
	});

	it("marks seed overlap by canonical brand + name", () => {
		const inventory = buildInventory(
			[pedal("BOSS", "DS-1 Distortion")],
			[board("Creation Music Co", "Aero 17x12.5")],
			{
				generatedAt: "2026-10-21",
				seedPedals: [{ brand: "BOSS", name: "DS-1 Distortion" }],
				seedBoards: [{ brand: "Creation Music Co", name: "Aero 17x12.5" }],
			},
		);
		expect(inventory.summary.pedals.seedOverlap).toBe(1);
		expect(inventory.summary.boards.seedOverlap).toBe(1);
		expect(inventory.pedals[0]?.seed).toBe(true);
		expect(inventory.boards[0]?.seed).toBe(true);
	});

	it("caps Tier A at exactly 1,850 pedals", () => {
		const rows = Array.from({ length: 1900 }, (_, index) =>
			pedal("BOSS", `Model ${String(index).padStart(4, "0")}`),
		);
		const inventory = buildInventory(rows, [], { generatedAt: "2026-10-21" });
		expect(inventory.summary.pedals.tierA).toBe(CATALOG_LIMITS.tierAPedals);
		expect(inventory.summary.pedals.tierA).toBe(1850);
		expect(
			inventory.summary.pedals.tierB + inventory.summary.pedals.tierC,
		).toBe(50);
	});

	it("caps Tier A at exactly 150 boards", () => {
		const boards = Array.from({ length: 200 }, (_, index) =>
			board("Pedaltrain", `Board ${String(index).padStart(3, "0")}`),
		);
		const inventory = buildInventory([], boards, {
			generatedAt: "2026-10-21",
		});
		expect(inventory.summary.boards.tierA).toBe(CATALOG_LIMITS.tierABoards);
		expect(inventory.summary.boards.tierA).toBe(150);
		expect(
			inventory.summary.boards.tierB + inventory.summary.boards.tierC,
		).toBe(50);
	});

	it("skips invalid rows instead of inventing dimensions", () => {
		const inventory = buildInventory(
			[
				{ Brand: "Acme", Name: "No size", Width: 0, Height: 4 },
				{ Brand: "", Name: "No brand", Width: 2, Height: 4 },
				pedal("Acme", "Good"),
			],
			[{ Brand: "Acme", Name: "Bad board" }],
			{ generatedAt: "2026-10-21" },
		);
		expect(inventory.summary.pedals.skipped).toBe(2);
		expect(inventory.summary.pedals.unique).toBe(1);
		expect(inventory.summary.boards.skipped).toBe(1);
	});
});
