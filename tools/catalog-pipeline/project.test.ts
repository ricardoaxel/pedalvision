import { describe, expect, it } from "vitest";
import type { RawPedalRecord } from "../../src/catalog/rawSchema.ts";
import { projectBoard, projectPedal } from "./project.ts";

const rawPedal: RawPedalRecord = {
	id: "acme-big-fuzz",
	brand: "Acme",
	name: "Big Fuzz",
	category: "pedal" as const,
	effectTypes: ["fuzz" as const],
	widthCm: 6,
	heightCm: 10,
	power: { voltage: 9, acDc: "DC" as const, currentMa: 12 },
	jacks: [
		{ kind: "in" as const, edge: "top" as const },
		{ kind: "out" as const, edge: "left" as const, pos: 0.25, stereo: true },
	],
	usage: "guitar" as const,
	color: "green",
	notes: "Original factual summary.",
	year: 1978,
	status: "current" as const,
	confidence: "confirmed" as const,
	lastVerified: "2026-10-22",
	sources: [{ url: "https://example.com/big-fuzz", kind: ["info", "image"] }],
};

describe("raw → runtime projection", () => {
	it("maps verified pedal fields and static public assets", () => {
		const pedal = projectPedal(rawPedal);
		expect(pedal).toMatchObject({
			id: "acme-big-fuzz",
			image: "acme-big-fuzz.png",
			imageSource: "static",
			source: "public-asset",
			effectTypes: ["fuzz"],
			power: { voltage: 9, acDc: "DC", currentMa: 12 },
			usage: "guitar",
			color: "green",
			year: 1978,
			status: "current",
			confidence: "confirmed",
			lastVerified: "2026-10-22",
		});
		expect(pedal.jacks).toEqual([
			{ kind: "in", edge: "top" },
			{ kind: "out", edge: "left", pos: 0.25, stereo: true },
		]);
	});

	it("omits incomplete runtime power but keeps raw-only facts out", () => {
		const pedal = projectPedal({
			...rawPedal,
			power: { voltage: 9 },
		});
		expect(pedal.power).toBeUndefined();
	});

	it("maps a board footprint and variant link", () => {
		const board = projectBoard({
			id: "acme-terra-24",
			brand: "Acme",
			name: "Terra 24",
			category: "board",
			widthCm: 60,
			heightCm: 30,
			variantOf: "acme-terra",
			sources: [
				{ url: "https://example.com/terra-24", kind: ["info", "image"] },
			],
		});
		expect(board).toMatchObject({
			id: "acme-terra-24",
			image: "acme-terra-24.png",
			imageSource: "static",
			variantOf: "acme-terra",
			source: "public-asset",
		});
	});
});
