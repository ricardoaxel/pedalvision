import { describe, expect, it } from "vitest";
import {
	CatalogBoardSchema,
	type CatalogPedal,
	CatalogPedalSchema,
} from "./schema";

const validPedal: CatalogPedal = {
	id: "acme-big-fuzz",
	brand: "Acme",
	name: "Big Fuzz",
	widthCm: 6.35,
	heightCm: 11.94,
	image: "acme-big-fuzz.png",
	imageSource: "mock",
	effectTypes: ["fuzz"],
	category: "pedal",
	source: "synthetic",
};

describe("CatalogPedalSchema", () => {
	it("accepts a valid pedal", () => {
		expect(CatalogPedalSchema.safeParse(validPedal).success).toBe(true);
	});

	it("accepts optional jacks and power", () => {
		const result = CatalogPedalSchema.safeParse({
			...validPedal,
			jacks: [{ kind: "in", edge: "top", pos: 0.5 }],
			power: { voltage: 9, acDc: "DC", currentMa: 100 },
		});
		expect(result.success).toBe(true);
	});

	it("accepts optional per-item sources", () => {
		expect(
			CatalogPedalSchema.safeParse({
				...validPedal,
				sources: [{ url: "https://example.com/model", kind: "info" }],
			}).success,
		).toBe(true);
	});

	it("rejects a malformed source url or kind", () => {
		expect(
			CatalogPedalSchema.safeParse({
				...validPedal,
				sources: [{ url: "not-a-url", kind: "info" }],
			}).success,
		).toBe(false);
		expect(
			CatalogPedalSchema.safeParse({
				...validPedal,
				sources: [{ url: "https://example.com", kind: "photo" }],
			}).success,
		).toBe(false);
		expect(
			CatalogPedalSchema.safeParse({
				...validPedal,
				sources: [{ url: "javascript:alert(1)", kind: "info" }],
			}).success,
		).toBe(false);
	});

	it("accepts a URL image when imageSource is 'url'", () => {
		expect(
			CatalogPedalSchema.safeParse({
				...validPedal,
				image: "https://cdn.example.com/pedals/acme-big-fuzz.png",
				imageSource: "url",
			}).success,
		).toBe(true);
	});

	it.each([
		["negative width", { ...validPedal, widthCm: -1 }],
		["missing width", { ...validPedal, widthCm: undefined }],
		["unsafe image", { ...validPedal, image: "Big Fuzz.png" }],
		["image without .png", { ...validPedal, image: "big-fuzz" }],
		["bad id", { ...validPedal, id: "Acme Big Fuzz" }],
		["unknown source", { ...validPedal, source: "mystery" }],
		["unknown category", { ...validPedal, category: "board" }],
		["unknown imageSource", { ...validPedal, imageSource: "cloud" }],
		["url imageSource with a filename", { ...validPedal, imageSource: "url" }],
		[
			"url imageSource with a non-http scheme",
			{ ...validPedal, image: "javascript:alert(1)", imageSource: "url" },
		],
		[
			"static imageSource with a URL",
			{
				...validPedal,
				image: "https://cdn.example.com/acme-big-fuzz.png",
				imageSource: "static",
			},
		],
		[
			"jack pos out of range",
			{ ...validPedal, jacks: [{ kind: "in", edge: "top", pos: 2 }] },
		],
		[
			"unknown jack kind",
			{ ...validPedal, jacks: [{ kind: "midi", edge: "top", pos: 0.5 }] },
		],
	])("rejects %s", (_label, pedal) => {
		expect(CatalogPedalSchema.safeParse(pedal).success).toBe(false);
	});
});

describe("CatalogBoardSchema", () => {
	it("accepts a valid board", () => {
		expect(
			CatalogBoardSchema.safeParse({
				id: "acme-terra-24",
				brand: "Acme",
				name: "Terra 24",
				widthCm: 60,
				heightCm: 30,
				image: "acme-terra-24.png",
				imageSource: "mock",
				source: "synthetic",
			}).success,
		).toBe(true);
	});

	it("rejects a board without dimensions", () => {
		expect(
			CatalogBoardSchema.safeParse({
				id: "acme-terra-24",
				brand: "Acme",
				name: "Terra 24",
				image: "acme-terra-24.png",
				imageSource: "mock",
				source: "synthetic",
			}).success,
		).toBe(false);
	});
});
