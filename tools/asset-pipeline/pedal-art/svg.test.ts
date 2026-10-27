import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ART_PALETTE } from "./color.ts";
import { type PedalArtSpec, parsePedalArtSpec } from "./spec.ts";
import { buildPedalArtSvg } from "./svg.ts";

function pilot(file: string): PedalArtSpec {
	return parsePedalArtSpec(
		JSON.parse(
			readFileSync(new URL(`./pilots/${file}`, import.meta.url), "utf8"),
		),
	);
}

const DS1 = pilot("boss-ds-1-distortion.json");
const TENSOR = pilot("red-panda-tensor.json");

describe("buildPedalArtSvg", () => {
	it("renders the enclosure at the true footprint aspect", () => {
		const art = buildPedalArtSvg(DS1);
		expect(art.width).toBe(453);
		expect(art.height).toBe(800);
		const expected = DS1.widthCm / DS1.heightCm;
		const actual = art.width / art.height;
		expect(Math.abs(actual - expected) / expected).toBeLessThan(0.01);
	});

	it("draws the fixed cutline and sampled body, with no forbidden effects", () => {
		const { svg } = buildPedalArtSvg(DS1);
		expect(svg).toContain(ART_PALETTE.cutline);
		expect(svg).toContain(DS1.body.fill);
		expect(svg).not.toMatch(/<filter|<linearGradient|<radialGradient|<image/i);
		expect(svg).not.toMatch(/font-family|<text/i);
		expect(svg).not.toMatch(/#66c9de/i);
		expect(svg).not.toMatch(/shadow|blur|opacity/i);
	});

	it("composes brand/model text as paths", () => {
		const { svg } = buildPedalArtSvg(DS1);
		const paths = svg.match(/<path /g) ?? [];
		expect(paths.length).toBeGreaterThan(10);
		expect(svg).toContain("<title>boss-ds-1-distortion");
	});

	it("picks the accessible ink per body colour", () => {
		expect(buildPedalArtSvg(DS1).ink).toBe(ART_PALETTE.printDark);
		expect(buildPedalArtSvg(TENSOR).ink).toBe(ART_PALETTE.printLight);
	});

	it("uses fixed hairlines at 350 and 800", () => {
		const master = buildPedalArtSvg(DS1, { longEdge: 800 });
		const thumb = buildPedalArtSvg(DS1, { longEdge: 350 });
		expect(Math.max(master.width, master.height)).toBe(800);
		expect(Math.max(thumb.width, thumb.height)).toBe(350);
		expect(master.svg).toContain('stroke-width="2"');
		expect(thumb.svg).toContain('stroke-width="1"');
		expect(thumb.svg).toContain('stroke-width="0.5"');
	});

	it("simplifies the 350 LOD (no legends, LEDs or small buttons)", () => {
		const master = buildPedalArtSvg(TENSOR, { longEdge: 800 });
		const thumb = buildPedalArtSvg(TENSOR, { longEdge: 350 });
		expect(master.svg).toContain("#B9C2CC");
		expect(thumb.svg).not.toContain("#B9C2CC");
		expect(thumb.svg.length).toBeLessThan(master.svg.length);
	});

	it("draws a tread field with a hairline edge, never a black fill", () => {
		const { svg } = buildPedalArtSvg(DS1);
		expect(DS1.body.bands[0]?.role).toBe("field");
		expect(svg).toContain(DS1.body.bands[0]?.fill);
		expect(svg).not.toContain('fill="#000000"');
	});

	it("keeps brand/model text at the 3:1 large-text floor", () => {
		const mid = parsePedalArtSpec({
			id: "mid-gray",
			family: "compact",
			widthCm: 7.4,
			heightCm: 12.6,
			style: "catalog-specimen/1",
			body: { fill: "#7A7F86" },
			text: [
				{ role: "brand", value: "ACME", u: 0.5, v: 0.06, sizeMm: 2.4 },
				{ role: "model", value: "M-1", u: 0.5, v: 0.12, sizeMm: 3.6 },
			],
		});
		const art = buildPedalArtSvg(mid);
		expect(art.inkContrast).toBeLessThan(4.5);
		expect(art.inkContrast).toBeGreaterThanOrEqual(3);
		expect((art.svg.match(/<path /g) ?? []).length).toBeGreaterThan(5);
	});

	it("clips body content to the rounded top face", () => {
		expect(buildPedalArtSvg(DS1).svg).toContain('clip-path="url(#topFace)"');
	});

	it("is deterministic", () => {
		expect(buildPedalArtSvg(DS1).svg).toBe(buildPedalArtSvg(DS1).svg);
	});

	it("rejects an invalid long edge", () => {
		expect(() => buildPedalArtSvg(DS1, { longEdge: 10 })).toThrow();
	});
});
