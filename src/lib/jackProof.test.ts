import { describe, expect, it } from "vitest";
import {
	deriveEdgePos,
	jackPointNormalized,
	normalizedToLocal,
	normalizedToWorld,
	nudgeNormalized,
	proofNormalFor,
	snapToBoundary,
	worldToNormalized,
} from "./jackProof";

const footprint = { widthCm: 10, heightCm: 20 };

describe("free jack placement", () => {
	it("derives a normalized point from an edge position", () => {
		expect(jackPointNormalized({ edge: "top", pos: 0.3 }, footprint)).toEqual({
			x: 0.3,
			y: 0,
		});
		expect(jackPointNormalized({ edge: "right", pos: 0.6 }, footprint)).toEqual(
			{ x: 1, y: 0.6 },
		);
		expect(
			jackPointNormalized(
				{ edge: "left", pos: 0.5, xNorm: 0.42, yNorm: 0.18 },
				footprint,
			),
		).toEqual({ x: 0.42, y: 0.18 });
	});

	it("converts a free point to local cm and back to the nearest edge", () => {
		const local = normalizedToLocal({ x: 0.42, y: 0.18 }, footprint);
		expect(local.x).toBeCloseTo(4.2);
		expect(local.y).toBeCloseTo(3.6);
		expect(deriveEdgePos({ x: 0.5, y: 0.18 }, footprint)).toEqual({
			edge: "top",
			pos: 0.5,
		});
		expect(deriveEdgePos({ x: 0.9, y: 0.5 }, footprint)).toEqual({
			edge: "right",
			pos: 0.5,
		});
	});

	it("uses a radial normal for interior points and an edge fallback at the centre", () => {
		const topFace = proofNormalFor(
			{ edge: "top", xNorm: 0.5, yNorm: 0.18 },
			footprint,
		);
		expect(topFace.x).toBeCloseTo(0);
		expect(topFace.y).toBeLessThan(0);
		const centre = proofNormalFor(
			{ edge: "left", xNorm: 0.5, yNorm: 0.5 },
			footprint,
		);
		expect(centre).toEqual({ x: -1, y: 0 });
	});

	it("nudges in cm and clamps to the footprint", () => {
		expect(nudgeNormalized({ x: 0.5, y: 0.5 }, 1, -2, footprint)).toEqual({
			x: 0.6,
			y: 0.4,
		});
		expect(nudgeNormalized({ x: 0.01, y: 0.99 }, -100, 100, footprint)).toEqual(
			{
				x: 0,
				y: 1,
			},
		);
	});

	it("round-trips a face point through a rotated item on a rotated board", () => {
		const frame = {
			x: 10,
			y: 20,
			rotationDeg: 30,
			board: { x: 100, y: 50, rotationDeg: 45 },
		};
		const point = { x: 0.42, y: 0.18 };
		const world = normalizedToWorld(point, frame, footprint);
		const back = worldToNormalized(world, frame, footprint);
		expect(back.x).toBeCloseTo(point.x, 9);
		expect(back.y).toBeCloseTo(point.y, 9);
	});

	it("snaps only within the threshold of a boundary", () => {
		expect(snapToBoundary({ x: 0.5, y: 0.02 }, footprint, 1)).toEqual({
			point: { x: 0.5, y: 0 },
			edge: "top",
		});
		expect(snapToBoundary({ x: 0.5, y: 0.2 }, footprint, 1)).toBeNull();
	});
});
