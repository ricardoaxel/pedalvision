import { describe, expect, it } from "vitest";
import type { CatalogPedal } from "../catalog/schema";
import type { CustomPedal, ResolvedItem } from "../state/scene";
import {
	buildPartInfo,
	formatDimensions,
	formatJack,
	formatPower,
} from "./partInfo";

function resolved(
	definition: CatalogPedal | null,
	custom: CustomPedal | null,
	name = "x",
): ResolvedItem {
	return {
		name,
		widthCm: definition?.widthCm ?? custom?.widthCm ?? 7,
		heightCm: definition?.heightCm ?? custom?.heightCm ?? 12,
		definition,
		custom,
	};
}

const catalogWithSpecs: CatalogPedal = {
	id: "test-delay",
	brand: "Acme",
	name: "Echo",
	widthCm: 7.3,
	heightCm: 12.4,
	image: "acme-echo.png",
	imageSource: "mock",
	effectTypes: ["delay", "eq"],
	category: "pedal",
	jacks: [
		{ kind: "in", edge: "top", pos: 0.3 },
		{ kind: "out", edge: "top", pos: 0.7 },
	],
	power: { voltage: 9, acDc: "DC", currentMa: 100 },
	source: "placeholder",
};

const catalogBare: CatalogPedal = {
	id: "test-bare",
	brand: "Boss",
	name: "BD-2",
	widthCm: 7.3,
	heightCm: 13.02,
	image: "boss-bd-2.png",
	imageSource: "mock",
	effectTypes: ["overdrive"],
	category: "pedal",
	source: "placeholder",
};

const customSupply: CustomPedal = {
	refId: "custom-1",
	brand: "MyBuild",
	name: "Brick",
	widthCm: 20,
	heightCm: 8,
	category: "supply",
	effectTypes: [],
	jacks: [{ kind: "power", edge: "right", pos: 0.5 }],
	power: { voltage: 12, acDc: "AC", currentMa: 500 },
};

describe("buildPartInfo", () => {
	it("surfaces a catalog item's specs when present", () => {
		const info = buildPartInfo(resolved(catalogWithSpecs, null), "pedal");
		expect(info).toMatchObject({
			brand: "Acme",
			name: "Echo",
			category: "pedal",
			isCustom: false,
			unknown: false,
		});
		expect(info.effectTypes).toEqual(["delay", "eq"]);
		expect(info.jacks).toHaveLength(2);
		expect(info.power).toEqual({ voltage: 9, acDc: "DC", currentMa: 100 });
		expect(info.image).toEqual({ source: "mock", value: "acme-echo.png" });
	});

	it("omits power + jacks for a bare catalog item (graceful degradation)", () => {
		const info = buildPartInfo(resolved(catalogBare, null), "pedal");
		expect(info.jacks).toEqual([]);
		expect(info.power).toBeNull();
		// A bare catalog item still has an image (the preview's anchor).
		expect(info.image).toEqual({ source: "mock", value: "boss-bd-2.png" });
	});

	it("marks an inline custom part (text-only — no image)", () => {
		const info = buildPartInfo(resolved(null, customSupply), "supply");
		expect(info.isCustom).toBe(true);
		expect(info.category).toBe("supply");
		expect(info.jacks).toHaveLength(1);
		expect(info.power?.acDc).toBe("AC");
		expect(info.image).toBeNull();
	});

	it("flags an unresolved ref and keeps its geometry", () => {
		const info = buildPartInfo(resolved(null, null, "ghost-ref"), "supply");
		expect(info.unknown).toBe(true);
		expect(info.name).toBe("ghost-ref");
		expect(info.category).toBe("supply");
		expect(info.power).toBeNull();
		expect(info.image).toBeNull();
	});
});

describe("formatters", () => {
	it("switches dimensions between cm and inches (display-only)", () => {
		expect(formatDimensions(6.35, 12.7, "cm")).toBe("6.35 × 12.7 cm");
		expect(formatDimensions(6.35, 12.7, "in")).toBe("2.5 × 5 in");
	});

	it("formats power as voltage · AC/DC · current", () => {
		expect(formatPower({ voltage: 9, acDc: "DC", currentMa: 100 })).toBe(
			"9 V · DC · 100 mA",
		);
	});

	it("formats a jack as kind · edge · position", () => {
		expect(formatJack({ kind: "exp-in", edge: "bottom", pos: 0.3 })).toBe(
			"Exp In · Bottom · 0.30",
		);
		expect(formatJack({ kind: "midi", edge: "left", pos: 0.5 })).toBe(
			"MIDI · Left · 0.50",
		);
	});
});
