import { describe, expect, it } from "vitest";
import type { CatalogBoard, CatalogPedal } from "../catalog/schema";
import {
	brandsOf,
	effectLabel,
	filterBoards,
	filterPedals,
	toggleEffectType,
} from "./pickerFilter";

function pedal(
	overrides: Partial<CatalogPedal> & Pick<CatalogPedal, "id">,
): CatalogPedal {
	return {
		brand: "Boss",
		name: "Model",
		widthCm: 7,
		heightCm: 12,
		image: "mock.png",
		imageSource: "mock",
		effectTypes: [],
		category: "pedal",
		source: "placeholder",
		...overrides,
	};
}

function board(
	overrides: Partial<CatalogBoard> & Pick<CatalogBoard, "id">,
): CatalogBoard {
	return {
		brand: "Pedaltrain",
		name: "Classic 1",
		widthCm: 40,
		heightCm: 20,
		image: "mock.png",
		imageSource: "mock",
		source: "placeholder",
		...overrides,
	};
}

const PEDALS: CatalogPedal[] = [
	pedal({ id: "boss-ds-1", name: "DS-1", effectTypes: ["distortion"] }),
	pedal({
		id: "boss-dd-8",
		brand: "Boss",
		name: "DD-8",
		effectTypes: ["delay", "reverb"],
	}),
	pedal({
		id: "mxr-phase-90",
		brand: "MXR",
		name: "Phase 90",
		effectTypes: ["phaser"],
	}),
	pedal({ id: "boss-psu", name: "Power Supply", category: "supply" }),
];

describe("filterPedals", () => {
	const none = { query: "", brand: null, effectTypes: [] };

	it("returns only category=pedal when unfiltered (supplies excluded)", () => {
		const ids = filterPedals(PEDALS, none).map((p) => p.id);
		expect(ids).toEqual(["boss-ds-1", "boss-dd-8", "mxr-phase-90"]);
	});

	it("matches the query against brand and name, case-insensitively", () => {
		expect(
			filterPedals(PEDALS, { ...none, query: "phase" }).map((p) => p.id),
		).toEqual(["mxr-phase-90"]);
		expect(
			filterPedals(PEDALS, { ...none, query: "  BOSS " }).map((p) => p.id),
		).toEqual(["boss-ds-1", "boss-dd-8"]);
	});

	it("filters by exact brand", () => {
		expect(
			filterPedals(PEDALS, { ...none, brand: "MXR" }).map((p) => p.id),
		).toEqual(["mxr-phase-90"]);
	});

	it("matches ANY selected effect type (OR)", () => {
		expect(
			filterPedals(PEDALS, { ...none, effectTypes: ["delay", "phaser"] }).map(
				(p) => p.id,
			),
		).toEqual(["boss-dd-8", "mxr-phase-90"]);
	});

	it("combines query, brand and effect filters", () => {
		expect(
			filterPedals(PEDALS, {
				query: "dd",
				brand: "Boss",
				effectTypes: ["delay"],
			}).map((p) => p.id),
		).toEqual(["boss-dd-8"]);
		// A brand with no matching name → empty.
		expect(
			filterPedals(PEDALS, { ...none, query: "dd", brand: "MXR" }),
		).toHaveLength(0);
	});
});

describe("filterBoards", () => {
	const BOARDS: CatalogBoard[] = [
		board({ id: "pedaltrain-classic-1", name: "Classic 1" }),
		board({ id: "pedaltrain-nano", name: "Nano", brand: "Pedaltrain" }),
		board({ id: "gator-gpb", brand: "Gator", name: "GPB" }),
	];

	it("returns all boards when unfiltered", () => {
		expect(filterBoards(BOARDS, { query: "", brand: null })).toHaveLength(3);
	});

	it("filters by query against brand + name", () => {
		expect(
			filterBoards(BOARDS, { query: "nano", brand: null }).map((b) => b.id),
		).toEqual(["pedaltrain-nano"]);
	});

	it("filters by brand", () => {
		expect(
			filterBoards(BOARDS, { query: "", brand: "Gator" }).map((b) => b.id),
		).toEqual(["gator-gpb"]);
	});
});

describe("brandsOf", () => {
	it("returns sorted distinct brands", () => {
		expect(brandsOf(PEDALS)).toEqual(["Boss", "MXR"]);
	});
});

describe("toggleEffectType", () => {
	it("adds a missing type", () => {
		expect(toggleEffectType(["delay"], "reverb")).toEqual(["delay", "reverb"]);
	});

	it("removes a present type", () => {
		expect(toggleEffectType(["delay", "reverb"], "delay")).toEqual(["reverb"]);
	});
});

describe("effectLabel", () => {
	it("title-cases hyphenated identifiers", () => {
		expect(effectLabel("tremolo")).toBe("Tremolo");
		expect(effectLabel("ring-mod")).toBe("Ring Mod");
	});

	it("keeps acronyms and slashes correct", () => {
		expect(effectLabel("eq")).toBe("EQ");
		expect(effectLabel("di")).toBe("DI");
		expect(effectLabel("ab-box")).toBe("A/B Box");
	});
});
