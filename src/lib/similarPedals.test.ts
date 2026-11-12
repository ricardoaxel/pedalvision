import { describe, expect, it } from "vitest";
import { catalog } from "../catalog/load";
import {
	CIRCUITS,
	FAMILY_RULES,
	familyOf,
	mappedCatalogIds,
} from "./similarModel";
import {
	browseAllLabel,
	type SimilarGroup,
	similarPedalGroups,
} from "./similarPedals";

function pedal(id: string) {
	const found = catalog.pedals.find((candidate) => candidate.id === id);
	if (!found) throw new Error(`missing fixture pedal ${id}`);
	return found;
}

function ids(group: SimilarGroup | undefined): string[] {
	return group?.items.map((entry) => entry.id) ?? [];
}

describe("similarPedalGroups", () => {
	it("puts other-brand digital delays first, then the DD family lineage", () => {
		const groups = similarPedalGroups(
			pedal("boss-dd-3-digital-delay"),
			catalog.pedals,
		);
		expect(groups.map((group) => group.tier)).toEqual(["subtype", "family"]);
		const cross = groups[0];
		expect(cross?.label).toBe("Other digital delays");
		expect(ids(cross)).toEqual([
			"tc-electronic-alter-ego-v2-vintage-echo",
			"behringer-dd600-digital-delay",
			"walrus-audio-arp-87",
		]);
		const family = groups[1];
		expect(family?.label).toBe("Also from BOSS");
		// Successor/replacement first; the DD-2 predecessor is last.
		expect(ids(family)).toEqual([
			"boss-dd-3t-digital-delay",
			"boss-dd-5-digital-delay",
			"boss-dd-6-digital-delay",
			"boss-dd-7-digital-delay",
			"boss-dd-8-digital-delay",
		]);
		// Never the selected model, a large-format DD, or a colourway.
		expect(ids(family)).not.toContain("boss-dd-3-digital-delay");
		expect(ids(family)).not.toContain("boss-dd-20-giga-delay");
		expect(family?.items[0]?.shortLabel).toBe("DD-3T");
	});

	it("groups cross-brand BBD analog delays and the Carbon Copy family", () => {
		const groups = similarPedalGroups(pedal("mxr-carbon-copy"), catalog.pedals);
		expect(groups[0]?.tier).toBe("circuit");
		expect(groups[0]?.label).toBe("BBD analog delay");
		expect(ids(groups[0])).toContain(
			"tc-electronic-bucket-brigade-analog-delay",
		);
		expect(ids(groups[0])).toContain("mooer-ana-echo");
		const family = groups[1];
		expect(family?.label).toBe("Also from MXR");
		expect(ids(family)).toEqual([
			"mxr-carbon-copy-mini",
			"mxr-carbon-copy-bright",
			"mxr-carbon-copy-deluxe",
		]);
		expect(ids(family)).not.toContain(
			"mxr-carbon-copy-analog-10th-anniversary",
		);
	});

	it("treats Tube Screamer-style pedals as sound-alikes across brands", () => {
		const groups = similarPedalGroups(pedal("jhs-808"), catalog.pedals);
		expect(groups).toHaveLength(1);
		expect(groups[0]?.tier).toBe("circuit");
		expect(groups[0]?.label).toBe("Screamer-style overdrive");
		expect(ids(groups[0])).toEqual([
			"jhs-3-series-screamer",
			"boss-sd-1-super-overdrive",
		]);
	});

	it("shows the SD-1 family and its Tube Screamer-adjacent peers", () => {
		const groups = similarPedalGroups(
			pedal("boss-sd-1-super-overdrive"),
			catalog.pedals,
		);
		expect(groups[0]?.label).toBe("Screamer-style overdrive");
		expect(ids(groups[0])).toContain("jhs-808");
		expect(ids(groups[0])).toContain("jhs-3-series-screamer");
		expect(groups[1]?.label).toBe("Also from BOSS");
		expect(ids(groups[1])).toEqual(["boss-sd-1w-super-overdrive-waza-craft"]);
	});

	it("never falls back to a broad effect match", () => {
		// A generic overdrive with no circuit or family evidence.
		expect(
			similarPedalGroups(pedal("boss-bc-2-combo-drive"), catalog.pedals),
		).toEqual([]);
		// A utility tool is not a pedal alternative.
		expect(
			similarPedalGroups(
				pedal("boss-psm-5-power-supply-master-switch"),
				catalog.pedals,
			),
		).toEqual([]);
	});

	it("never suggests bass models for a guitar target", () => {
		const groups = similarPedalGroups(
			pedal("boss-dd-3-digital-delay"),
			catalog.pedals,
		);
		for (const group of groups) {
			for (const candidate of group.items) {
				expect(candidate.name).not.toMatch(/\bBass\b/);
			}
		}
	});

	it("is deterministic for repeat calls", () => {
		const target = pedal("boss-dd-3-digital-delay");
		expect(similarPedalGroups(target, catalog.pedals)).toEqual(
			similarPedalGroups(target, catalog.pedals),
		);
	});

	it("does not mutate the catalog", () => {
		const snapshot = JSON.stringify(catalog.pedals);
		similarPedalGroups(pedal("boss-dd-3-digital-delay"), catalog.pedals);
		expect(JSON.stringify(catalog.pedals)).toBe(snapshot);
	});

	it("only maps catalogue ids that actually exist", () => {
		const ids = new Set(catalog.pedals.map((candidate) => candidate.id));
		for (const id of mappedCatalogIds()) {
			expect(ids.has(id), `mapped id missing from catalogue: ${id}`).toBe(true);
		}
	});

	it("every family rule matches at least one catalogue model", () => {
		for (const rule of FAMILY_RULES) {
			const match = catalog.pedals.some(
				(candidate) =>
					candidate.brand === rule.brand &&
					rule.pattern.test(candidate.name) &&
					!rule.skip?.test(candidate.name),
			);
			expect(match, `dead family rule: ${rule.brand} ${rule.key}`).toBe(true);
		}
	});

	it("every circuit family has at least two catalogue members", () => {
		const ids = new Set(catalog.pedals.map((candidate) => candidate.id));
		for (const def of CIRCUITS) {
			const members = [...def.core, ...(def.adjacent ?? [])];
			expect(members.length, `dead circuit: ${def.key}`).toBeGreaterThanOrEqual(
				2,
			);
			for (const id of members) {
				expect(ids.has(id), `${def.key} references missing ${id}`).toBe(true);
			}
		}
	});

	it("every circuit family is reachable from at least one member", () => {
		for (const def of CIRCUITS) {
			const reachable = def.core.some((id) => {
				const target = catalog.pedals.find((candidate) => candidate.id === id);
				return (
					target &&
					similarPedalGroups(target, catalog.pedals).some(
						(group) => group.tier === "circuit",
					)
				);
			});
			expect(reachable, `unreachable circuit: ${def.key}`).toBe(true);
		}
	});

	it("maps known family edges (Mercury, MT-2, Keeley 1962)", () => {
		expect(familyOf(pedal("meris-mercury7"))?.key).toBe("meris-mercury");
		expect(familyOf(pedal("meris-mercuryx"))?.key).toBe("meris-mercury");
		expect(familyOf(pedal("boss-mt-2-metal-zone"))?.key).toBe("boss-mt2");
		expect(familyOf(pedal("boss-mt-2w-metal-zone-waza-craft"))?.key).toBe(
			"boss-mt2",
		);
		expect(familyOf(pedal("keeley-1962"))?.key).toBe("keeley-1962");
		expect(familyOf(pedal("keeley-1962x"))?.key).toBe("keeley-1962");
	});

	it("keeps the nearest predecessor when a family cap trims", () => {
		const groups = similarPedalGroups(
			pedal("boss-dd-8-digital-delay"),
			catalog.pedals,
		);
		const family = groups.find((group) => group.tier === "family");
		expect(ids(family)).toContain("boss-dd-7-digital-delay");
		expect(ids(family)).not.toContain("boss-dd-2-digital-delay");
	});

	it("labels the broad browse action in the active taxonomy", () => {
		expect(browseAllLabel(pedal("boss-dd-3-digital-delay"))).toBe(
			"Browse all delays",
		);
		expect(browseAllLabel(pedal("jhs-808"))).toBe("Browse all overdrives");
		expect(
			browseAllLabel(pedal("boss-psm-5-power-supply-master-switch")),
		).toBeNull();
	});
});
