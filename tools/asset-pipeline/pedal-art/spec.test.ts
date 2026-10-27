import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parsePedalArtSpec } from "./spec.ts";

const PILOTS = [
	"boss-ds-1-distortion.json",
	"meris-enzo.json",
	"red-panda-tensor.json",
] as const;

function readPilot<T = unknown>(file: string): T {
	return JSON.parse(
		readFileSync(new URL(`./pilots/${file}`, import.meta.url), "utf8"),
	) as T;
}

const MINIMAL = {
	id: "test-pedal",
	family: "compact",
	widthCm: 7.4,
	heightCm: 12.6,
	style: "catalog-specimen/1",
	body: { fill: "#7A7F86" },
};

describe("PedalArtSpecSchema", () => {
	it.each(PILOTS)("accepts the %s pilot", (file) => {
		const spec = parsePedalArtSpec(readPilot(file));
		expect(spec.id).toBe(file.replace(/\.json$/, ""));
	});

	it("applies the documented defaults", () => {
		const spec = parsePedalArtSpec(MINIMAL);
		expect(spec.body.radiusCm).toBe(0.35);
		expect(spec.body.sideCm).toBe(0.3);
		expect(spec.body.knobFinish).toBe("black");
		expect(spec.body.footswitchFinish).toBe("metal");
		expect(spec.ink).toBe("auto");
		expect(spec.controls).toEqual([]);
		expect(spec.text).toEqual([]);
		expect(spec.jacks).toEqual([]);
	});

	it("rejects unknown fields", () => {
		expect(() =>
			parsePedalArtSpec({ ...MINIMAL, freehandSvg: "<svg/>" }),
		).toThrow(/unrecognized key/i);
	});

	it("rejects planner references", () => {
		expect(() =>
			parsePedalArtSpec({
				...MINIMAL,
				sourceRef: "https://www.pedalplayground.com/gear/boss/ds1.png",
			}),
		).toThrow(/planner/i);
	});

	it("rejects jack protrusion pixels", () => {
		expect(() =>
			parsePedalArtSpec({
				...MINIMAL,
				jacks: [{ kind: "in", edge: "top", protrusionCm: 0.8 }],
			}),
		).toThrow(/protrusionCm 0/);
	});

	it("rejects a control outside the enclosure", () => {
		expect(() =>
			parsePedalArtSpec({
				...MINIMAL,
				controls: [{ kind: "knob", u: 0.05, v: 0.5, diameterCm: 2.4 }],
			}),
		).toThrow(/outside the enclosure/);
	});

	it("rejects text in the bottom hardware band", () => {
		expect(() =>
			parsePedalArtSpec({
				...MINIMAL,
				text: [
					{
						role: "model",
						value: "TEST",
						u: 0.5,
						v: 0.9,
						sizeMm: 3,
					},
				],
			}),
		).toThrow();
	});

	it("rejects text that does not fit the top face", () => {
		expect(() =>
			parsePedalArtSpec({
				...MINIMAL,
				text: [
					{
						role: "brand",
						value: "SUPER LONG BRAND MODEL X",
						u: 0.5,
						v: 0.1,
						sizeMm: 12,
					},
				],
			}),
		).toThrow(/does not fit/);
	});

	it("rejects a band/control escaping a rounded corner", () => {
		expect(() =>
			parsePedalArtSpec({
				...MINIMAL,
				body: {
					fill: "#7A7F86",
					radiusCm: 1.2,
					sideCm: 0.3,
					bands: [{ u: 0.1, v: 0.1, wCm: 3, hCm: 2, fill: "#7A7F86" }],
				},
			}),
		).toThrow(/rounded top face/);
	});

	it("rejects a neon sampled body fill", () => {
		expect(() =>
			parsePedalArtSpec({
				...MINIMAL,
				body: { fill: "#FF00FF" },
			}),
		).toThrow(/chroma/);
	});

	it("validates tread-field vs print-band chroma", () => {
		expect(() =>
			parsePedalArtSpec({
				...MINIMAL,
				body: {
					fill: "#7A7F86",
					bands: [
						{
							u: 0.5,
							v: 0.66,
							wCm: 4,
							hCm: 2,
							fill: "#E8722F",
							role: "field",
						},
					],
				},
			}),
		).not.toThrow();
		expect(() =>
			parsePedalArtSpec({
				...MINIMAL,
				body: {
					fill: "#7A7F86",
					bands: [
						{
							u: 0.5,
							v: 0.66,
							wCm: 4,
							hCm: 2,
							fill: "#E8722F",
							role: "print",
						},
					],
				},
			}),
		).toThrow(/chroma/);
	});

	it("rejects an unsafe id", () => {
		expect(() => parsePedalArtSpec({ ...MINIMAL, id: "../bad" })).toThrow();
	});
});
