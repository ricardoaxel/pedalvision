import { describe, expect, it } from "vitest";
import type { CustomPedal } from "../state/scene";
import {
	type CustomPedalDraft,
	changeDraftUnits,
	draftFromCustomPedal,
	emptyCustomPedalDraft,
	formatDimension,
	jackKindLabel,
	parseDimensionToCm,
	validateCustomPedalDraft,
} from "./customPedal";

/** A valid base draft (metric). */
function validDraft(
	overrides: Partial<CustomPedalDraft> = {},
): CustomPedalDraft {
	return {
		...emptyCustomPedalDraft("cm"),
		name: "My Fuzz",
		width: "6",
		depth: "12",
		...overrides,
	};
}

describe("parseDimensionToCm", () => {
	it("parses cm and in to canonical cm", () => {
		expect(parseDimensionToCm("6.35", "cm")).toBeCloseTo(6.35, 12);
		expect(parseDimensionToCm("2.5", "in")).toBeCloseTo(6.35, 12);
	});

	it("accepts a comma decimal separator", () => {
		expect(parseDimensionToCm("2,5", "in")).toBeCloseTo(6.35, 12);
	});

	it("rejects empty, zero, negative and non-numeric input", () => {
		expect(parseDimensionToCm("", "cm")).toBeNull();
		expect(parseDimensionToCm("  ", "cm")).toBeNull();
		expect(parseDimensionToCm("0", "cm")).toBeNull();
		expect(parseDimensionToCm("-3", "cm")).toBeNull();
		expect(parseDimensionToCm("abc", "cm")).toBeNull();
	});
});

describe("formatDimension", () => {
	it("formats canonical cm in the display unit (2 decimals)", () => {
		expect(formatDimension(6.35, "cm")).toBe("6.35");
		expect(formatDimension(6.35, "in")).toBe("2.5");
	});
});

describe("changeDraftUnits", () => {
	it("converts both dimensions via cm (exact for exact values)", () => {
		const metric = validDraft({ width: "6.35", depth: "12.7" });
		const imperial = changeDraftUnits(metric, "in");
		expect(imperial.units).toBe("in");
		expect(imperial.width).toBe("2.5");
		expect(imperial.depth).toBe("5");
		// Round-trip back to cm reproduces the original exactly.
		const back = changeDraftUnits(imperial, "cm");
		expect(back.width).toBe("6.35");
		expect(back.depth).toBe("12.7");
	});

	it("rounds inexact conversions to the 2-decimal display precision", () => {
		// 7 cm = 2.7559 in → displayed as 2.76 in (documented limitation).
		expect(changeDraftUnits(validDraft({ width: "7" }), "in").width).toBe(
			"2.76",
		);
	});

	it("preserves exact cm across a unit toggle when canonical is set", () => {
		const draft: CustomPedalDraft = {
			...validDraft({ width: "7", depth: "7" }),
			widthCm: 7,
			depthCm: 7,
		};
		const imperial = changeDraftUnits(draft, "in");
		expect(imperial.width).toBe("2.76");
		// The canonical cm is unchanged, so saving is exact (no drift).
		expect(imperial.widthCm).toBe(7);
		const result = validateCustomPedalDraft(imperial);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.widthCm).toBe(7);
		expect(result.value.heightCm).toBe(7);
	});

	it("keeps an invalid dimension verbatim (no data loss)", () => {
		const draft = validDraft({ width: "" });
		expect(changeDraftUnits(draft, "in").width).toBe("");
	});

	it("is a no-op when the unit is unchanged", () => {
		const draft = validDraft();
		expect(changeDraftUnits(draft, "cm")).toBe(draft);
	});
});

describe("validateCustomPedalDraft", () => {
	it("accepts a minimal valid pedal", () => {
		const result = validateCustomPedalDraft(validDraft());
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.name).toBe("My Fuzz");
		expect(result.value.widthCm).toBe(6);
		expect(result.value.heightCm).toBe(12);
		expect(result.value.jacks).toBeUndefined();
		expect(result.value.power).toBeUndefined();
	});

	it("converts dimensions from the active unit", () => {
		const result = validateCustomPedalDraft(
			validDraft({ units: "in", width: "2.5", depth: "5" }),
		);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.widthCm).toBeCloseTo(6.35, 12);
		expect(result.value.heightCm).toBeCloseTo(12.7, 12);
	});

	it("requires a name", () => {
		const result = validateCustomPedalDraft(validDraft({ name: "  " }));
		expect(result.ok).toBe(false);
		expect(result.errors.name).toBeDefined();
	});

	it("rejects missing / out-of-range dimensions", () => {
		expect(validateCustomPedalDraft(validDraft({ width: "" })).ok).toBe(false);
		expect(
			validateCustomPedalDraft(validDraft({ width: "200" })).errors.width,
		).toBeDefined();
		expect(
			validateCustomPedalDraft(validDraft({ depth: "-4" })).errors.depth,
		).toBeDefined();
	});

	it("requires power for a supply but not a pedal", () => {
		expect(validateCustomPedalDraft(validDraft()).ok).toBe(true);
		const supply = validateCustomPedalDraft(
			validDraft({ category: "supply", voltage: "", currentMa: "" }),
		);
		expect(supply.ok).toBe(false);
		expect(supply.errors.voltage).toBeDefined();
	});

	it("includes power when enabled and valid", () => {
		const result = validateCustomPedalDraft(
			validDraft({
				powerEnabled: true,
				voltage: "9",
				acDc: "DC",
				currentMa: "120",
			}),
		);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.power).toEqual({
			voltage: 9,
			acDc: "DC",
			currentMa: 120,
		});
	});

	it("clamps jack positions to 0..1 and passes them through", () => {
		const result = validateCustomPedalDraft(
			validDraft({
				jacks: [
					{ id: "j1", kind: "send", edge: "top", pos: 0.25 },
					{ id: "j2", kind: "return", edge: "bottom", pos: 1.4 },
				],
			}),
		);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.jacks).toEqual([
			{ kind: "send", edge: "top", pos: 0.25 },
			{ kind: "return", edge: "bottom", pos: 1 },
		]);
	});
});

describe("jackKindLabel", () => {
	it("labels the widened vocabulary", () => {
		expect(jackKindLabel("in")).toBe("In");
		expect(jackKindLabel("exp-in")).toBe("Exp In");
		expect(jackKindLabel("midi")).toBe("MIDI");
	});
});

describe("draftFromCustomPedal", () => {
	const custom: CustomPedal = {
		refId: "custom-x",
		brand: "Acme",
		name: "My Fuzz",
		widthCm: 6.35,
		heightCm: 12.7,
		category: "pedal",
		effectTypes: ["fuzz"],
		jacks: [{ kind: "in", edge: "top", pos: 0.5 }],
		power: { voltage: 9, acDc: "DC", currentMa: 40 },
	};

	it("seeds a draft from a stored definition (round-trips validation)", () => {
		const draft = draftFromCustomPedal(custom);
		expect(draft.name).toBe("My Fuzz");
		expect(draft.brand).toBe("Acme");
		expect(draft.width).toBe("6.35");
		expect(draft.depth).toBe("12.7");
		expect(draft.widthCm).toBe(6.35);
		expect(draft.depthCm).toBe(12.7);
		expect(draft.effectTypes).toEqual(["fuzz"]);
		expect(draft.jacks).toHaveLength(1);
		expect(draft.jacks[0]).toMatchObject({ kind: "in", edge: "top", pos: 0.5 });
		expect(draft.powerEnabled).toBe(true);
		expect(draft.voltage).toBe("9");
		expect(draft.currentMa).toBe("40");

		const result = validateCustomPedalDraft(draft);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.widthCm).toBeCloseTo(6.35, 12);
		expect(result.value.jacks).toEqual([{ kind: "in", edge: "top", pos: 0.5 }]);
		expect(result.value.power).toEqual({
			voltage: 9,
			acDc: "DC",
			currentMa: 40,
		});
	});

	it("seeds a part with no power and no jacks", () => {
		const draft = draftFromCustomPedal({
			...custom,
			power: undefined,
			jacks: undefined,
		});
		expect(draft.powerEnabled).toBe(false);
		expect(draft.jacks).toEqual([]);
	});
});
