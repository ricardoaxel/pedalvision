import { describe, expect, it } from "vitest";
import {
	ASSET_RENDITIONS,
	assetUrl,
	bustCache,
	resolveImageUrl,
	resolveMasterImageUrl,
	resolveThumbImageUrl,
} from "./cdn";

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

describe("ASSET_RENDITIONS (surface → rendition map)", () => {
	it("keeps small UI on the 350 thumb and large surfaces on the 800 master", () => {
		expect(ASSET_RENDITIONS.pickerRow).toBe(350);
		expect(ASSET_RENDITIONS.infoSleeve).toBe(350);
		expect(ASSET_RENDITIONS.specimen).toBe(800);
		expect(ASSET_RENDITIONS.canvas).toBe(800);
		expect(ASSET_RENDITIONS.export).toBe(800);
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

	it("passes an absolute url source through untouched at either rendition", () => {
		const url = "https://cdn.example.com/board.png";
		expect(resolveImageUrl("url", url, "board", 800)).toBe(url);
		expect(resolveImageUrl("url", url, "board", 350)).toBe(url);
	});
});

describe("resolveThumbImageUrl / resolveMasterImageUrl (small UI vs master)", () => {
	it("returns the 350 path for mock/static thumbs", () => {
		expect(resolveThumbImageUrl("mock", "boss-bd-2.png", "pedal")).toBe(
			"/pedal-assets/pedals/350/boss-bd-2.png",
		);
		expect(resolveThumbImageUrl("static", "choka.avif", "pedal")).toBe(
			"/pedal-assets/pedals/350/choka.avif",
		);
		expect(resolveThumbImageUrl("static", "nano.png", "board")).toBe(
			"/pedal-assets/boards/350/nano.png",
		);
		expect(
			resolveThumbImageUrl("static", "choka.avif", "pedal", "infoSleeve"),
		).toBe("/pedal-assets/pedals/350/choka.avif");
	});

	it("returns the 800 path for mock/static masters", () => {
		expect(resolveMasterImageUrl("mock", "boss-bd-2.png", "pedal")).toBe(
			"/pedal-assets/pedals/800/boss-bd-2.png",
		);
		expect(resolveMasterImageUrl("static", "choka.avif", "pedal")).toBe(
			"/pedal-assets/pedals/800/choka.avif",
		);
		expect(resolveMasterImageUrl("static", "nano.png", "board")).toBe(
			"/pedal-assets/boards/800/nano.png",
		);
	});

	it("returns the recorded absolute URL unchanged for url entries", () => {
		const url = "https://cdn.example.com/pedal.png";
		expect(resolveThumbImageUrl("url", url, "pedal")).toBe(url);
		expect(resolveMasterImageUrl("url", url, "pedal")).toBe(url);
	});
});

describe("bustCache (cache-poisoning self-heal)", () => {
	it("appends a stable key to an absolute URL", () => {
		expect(bustCache("https://cdn.example.com/a.jpg")).toBe(
			"https://cdn.example.com/a.jpg?pedalvision-v=1",
		);
	});

	it("uses & when the URL already has a query string", () => {
		expect(bustCache("https://cdn.example.com/a.jpg?v=42")).toBe(
			"https://cdn.example.com/a.jpg?v=42&pedalvision-v=1",
		);
	});

	it("inserts before a fragment", () => {
		expect(bustCache("https://cdn.example.com/a.jpg#frag")).toBe(
			"https://cdn.example.com/a.jpg?pedalvision-v=1#frag",
		);
	});

	it("leaves same-origin asset paths untouched", () => {
		expect(bustCache("/pedal-assets/pedals/800/boss-tr-2.png")).toBe(
			"/pedal-assets/pedals/800/boss-tr-2.png",
		);
	});
});
