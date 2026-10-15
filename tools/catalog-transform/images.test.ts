import { describe, expect, it } from "vitest";
import type { SourceRef } from "../../src/catalog/schema.ts";
import { pickDirectImageUrl, resolveImages } from "./images.ts";

const img = (url: string): SourceRef => ({ url, kind: ["image"] });

describe("pickDirectImageUrl", () => {
	it("returns the first direct-file, image-kind source", () => {
		expect(
			pickDirectImageUrl([
				{ url: "https://maker.example/pedal", kind: ["info", "image"] },
				img("https://cdn.example/pedal.jpg"),
			]),
		).toBe("https://cdn.example/pedal.jpg");
	});

	it("ignores product pages and info-only refs", () => {
		expect(
			pickDirectImageUrl([
				{ url: "https://maker.example/pedal", kind: ["info", "image"] },
				{ url: "https://maker.example/specs", kind: ["info"] },
			]),
		).toBeNull();
	});

	it("keeps a query string on an image file", () => {
		expect(pickDirectImageUrl([img("https://cdn.example/x.png?v=2")])).toBe(
			"https://cdn.example/x.png?v=2",
		);
	});

	it("returns null without sources", () => {
		expect(pickDirectImageUrl(undefined)).toBeNull();
		expect(pickDirectImageUrl([])).toBeNull();
	});
});

describe("resolveImages", () => {
	it("promotes a direct image URL to image/imageSource", () => {
		const items = [
			{
				id: "a",
				image: "a.png",
				imageSource: "mock" as const,
				sources: [img("https://cdn.example/a.jpg")],
			},
		];
		expect(resolveImages(items)).toBe(1);
		expect(items[0].image).toBe("https://cdn.example/a.jpg");
		expect(items[0].imageSource).toBe("url");
	});

	it("leaves items without a direct image as mock", () => {
		const items = [
			{
				id: "b",
				image: "b.png",
				imageSource: "mock" as const,
				sources: [
					{
						url: "https://maker.example/b",
						kind: ["info", "image"],
					} as SourceRef,
				],
			},
		];
		expect(resolveImages(items)).toBe(0);
		expect(items[0].image).toBe("b.png");
		expect(items[0].imageSource).toBe("mock");
	});

	it("never touches a cleared static asset", () => {
		const items = [
			{
				id: "c",
				image: "cleared.png",
				imageSource: "static" as const,
				sources: [img("https://cdn.example/c.jpg")],
			},
		];
		expect(resolveImages(items)).toBe(0);
		expect(items[0].image).toBe("cleared.png");
		expect(items[0].imageSource).toBe("static");
	});

	it("reverts a url item back to mock when its URL is gone", () => {
		const items = [
			{
				id: "d",
				image: "https://dead.example/d.jpg",
				imageSource: "url" as const,
				sources: [
					{ url: "https://maker.example/d", kind: ["info"] } as SourceRef,
				],
			},
		];
		expect(resolveImages(items)).toBe(1);
		expect(items[0].image).toBe("d.png");
		expect(items[0].imageSource).toBe("mock");
	});

	it("is idempotent", () => {
		const items = [
			{
				id: "a",
				image: "https://cdn.example/a.jpg",
				imageSource: "url" as const,
				sources: [img("https://cdn.example/a.jpg")],
			},
		];
		expect(resolveImages(items)).toBe(0);
	});
});
