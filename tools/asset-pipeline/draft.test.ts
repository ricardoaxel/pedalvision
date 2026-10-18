import { describe, expect, it } from "vitest";
import { buildDraftEntry } from "./draft.ts";

describe("buildDraftEntry", () => {
	it("builds a schema-valid static pedal draft", () => {
		const entry = buildDraftEntry({
			kind: "pedal",
			id: "boss-tr-2",
			brand: "BOSS",
			name: "TR-2 Tremolo",
			widthCm: 7.3,
			heightCm: 12.9,
		});
		expect(entry).toMatchObject({
			id: "boss-tr-2",
			image: "boss-tr-2.png",
			imageSource: "static",
			source: "placeholder",
			category: "pedal",
			effectTypes: [],
		});
	});

	it("carries a supply category and a variant link", () => {
		expect(
			buildDraftEntry({
				kind: "pedal",
				id: "acme-fuzz",
				brand: "Acme",
				name: "Fuzz",
				widthCm: 5,
				heightCm: 10,
				category: "supply",
				source: "brand-assets",
			}),
		).toMatchObject({ category: "supply", source: "brand-assets" });
		expect(
			buildDraftEntry({
				kind: "pedal",
				id: "acme-fuzz-green",
				brand: "Acme",
				name: "Fuzz (Green)",
				widthCm: 5,
				heightCm: 10,
				variantOf: "acme-fuzz",
			}),
		).toMatchObject({ variantOf: "acme-fuzz" });
	});

	it("builds a board draft without pedal-only fields", () => {
		const entry = buildDraftEntry({
			kind: "board",
			id: "acme-board",
			brand: "Acme",
			name: "Board 1",
			widthCm: 60,
			heightCm: 30,
		});
		expect(entry).toMatchObject({
			id: "acme-board",
			image: "acme-board.png",
			imageSource: "static",
		});
		expect(entry).not.toHaveProperty("effectTypes");
		expect(entry).not.toHaveProperty("category");
	});

	it("rejects an id that cannot form a safe filename", () => {
		expect(() =>
			buildDraftEntry({
				kind: "pedal",
				id: "Boss TR-2",
				brand: "BOSS",
				name: "TR-2",
				widthCm: 7.3,
				heightCm: 12.9,
			}),
		).toThrow();
	});
});
