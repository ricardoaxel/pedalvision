import { describe, expect, it } from "vitest";
import {
	boardToWorld,
	cmToDisplay,
	cmToPx,
	PX_PER_CM,
	pxToCm,
	rotatePoint,
	worldToBoard,
} from "./geometry";

const ORIGIN = { x: 0, y: 0 };

describe("PX_PER_CM", () => {
	it("is the render constant (start: 4)", () => {
		expect(PX_PER_CM).toBe(4);
	});
});

describe("cmToPx / pxToCm", () => {
	it("maps cm to px at the given zoom: px = cm × PX_PER_CM × zoom", () => {
		expect(cmToPx(10)).toBe(40);
		expect(cmToPx(10, 1)).toBe(40);
		expect(cmToPx(10, 2)).toBe(80);
		expect(cmToPx(2.5, 0.5)).toBe(5);
		expect(cmToPx(0)).toBe(0);
		expect(cmToPx(-3, 2)).toBe(-24);
	});

	it("defaults zoom to 1", () => {
		expect(cmToPx(7)).toBe(cmToPx(7, 1));
		expect(pxToCm(28)).toBe(pxToCm(28, 1));
	});

	it("round-trips cm → px → cm for many values and zooms", () => {
		const zooms = [0.1, 0.5, 1, 1.75, 4, 8];
		const cms = [0, 0.01, 1, 2.54, 12.5, -3.7, 248];
		for (const zoom of zooms) {
			for (const cm of cms) {
				expect(pxToCm(cmToPx(cm, zoom), zoom)).toBeCloseTo(cm, 10);
			}
		}
	});
});

describe("rotatePoint", () => {
	it("returns the same point for 0deg and for a full turn", () => {
		const p = { x: 3, y: 4 };
		expect(rotatePoint(p, ORIGIN, 0)).toEqual(p);
		const full = rotatePoint(p, ORIGIN, 360);
		expect(full.x).toBeCloseTo(3, 10);
		expect(full.y).toBeCloseTo(4, 10);
	});

	it("rotates clockwise-positive (screen coords): (1,0) → (0,1) at 90°", () => {
		const r = rotatePoint({ x: 1, y: 0 }, ORIGIN, 90);
		expect(r.x).toBeCloseTo(0, 10);
		expect(r.y).toBeCloseTo(1, 10);
	});

	it("four 90° turns return to the start", () => {
		const p = { x: 2, y: -5 };
		const once = rotatePoint(p, ORIGIN, 90);
		const twice = rotatePoint(once, ORIGIN, 90);
		const thrice = rotatePoint(twice, ORIGIN, 90);
		const four = rotatePoint(thrice, ORIGIN, 90);
		expect(four.x).toBeCloseTo(p.x, 10);
		expect(four.y).toBeCloseTo(p.y, 10);
	});

	it("is inverted by the opposite angle", () => {
		const p = { x: 7, y: 1.5 };
		const center = { x: -2, y: 9 };
		for (const deg of [15, 45, 90, 137.5, -30]) {
			const back = rotatePoint(rotatePoint(p, center, deg), center, -deg);
			expect(back.x).toBeCloseTo(p.x, 10);
			expect(back.y).toBeCloseTo(p.y, 10);
		}
	});

	it("preserves the distance to the center", () => {
		const center = { x: 4, y: 4 };
		const p = { x: 10, y: 7 };
		const before = Math.hypot(p.x - center.x, p.y - center.y);
		for (const deg of [30, 200, -75]) {
			const r = rotatePoint(p, center, deg);
			expect(Math.hypot(r.x - center.x, r.y - center.y)).toBeCloseTo(
				before,
				10,
			);
		}
	});
});

describe("boardToWorld / worldToBoard", () => {
	it("boardToWorld with no rotation is a pure translation", () => {
		const world = boardToWorld(
			{ x: 2, y: 3 },
			{ x: 10, y: 20, rotationDeg: 0 },
		);
		expect(world).toEqual({ x: 12, y: 23 });
	});

	it("worldToBoard with no rotation is the inverse translation", () => {
		const local = worldToBoard(
			{ x: 12, y: 23 },
			{ x: 10, y: 20, rotationDeg: 0 },
		);
		expect(local).toEqual({ x: 2, y: 3 });
	});

	it("round-trips board-local → world → board-local for any orientation", () => {
		const item = { x: 5, y: -2.5 };
		const boards = [
			{ x: 0, y: 0, rotationDeg: 0 },
			{ x: 12, y: 7, rotationDeg: 33 },
			{ x: -40.5, y: 100, rotationDeg: 90 },
			{ x: 3, y: 3, rotationDeg: 180 },
			{ x: 8.25, y: -1, rotationDeg: 45 },
			{ x: 0, y: 0, rotationDeg: -37.5 },
		];
		for (const board of boards) {
			const back = worldToBoard(boardToWorld(item, board), board);
			expect(back.x).toBeCloseTo(item.x, 10);
			expect(back.y).toBeCloseTo(item.y, 10);
		}
	});

	it("rotates the local frame about the board origin", () => {
		const world = boardToWorld({ x: 1, y: 0 }, { x: 0, y: 0, rotationDeg: 90 });
		expect(world.x).toBeCloseTo(0, 10);
		expect(world.y).toBeCloseTo(1, 10);
	});
});

describe("centre-origin rotation (Transformer commit math)", () => {
	// When Konva's Transformer rotates a board it rotates about the node centre,
	// which moves the stored origin (top-left). These pin the committed values
	// for a fixed board to literals, so the check cannot cancel against the same
	// helper it exercises.
	it("pins the committed origin and world centre for a 90° rotation", () => {
		const size = { widthCm: 40, heightCm: 20 };
		const centreLocal = { x: size.widthCm / 2, y: size.heightCm / 2 };
		const start = { x: 10, y: 5, rotationDeg: 0 };

		// Sanity: the start centre is at (30, 15) world cm.
		expect(boardToWorld(centreLocal, start)).toEqual({ x: 30, y: 15 });

		// Rotating 90° CW about the centre commits origin (40, -5); the centre
		// must still be (30, 15).
		const committed = { x: 40, y: -5, rotationDeg: 90 };
		const centre = boardToWorld(centreLocal, committed);
		expect(centre.x).toBeCloseTo(30, 10);
		expect(centre.y).toBeCloseTo(15, 10);
	});
});

describe("A1 invariant — viewport independence", () => {
	const board = { x: 12, y: 7, rotationDeg: 33 };
	const item = { x: 5, y: -2.5 };

	const viewports = [
		{
			name: "desktop 1440×900",
			width: 1440,
			height: 900,
			zoom: 1,
			panX: 0,
			panY: 0,
		},
		{
			name: "mobile 390×844",
			width: 390,
			height: 844,
			zoom: 0.6,
			panX: 120,
			panY: 240,
		},
		{
			name: "zoom-in 1920×1080",
			width: 1920,
			height: 1080,
			zoom: 3.2,
			panX: -540,
			panY: -80,
		},
	];

	// A1 is largely structural: `boardToWorld` has no viewport input, so the
	// stored world cm cannot depend on it. This test proves the *other* half —
	// that the world↔screen mapping round-trips correctly under three different
	// viewport transforms (a unit swap that stayed internally consistent would
	// slip past it; the concrete `cmToPx(10) === 40` pin is what fixes the unit).
	it("world↔screen round-trips identically across different viewport transforms", () => {
		const world = boardToWorld(item, board);
		const screens = viewports.map((vp) => ({
			vp,
			x: cmToPx(world.x, vp.zoom) + vp.panX,
			y: cmToPx(world.y, vp.zoom) + vp.panY,
		}));

		// The simulated viewports really do place the item differently on screen
		// (otherwise this test would prove nothing)…
		expect(new Set(screens.map((s) => `${s.x},${s.y}`)).size).toBe(
			viewports.length,
		);

		// …yet every screen position maps back to the same stored world cm.
		for (const s of screens) {
			expect(pxToCm(s.x - s.vp.panX, s.vp.zoom)).toBeCloseTo(world.x, 10);
			expect(pxToCm(s.y - s.vp.panY, s.vp.zoom)).toBeCloseTo(world.y, 10);
		}
	});

	it.each(viewports)(
		"$name — position relative to its board is unchanged",
		(vp) => {
			const world = boardToWorld(item, board);
			const screenX = cmToPx(world.x, vp.zoom) + vp.panX;
			const screenY = cmToPx(world.y, vp.zoom) + vp.panY;
			const roundTrippedWorld = {
				x: pxToCm(screenX - vp.panX, vp.zoom),
				y: pxToCm(screenY - vp.panY, vp.zoom),
			};
			const local = worldToBoard(roundTrippedWorld, board);
			expect(local.x).toBeCloseTo(item.x, 10);
			expect(local.y).toBeCloseTo(item.y, 10);
		},
	);
});

describe("cmToDisplay", () => {
	it("returns cm unchanged (rounded to 2 decimals)", () => {
		expect(cmToDisplay(10, "cm")).toBe(10);
		expect(cmToDisplay(12.345, "cm")).toBe(12.35);
	});

	it("converts cm → inches (× 1/2.54) rounded to 2 decimals", () => {
		expect(cmToDisplay(2.54, "in")).toBe(1);
		expect(cmToDisplay(10, "in")).toBe(3.94);
		expect(cmToDisplay(1, "in")).toBe(0.39);
		expect(cmToDisplay(0, "in")).toBe(0);
	});

	it("normalises -0 to 0", () => {
		expect(Object.is(cmToDisplay(-0.001, "cm"), 0)).toBe(true);
		expect(Object.is(cmToDisplay(0, "in"), 0)).toBe(true);
	});

	it("rounds only for display — geometry keeps full precision", () => {
		const precise = 12.34567;
		expect(cmToDisplay(precise, "cm")).toBe(12.35);
		expect(pxToCm(cmToPx(precise, 2.5), 2.5)).toBeCloseTo(precise, 12);
	});
});
