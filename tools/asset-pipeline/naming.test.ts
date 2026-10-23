import { describe, expect, it } from "vitest";
import {
	fitToLongEdge,
	imageFilename,
	kindDir,
	outputPath,
	RENDITIONS,
	slugId,
} from "./naming.ts";

describe("RENDITIONS", () => {
	it("is the two committed sizes, master first", () => {
		expect(RENDITIONS).toEqual([800, 350]);
	});
});

describe("kindDir", () => {
	it("maps a kind to its app folder", () => {
		expect(kindDir("pedal")).toBe("pedals");
		expect(kindDir("board")).toBe("boards");
	});
});

describe("slugId", () => {
	it("builds a lowercase-hyphenated catalog id", () => {
		expect(slugId("BOSS", "TR-2")).toBe("boss-tr-2");
		expect(slugId("Walrus Audio", "ARP-87 (Nautical)")).toBe(
			"walrus-audio-arp-87-nautical",
		);
	});
});

describe("imageFilename", () => {
	it("appends .png to a safe id by default", () => {
		expect(imageFilename("boss-tr-2")).toBe("boss-tr-2.png");
	});

	it("uses .avif when requested", () => {
		expect(imageFilename("boss-tr-2", "avif")).toBe("boss-tr-2.avif");
	});

	it("rejects an id that cannot form a safe filename", () => {
		expect(() => imageFilename("Boss TR-2")).toThrow();
		expect(() => imageFilename("../evil")).toThrow();
		expect(() => imageFilename("")).toThrow();
	});
});

describe("fitToLongEdge", () => {
	it("scales the long edge to the rendition size, preserving aspect", () => {
		expect(fitToLongEdge(6, 12, 800)).toEqual({ width: 400, height: 800 });
		expect(fitToLongEdge(60, 30, 350)).toEqual({ width: 350, height: 175 });
	});

	it("handles a square image", () => {
		expect(fitToLongEdge(10, 10, 350)).toEqual({ width: 350, height: 350 });
	});

	it("never produces a dimension below 1px", () => {
		expect(fitToLongEdge(1, 1000, 350)).toEqual({ width: 1, height: 350 });
	});

	it("rejects a non-positive size", () => {
		expect(() => fitToLongEdge(0, 10, 350)).toThrow();
		expect(() => fitToLongEdge(10, -1, 800)).toThrow();
	});
});

describe("outputPath", () => {
	it("builds the committed asset path", () => {
		expect(
			outputPath("public/pedal-assets", "pedal", 800, "boss-tr-2.png"),
		).toBe("public/pedal-assets/pedals/800/boss-tr-2.png");
		expect(
			outputPath(
				"public/pedal-assets",
				"board",
				350,
				"pedaltrain-classic-1.png",
			),
		).toBe("public/pedal-assets/boards/350/pedaltrain-classic-1.png");
	});
});
