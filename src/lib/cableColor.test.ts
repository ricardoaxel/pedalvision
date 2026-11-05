import { describe, expect, it } from "vitest";
import {
	CABLE_INK_OPTIONS,
	cableInkContrast,
	cableInkOption,
	cableInkWarning,
	normalizeHexColor,
} from "./cableColor";

describe("cable patch inks (Q-05)", () => {
	it("offers five fixed inks with unique stored values", () => {
		expect(CABLE_INK_OPTIONS).toHaveLength(5);
		expect(new Set(CABLE_INK_OPTIONS.map((ink) => ink.value)).size).toBe(5);
	});

	it("matches a stored ink and treats any other hex as custom", () => {
		expect(cableInkOption("#B5544D")?.id).toBe("red");
		expect(cableInkOption("  #587db8 ")?.id).toBe("blue");
		expect(cableInkOption("#a85a90")).toBeUndefined();
		expect(cableInkOption(undefined)).toBeUndefined();
		expect(cableInkOption(null)).toBeUndefined();
	});

	it("normalizes 3/6-digit hex and rejects alpha/invalid values", () => {
		expect(normalizeHexColor("#ABC")).toBe("#aabbcc");
		expect(normalizeHexColor(" #B5544D ")).toBe("#b5544d");
		expect(normalizeHexColor("#b5544dff")).toBeNull();
		expect(normalizeHexColor("red")).toBeNull();
		expect(normalizeHexColor("")).toBeNull();
	});

	it("audits custom contrast against dark, light and paper", () => {
		const blue = cableInkContrast("#587db8");
		expect(blue?.failing).toEqual([]);
		expect(blue?.ratios.dark).toBeGreaterThan(3);
		const white = cableInkContrast("#ffffff");
		expect(white?.failing).toContain("light");
		expect(white?.failing).toContain("paper");
		const black = cableInkContrast("#000000");
		expect(black?.failing).toContain("dark");
		expect(cableInkWarning("#ffffff")).toContain("Faint on");
		expect(cableInkWarning("#587db8")).toBeNull();
		expect(cableInkWarning("not-a-color")).toContain("hex");
	});
});
