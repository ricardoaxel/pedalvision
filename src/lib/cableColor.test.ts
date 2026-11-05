import { describe, expect, it } from "vitest";
import { CABLE_INK_OPTIONS, cableInkOption } from "./cableColor";

describe("cable patch inks (Q-05)", () => {
	it("offers six fixed inks with unique stored values", () => {
		expect(CABLE_INK_OPTIONS).toHaveLength(6);
		expect(new Set(CABLE_INK_OPTIONS.map((ink) => ink.value)).size).toBe(6);
	});

	it("matches a stored ink case-insensitively and rejects unknown values", () => {
		expect(cableInkOption("#B5544D")?.id).toBe("red");
		expect(cableInkOption("  #587db8 ")?.id).toBe("blue");
		expect(cableInkOption("#123456")).toBeUndefined();
		expect(cableInkOption(undefined)).toBeUndefined();
		expect(cableInkOption(null)).toBeUndefined();
	});
});
