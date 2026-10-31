import { describe, expect, it } from "vitest";
import type { CatalogBoard, CatalogPedal } from "../catalog/schema";
import { SEARCH_ALIASES } from "../lib/searchAliases";
import {
	brandsOf,
	buildBoardIndex,
	buildPedalIndex,
	effectLabel,
	filterBoardIndex,
	filterBoards,
	filterPedalIndex,
	filterPedals,
	normalizeSearch,
	pedalBrands,
	queryTerms,
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
	pedal({
		id: "voodoo-psu",
		brand: "Voodoo Lab",
		name: "Pedal Power",
		category: "supply",
	}),
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
		).toEqual(["boss-dd-8", "boss-ds-1"]);
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
		expect(brandsOf(PEDALS)).toEqual(["Boss", "MXR", "Voodoo Lab"]);
	});
});

describe("pedalBrands", () => {
	it("excludes supply-only brands from the pedals menu", () => {
		// "Voodoo Lab" only makes supplies in the fixture → must not be offered.
		expect(pedalBrands(PEDALS)).toEqual(["Boss", "MXR"]);
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

const SEARCH_PEDALS: CatalogPedal[] = [
	pedal({
		id: "boss-dd-2-digital-delay",
		name: "DD-2 Digital Delay",
		effectTypes: ["delay"],
	}),
	pedal({
		id: "boss-dd-20-giga-delay",
		name: "DD-20 Giga Delay",
		effectTypes: ["delay"],
	}),
	pedal({
		id: "boss-dd-200-digital-delay",
		name: "DD-200 Digital Delay",
		effectTypes: ["delay"],
	}),
	pedal({
		id: "boss-bd-2-blues-driver",
		name: "BD-2 Blues Driver",
		effectTypes: ["overdrive"],
	}),
	pedal({
		id: "ehx-big-muff",
		brand: "Electro-Harmonix",
		name: "Big Muff Pi",
		effectTypes: ["fuzz"],
	}),
	pedal({
		id: "eqd-plumes",
		brand: "EarthQuaker",
		name: "Plumes",
		effectTypes: ["overdrive"],
	}),
	pedal({
		id: "tc-choka",
		brand: "TC Electronic",
		name: "Choka Tremolo",
		effectTypes: ["tremolo"],
	}),
	pedal({
		id: "keeley-angry-orange",
		brand: "Keeley",
		name: "Angry Orange",
		effectTypes: ["fuzz"],
	}),
];

describe("normalizeSearch", () => {
	it("lowercases, trims and folds punctuation/whitespace", () => {
		expect(normalizeSearch("  DD-2  ")).toBe("dd 2");
		expect(normalizeSearch("DD_2")).toBe("dd 2");
		expect(normalizeSearch("A/B")).toBe("a b");
		expect(normalizeSearch("  Boss   BD-2 ")).toBe("boss bd 2");
	});

	it("strips diacritics and expands ampersands", () => {
		expect(normalizeSearch("Ibañez")).toBe("ibanez");
		expect(normalizeSearch("A&B")).toBe("a and b");
	});

	it("returns an empty key for punctuation-only input", () => {
		expect(normalizeSearch("!!!")).toBe("");
	});
});

describe("queryTerms", () => {
	it("keeps a hyphenated model as one term", () => {
		expect(queryTerms("DD-2")).toEqual(["dd 2"]);
		expect(queryTerms("boss dd-2")).toEqual(["boss", "dd 2"]);
	});

	it("drops empty chunks", () => {
		expect(queryTerms("  BOSS,  ")).toEqual(["boss"]);
		expect(queryTerms("!!!")).toEqual([]);
	});
});

describe("search matching", () => {
	const index = buildPedalIndex(SEARCH_PEDALS);
	const search = (query: string) =>
		filterPedalIndex(index, { query, brand: null, effectTypes: [] }).map(
			(p) => p.id,
		);

	it("finds DD-2 from every model shorthand form, not DD-20/DD-200", () => {
		for (const query of ["dd2", "DD-2", "dd-2", "DD 2", "dd 2"]) {
			expect(search(query)).toEqual(["boss-dd-2-digital-delay"]);
		}
	});

	it("finds BD-2 from bd2", () => {
		expect(search("bd2")).toEqual(["boss-bd-2-blues-driver"]);
	});

	it("searches effect labels as well as names", () => {
		expect(search("fuzz")).toEqual(["ehx-big-muff", "keeley-angry-orange"]);
	});

	it("resolves brand aliases", () => {
		expect(search("ehx")).toEqual(["ehx-big-muff"]);
		expect(search("eqd")).toEqual(["eqd-plumes"]);
		expect(search("tc")).toEqual(["tc-choka"]);
	});

	it("requires every term (AND), not a contiguous substring", () => {
		expect(search("boss delay")).toEqual([
			"boss-dd-20-giga-delay",
			"boss-dd-2-digital-delay",
			"boss-dd-200-digital-delay",
		]);
		expect(search("keeley fuzz")).toEqual(["keeley-angry-orange"]);
	});

	it("returns nothing for a punctuation-only query", () => {
		expect(search("!!!")).toEqual([]);
	});
});

describe("picker sort", () => {
	const index = buildPedalIndex(SEARCH_PEDALS);
	const ids = (sort: "relevance" | "brand" | "name", query = "") =>
		filterPedalIndex(index, {
			query,
			brand: null,
			effectTypes: [],
			sort,
		}).map((p) => p.id);

	it("relevance puts the exact model first", () => {
		expect(ids("relevance", "dd2")[0]).toBe("boss-dd-2-digital-delay");
	});

	it("relevance keeps catalog order when the query is empty", () => {
		expect(ids("relevance")).toEqual(SEARCH_PEDALS.map((p) => p.id));
	});

	it("relevance ranks a name match above effect-only matches", () => {
		const items = [
			pedal({ id: "delay-llama", name: "Delay Llama", effectTypes: ["delay"] }),
			pedal({ id: "big-muff", name: "Big Muff", effectTypes: ["delay"] }),
		];
		expect(
			filterPedals(items, {
				query: "delay",
				brand: null,
				effectTypes: [],
				sort: "relevance",
			}).map((p) => p.id),
		).toEqual(["delay-llama", "big-muff"]);
	});

	it("combines brand, effect and query filters", () => {
		expect(
			filterPedals(SEARCH_PEDALS, {
				query: "fuzz",
				brand: "Keeley",
				effectTypes: ["fuzz"],
				sort: "relevance",
			}).map((p) => p.id),
		).toEqual(["keeley-angry-orange"]);
	});

	it("sorts by brand A–Z, then name, then id", () => {
		expect(ids("brand")).toEqual([
			"boss-bd-2-blues-driver",
			"boss-dd-2-digital-delay",
			"boss-dd-20-giga-delay",
			"boss-dd-200-digital-delay",
			"eqd-plumes",
			"ehx-big-muff",
			"keeley-angry-orange",
			"tc-choka",
		]);
	});

	it("sorts by name A–Z, then brand, then id", () => {
		expect(ids("name")).toEqual([
			"keeley-angry-orange",
			"boss-bd-2-blues-driver",
			"ehx-big-muff",
			"tc-choka",
			"boss-dd-2-digital-delay",
			"boss-dd-20-giga-delay",
			"boss-dd-200-digital-delay",
			"eqd-plumes",
		]);
	});

	it("is deterministic across repeated calls", () => {
		expect(ids("relevance", "delay")).toEqual(ids("relevance", "delay"));
		expect(ids("brand")).toEqual(ids("brand"));
	});
});

describe("search index reuse", () => {
	it("filters a prebuilt board index like the convenience wrapper", () => {
		const boards: CatalogBoard[] = [
			board({ id: "pedaltrain-nano", name: "Nano" }),
			board({ id: "gator-gpb", brand: "Gator", name: "GPB" }),
		];
		const index = buildBoardIndex(boards);
		expect(filterBoardIndex(index, { query: "nano", brand: null })).toEqual(
			filterBoards(boards, { query: "nano", brand: null }),
		);
	});
});

describe("search aliases", () => {
	it("has normalized keys and non-empty targets", () => {
		for (const [alias, targets] of Object.entries(SEARCH_ALIASES)) {
			expect(alias).toBe(normalizeSearch(alias));
			expect(targets.length).toBeGreaterThan(0);
			for (const target of targets)
				expect(target).toBe(normalizeSearch(target));
		}
	});
});

describe("progressive and prefix matching", () => {
	const items: CatalogPedal[] = [
		pedal({
			id: "darkglass-b7k-ultra",
			brand: "Darkglass",
			name: "Microtubes B7K Ultra",
			effectTypes: ["distortion"],
		}),
		pedal({
			id: "tc-polytune",
			brand: "TC Electronic",
			name: "Polytune",
			effectTypes: ["tuner"],
		}),
		pedal({
			id: "keeley-hydra",
			brand: "Keeley",
			name: "Hydra",
			effectTypes: ["reverb"],
		}),
		pedal({
			id: "boss-dd-2",
			name: "DD-2 Digital Delay",
			effectTypes: ["delay"],
		}),
		pedal({
			id: "boss-dd-20",
			name: "DD-20 Giga Delay",
			effectTypes: ["delay"],
		}),
		pedal({
			id: "boss-dd-200",
			name: "DD-200 Digital Delay",
			effectTypes: ["delay"],
		}),
		pedal({
			id: "fender-fbm-1",
			brand: "Fender",
			name: "FBM-1 '59 Fender Bassman",
			effectTypes: ["amp-modeler"],
		}),
		pedal({
			id: "moog-mf-103",
			brand: "Moog",
			name: "MF-103 12-Stage Phaser",
			effectTypes: ["phaser"],
		}),
		pedal({
			id: "boss-jf-11",
			brand: "BOSS",
			name: "JF-11 6 Band EQ",
			effectTypes: ["eq"],
		}),
		pedal({
			id: "dod-250",
			brand: "DOD",
			name: "DOD 250 (50th Anniversary)",
			effectTypes: ["overdrive"],
		}),
		pedal({
			id: "mxr-phase-90",
			brand: "MXR",
			name: "Phase 90",
			effectTypes: ["phaser"],
		}),
		pedal({
			id: "strymon-bigsky",
			brand: "Strymon",
			name: "BigSky",
			effectTypes: ["reverb"],
		}),
	];
	const index = buildPedalIndex(items);
	const search = (query: string) =>
		filterPedalIndex(index, {
			query,
			brand: null,
			effectTypes: [],
			sort: "relevance",
		}).map((p) => p.id);

	it("matches a concatenated model + word", () => {
		expect(search("b7kultra")).toEqual(["darkglass-b7k-ultra"]);
	});

	it("matches every progressive prefix while typing b7kultra", () => {
		for (const query of [
			"b7k",
			"b7ku",
			"b7kul",
			"b7kult",
			"b7kultr",
			"b7kultra",
		]) {
			expect(search(query)).toContain("darkglass-b7k-ultra");
		}
	});

	it("matches alphabetic prefixes", () => {
		expect(search("polytun")).toEqual(["tc-polytune"]);
		expect(search("hydr")).toEqual(["keeley-hydra"]);
	});

	it("matches an internal substring for alphabetic terms", () => {
		expect(search("tune")).toEqual(["tc-polytune"]);
	});

	it("still separates dd2 from dd20 and dd200", () => {
		expect(search("dd2")).toEqual(["boss-dd-2"]);
		expect(search("dd20")).toEqual(["boss-dd-20"]);
		expect(search("dd200")).toEqual(["boss-dd-200"]);
	});

	it("does not treat a following numeric token as the same number", () => {
		expect(search("fbm1")).toContain("fender-fbm-1");
		expect(search("mf103")).toContain("moog-mf-103");
		expect(search("jf11")).toContain("boss-jf-11");
	});

	it("matches a concatenated brand + model", () => {
		expect(search("bossdd2")).toContain("boss-dd-2");
		expect(search("mxrphase90")).toContain("mxr-phase-90");
		expect(search("strymonbigsky")).toContain("strymon-bigsky");
	});
});
