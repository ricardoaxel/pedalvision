import { describe, expect, it } from "vitest";
import { cableCurve, cablePathData, cablePointAt } from "./cablePath";
import type { AnchorPoint } from "./jackAnchor";

const rightEdge: AnchorPoint = {
	point: { x: 0, y: 0 },
	normal: { x: 1, y: 0 },
	assumed: false,
};
const leftEdge: AnchorPoint = {
	point: { x: 20, y: 0 },
	normal: { x: -1, y: 0 },
	assumed: false,
};
const endpoint: AnchorPoint = {
	point: { x: 20, y: 0 },
	normal: null,
	assumed: false,
};

describe("cable curve", () => {
	it("starts and ends on the anchors and draws a cubic path", () => {
		const curve = cableCurve(rightEdge, leftEdge, 1);
		expect(curve.start).toEqual({ x: 0, y: 0 });
		expect(curve.end).toEqual({ x: 80, y: 0 });
		expect(cablePathData(curve)).toMatch(/^M 0 0 C /);
	});

	it("leaves a jack along its outward normal", () => {
		const curve = cableCurve(rightEdge, leftEdge, 1);
		// Right edge normal (+x) → control point to the right of the start.
		expect(curve.control1.x).toBeGreaterThan(curve.start.x);
		// The destination's left normal (-x) → control point outside its left
		// edge, so the cable enters the jack from the outside.
		expect(curve.control2.x).toBeLessThan(curve.end.x);
	});

	it("points the arrow at the destination (tangent at t=1)", () => {
		const curve = cableCurve(rightEdge, leftEdge, 1);
		const [tip, left, right] = curve.arrow;
		// Destination is to the right, so the tip points right of the base.
		expect(tip.x).toBeGreaterThan(left.x);
		expect(tip.x).toBeGreaterThan(right.x);
		// The arrow is screen-sized at zoom 1.
		expect(Math.hypot(left.x - right.x, left.y - right.y)).toBeCloseTo(8);
	});

	it("uses the chord for an endpoint-side handle", () => {
		const curve = cableCurve(rightEdge, endpoint, 1);
		// No edge normal: the control point sits back along the chord (left of
		// the endpoint), so the cable plugs into the tag.
		expect(curve.control2.x).toBeLessThan(curve.end.x);
	});

	it("scales arrow/handle metrics with zoom but keeps world anchors", () => {
		const atOne = cableCurve(rightEdge, leftEdge, 1);
		const atTwo = cableCurve(rightEdge, leftEdge, 2);
		expect(atTwo.start).toEqual(atOne.start);
		expect(atTwo.end).toEqual(atOne.end);
		// Screen-constant arrow: half the local width at 2× zoom.
		const width = (curve: typeof atOne) =>
			Math.hypot(
				curve.arrow[1].x - curve.arrow[2].x,
				curve.arrow[1].y - curve.arrow[2].y,
			);
		expect(width(atTwo)).toBeCloseTo(width(atOne) / 2);
	});

	it("reports a midpoint on the curve for the action bar", () => {
		const curve = cableCurve(rightEdge, leftEdge, 1);
		const midpoint = cablePointAt(curve, 0.5);
		expect(midpoint.x).toBeGreaterThan(curve.start.x);
		expect(midpoint.x).toBeLessThan(curve.end.x);
	});
});
