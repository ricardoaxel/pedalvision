import { describe, expect, it } from "vitest";
import {
	insetBoardMarkPoints,
	normalizeHexColor,
	SCENE_COLOR_OPTIONS,
	sceneColorLabel,
	sceneColorOption,
	sceneColorValue,
	sceneColorWarning,
} from "./sceneColor";

describe("scene organization colors (F-16)", () => {
	it("reuses the five Q-05 inks", () => {
		expect(SCENE_COLOR_OPTIONS).toHaveLength(5);
		expect(SCENE_COLOR_OPTIONS.map((option) => option.id)).toEqual([
			"red",
			"orange",
			"green",
			"blue",
			"violet",
		]);
	});

	it("resolves a stored hex to a palette option, a custom value or Default", () => {
		expect(sceneColorOption("#B5544D")?.id).toBe("red");
		expect(sceneColorOption("#a85a90")).toBeUndefined();
		expect(sceneColorValue("#ABC")).toBe("#aabbcc");
		expect(sceneColorValue("#b5544dff")).toBeNull();
		expect(normalizeHexColor(" #587db8 ")).toBe("#587db8");
	});

	it("labels Default, a fixed ink and a custom color", () => {
		expect(sceneColorLabel(undefined)).toBe("Default");
		expect(sceneColorLabel("")).toBe("Default");
		expect(sceneColorLabel("#b5544d")).toBe("Red");
		expect(sceneColorLabel("#a85a90")).toBe("Custom");
	});

	it("warns only for a custom color that fails a substrate contrast", () => {
		expect(sceneColorWarning("#587db8")).toBeNull();
		expect(sceneColorWarning("#ffffff")).toContain("Faint on");
		expect(sceneColorWarning(undefined)).toBeNull();
	});

	it("insets the notched board silhouette for the visible mark", () => {
		const points = insetBoardMarkPoints(300, 200, 30, 5);
		// First corner moves in by the inset; the far edges stop short of it.
		expect(points.slice(0, 2)).toEqual([5, 5]);
		expect(points.slice(6, 10)).toEqual([295, 195, 5, 195]);
		// The notch keeps its proportional shape and stays inside the footprint.
		expect(points[2]).toBeGreaterThan(5);
		expect(points[3]).toBe(5);
		expect(points[4]).toBe(295);
		expect(points[5]).toBeGreaterThan(5);
		expect(points.at(-4)).toBe(295);
		expect(points.at(-3)).toBe(195);
	});
});
