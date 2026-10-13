import { describe, expect, it } from "vitest";
import { assetUrl } from "./cdn";

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
