import { describe, expect, it } from "vitest";
import { assetUrl, resolveImageUrl } from "./cdn";

describe("assetUrl", () => {
	it("builds pedal paths for both renditions", () => {
		expect(assetUrl("pedal", 800, "boss-tr-2.png")).toBe(
			"/pedal-assets/pedals/800/boss-tr-2.png",
		);
		expect(assetUrl("pedal", 350, "boss-tr-2.png")).toBe(
			"/pedal-assets/pedals/350/boss-tr-2.png",
		);
	});

	it("builds board paths for both renditions", () => {
		expect(assetUrl("board", 800, "pedaltrain-classic-1.png")).toBe(
			"/pedal-assets/boards/800/pedaltrain-classic-1.png",
		);
		expect(assetUrl("board", 350, "pedaltrain-classic-1.png")).toBe(
			"/pedal-assets/boards/350/pedaltrain-classic-1.png",
		);
	});
});

describe("resolveImageUrl (image-resolution contract)", () => {
	it("routes mock/static sources to the same-origin asset URL", () => {
		expect(resolveImageUrl("mock", "boss-bcb-1000.png", "board", 800)).toBe(
			"/pedal-assets/boards/800/boss-bcb-1000.png",
		);
		expect(resolveImageUrl("static", "boss-bcb-1000.png", "board", 350)).toBe(
			"/pedal-assets/boards/350/boss-bcb-1000.png",
		);
	});

	it("passes an absolute url source through untouched", () => {
		const url = "https://cdn.example.com/board.png";
		expect(resolveImageUrl("url", url, "board", 800)).toBe(url);
	});
});
