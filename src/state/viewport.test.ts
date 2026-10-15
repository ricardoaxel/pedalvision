import { beforeEach, describe, expect, it } from "vitest";
import {
	applyPinch,
	clampScale,
	DEFAULT_VIEWPORT,
	MAX_SCALE,
	MIN_SCALE,
	pxToWorldCm,
	screenToWorld,
	useViewport,
	viewportCenterCm,
	worldToScreen,
	zoomAroundPoint,
} from "./viewport";

const anchor = { x: 640, y: 360 };

describe("clampScale", () => {
	it("clamps to [MIN_SCALE, MAX_SCALE]", () => {
		expect(clampScale(1)).toBe(1);
		expect(clampScale(0.001)).toBe(MIN_SCALE);
		expect(clampScale(1000)).toBe(MAX_SCALE);
		expect(clampScale(MIN_SCALE)).toBe(MIN_SCALE);
		expect(clampScale(MAX_SCALE)).toBe(MAX_SCALE);
	});

	it("falls back to 1 for non-finite input", () => {
		expect(clampScale(Number.NaN)).toBe(1);
		expect(clampScale(Number.POSITIVE_INFINITY)).toBe(1);
	});
});

describe("screenToWorld / worldToScreen", () => {
	it("are inverses", () => {
		const viewports = [
			DEFAULT_VIEWPORT,
			{ scale: 2.5, x: -120, y: 340 },
			{ scale: 0.1, x: 1234.5, y: -678.9 },
			{ scale: 8, x: -5, y: -5 },
		];
		for (const viewport of viewports) {
			for (const point of [
				{ x: 0, y: 0 },
				{ x: 640, y: 360 },
				{ x: -300, y: 900 },
			]) {
				const back = screenToWorld(worldToScreen(point, viewport), viewport);
				expect(back.x).toBeCloseTo(point.x, 10);
				expect(back.y).toBeCloseTo(point.y, 10);
			}
		}
	});

	it("maps the stage position to screen origin", () => {
		const viewport = { scale: 3, x: 40, y: -10 };
		expect(worldToScreen({ x: 0, y: 0 }, viewport)).toEqual({ x: 40, y: -10 });
	});
});

describe("zoomAroundPoint", () => {
	it("keeps the stage-local point under the anchor fixed", () => {
		const viewport = { scale: 1.3, x: -40, y: 25 };
		const before = screenToWorld(anchor, viewport);
		for (const next of [0.2, 0.9, 1.3, 3, 7.5]) {
			const after = zoomAroundPoint(viewport, next, anchor);
			const worldUnderAnchor = screenToWorld(anchor, after);
			expect(worldUnderAnchor.x).toBeCloseTo(before.x, 10);
			expect(worldUnderAnchor.y).toBeCloseTo(before.y, 10);
			expect(after.scale).toBe(next);
		}
	});

	it("clamps the resulting scale at both ends", () => {
		expect(zoomAroundPoint(DEFAULT_VIEWPORT, 100, anchor).scale).toBe(
			MAX_SCALE,
		);
		expect(zoomAroundPoint(DEFAULT_VIEWPORT, 0.0001, anchor).scale).toBe(
			MIN_SCALE,
		);
	});
});

describe("applyPinch", () => {
	it("scales by the distance ratio and anchors the initial midpoint", () => {
		const start = {
			viewport: { scale: 1, x: 0, y: 0 },
			distance: 100,
			midpoint: { x: 100, y: 100 },
		};
		const result = applyPinch(start, 200, { x: 150, y: 120 });
		expect(result.scale).toBe(2);
		// The stage-local point under the initial midpoint is now under the
		// current midpoint (zoom + translate in one gesture).
		expect(worldToScreen({ x: 100, y: 100 }, result)).toEqual({
			x: 150,
			y: 120,
		});
	});

	it("clamps the scale but still anchors the midpoint", () => {
		const start = {
			viewport: { scale: 6, x: 10, y: 20 },
			distance: 50,
			midpoint: { x: 200, y: 200 },
		};
		const result = applyPinch(start, 500, { x: 200, y: 200 });
		expect(result.scale).toBe(MAX_SCALE);
		expect(
			worldToScreen(screenToWorld(start.midpoint, start.viewport), result),
		).toEqual(start.midpoint);
	});

	it("treats a zero/small start distance as a pure translate (no huge factor)", () => {
		const start = {
			viewport: { scale: 2, x: 0, y: 0 },
			distance: 0,
			midpoint: { x: 0, y: 0 },
		};
		const result = applyPinch(start, 100, { x: 10, y: 10 });
		expect(result.scale).toBe(2);
		expect(result).toEqual({ scale: 2, x: 10, y: 10 });
	});

	it("still scales for a normal start distance", () => {
		const start = {
			viewport: { scale: 1, x: 0, y: 0 },
			distance: 40,
			midpoint: { x: 20, y: 20 },
		};
		const result = applyPinch(start, 80, { x: 20, y: 20 });
		expect(result.scale).toBe(2);
	});
});

describe("pxToWorldCm / viewportCenterCm", () => {
	it("converts stage-local px to world cm (÷ PX_PER_CM)", () => {
		expect(pxToWorldCm({ x: 40, y: 32 }, DEFAULT_VIEWPORT)).toEqual({
			x: 10,
			y: 8,
		});
	});

	it("maps the canvas centre to world cm", () => {
		// centre (400,300) px ÷ 4 = (100,75) cm at the default viewport
		expect(
			viewportCenterCm({ width: 800, height: 600 }, DEFAULT_VIEWPORT),
		).toEqual({ x: 100, y: 75 });
	});

	it("respects pan and zoom", () => {
		const viewport = { scale: 2, x: -200, y: -100 };
		// local = ((400+200)/2, (300+100)/2) = (300,200) px ÷ 4 = (75,50) cm
		expect(viewportCenterCm({ width: 800, height: 600 }, viewport)).toEqual({
			x: 75,
			y: 50,
		});
	});
});

describe("useViewport store", () => {
	beforeEach(() => {
		useViewport.getState().reset();
	});

	it("starts at 1× with the origin at the top-left corner", () => {
		const { scale, x, y } = useViewport.getState();
		expect({ scale, x, y }).toEqual(DEFAULT_VIEWPORT);
	});

	it("setSize records the canvas size without touching the transform (A1)", () => {
		useViewport.getState().setSize({ width: 1234, height: 567 });
		const { scale, x, y, size } = useViewport.getState();
		expect({ scale, x, y }).toEqual(DEFAULT_VIEWPORT);
		expect(size).toEqual({ width: 1234, height: 567 });
	});

	it("zoomBy zooms about the anchor and clamps", () => {
		useViewport.getState().zoomBy(2, anchor);
		expect(useViewport.getState().scale).toBe(2);
		useViewport.getState().zoomBy(100, anchor);
		expect(useViewport.getState().scale).toBe(MAX_SCALE);
	});

	it("setViewport replaces the whole viewport", () => {
		useViewport.getState().setViewport({ scale: 1.5, x: 500, y: -200 });
		const { scale, x, y } = useViewport.getState();
		expect({ scale, x, y }).toEqual({ scale: 1.5, x: 500, y: -200 });
	});
});
