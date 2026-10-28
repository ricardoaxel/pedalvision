import { describe, expect, it } from "vitest";
import type { CustomPedal, PlacedBoard, PlacedItem } from "../state/scene";
import { MAX_SCALE, MIN_SCALE } from "../state/viewport";
import { resolveExportPlan } from "./exportScene";
import { PX_PER_CM } from "./geometry";
import {
	boardFocusBounds,
	fitBoundsToViewport,
	focusInsets,
	sceneFocusBounds,
} from "./viewportFocus";

const STAGE = { width: 1000, height: 800 };
const NO_INSETS = { top: 0, right: 0, bottom: 0, left: 0 };

const customPedal: CustomPedal = {
	refId: "custom-a",
	brand: "Test",
	name: "Test pedal",
	widthCm: 6,
	heightCm: 12,
	category: "pedal",
	effectTypes: [],
};

function customBoard(overrides: Partial<PlacedBoard> = {}): PlacedBoard {
	return {
		uid: "board-1",
		boardRefId: null,
		customSize: { widthCm: 60, heightCm: 30 },
		texture: "matte",
		x: 10,
		y: 20,
		rotationDeg: 0,
		...overrides,
	};
}

function attachedItem(overrides: Partial<PlacedItem> = {}): PlacedItem {
	return {
		uid: "item-1",
		refId: "custom-a",
		kind: "pedal",
		boardUid: "board-1",
		x: 5,
		y: 5,
		rotationDeg: 0,
		z: 0,
		...overrides,
	};
}

describe("fitBoundsToViewport", () => {
	it("centres landscape content and fits it (scale = 2.5)", () => {
		const fit = fitBoundsToViewport(
			{ x: 0, y: 0, widthCm: 100, heightCm: 50 },
			STAGE,
			{ insets: NO_INSETS, paddingPx: 0 },
		);
		expect(fit).not.toBeNull();
		expect(fit?.scale).toBeCloseTo(2.5);
		expect(fit?.x).toBeCloseTo(0);
		expect(fit?.y).toBeCloseTo(150);
		// World centre → stage centre.
		const centreX = 50 * PX_PER_CM * (fit?.scale ?? 0) + (fit?.x ?? 0);
		const centreY = 25 * PX_PER_CM * (fit?.scale ?? 0) + (fit?.y ?? 0);
		expect(centreX).toBeCloseTo(STAGE.width / 2);
		expect(centreY).toBeCloseTo(STAGE.height / 2);
	});

	it("centres portrait content using the limiting dimension", () => {
		const fit = fitBoundsToViewport(
			{ x: 0, y: 0, widthCm: 50, heightCm: 100 },
			STAGE,
			{ insets: NO_INSETS, paddingPx: 0 },
		);
		expect(fit?.scale).toBeCloseTo(2);
		expect(fit?.x).toBeCloseTo(300);
		expect(fit?.y).toBeCloseTo(0);
	});

	it("honours breathing padding inside the safe rect", () => {
		const fit = fitBoundsToViewport(
			{ x: 0, y: 0, widthCm: 100, heightCm: 50 },
			STAGE,
			{ insets: NO_INSETS, paddingPx: 20 },
		);
		expect(fit?.scale).toBeCloseTo(2.4);
		expect(fit?.x).toBeCloseTo(20);
		expect(fit?.y).toBeCloseTo(160);
	});

	it("handles negative world coordinates without an offset error", () => {
		const fit = fitBoundsToViewport(
			{ x: -200, y: -100, widthCm: 100, heightCm: 50 },
			STAGE,
			{ insets: NO_INSETS, paddingPx: 0 },
		);
		expect(fit?.scale).toBeCloseTo(2.5);
		const topLeftX = -200 * PX_PER_CM * 2.5 + (fit?.x ?? 0);
		const topLeftY = -100 * PX_PER_CM * 2.5 + (fit?.y ?? 0);
		expect(topLeftX).toBeCloseTo(0);
		expect(topLeftY).toBeCloseTo(150);
	});

	it("caps the explicit load framing at 1× and still centres", () => {
		const fit = fitBoundsToViewport(
			{ x: 0, y: 0, widthCm: 100, heightCm: 50 },
			STAGE,
			{ insets: NO_INSETS, paddingPx: 0, maxScale: 1 },
		);
		expect(fit?.scale).toBe(1);
		expect(fit?.x).toBeCloseTo(300);
		expect(fit?.y).toBeCloseTo(300);
	});

	it("clamps a tiny target to MAX_SCALE", () => {
		const fit = fitBoundsToViewport(
			{ x: 0, y: 0, widthCm: 0.01, heightCm: 0.01 },
			STAGE,
			{ insets: NO_INSETS, paddingPx: 0 },
		);
		expect(fit?.scale).toBe(MAX_SCALE);
	});

	it("clamps a huge target to MIN_SCALE", () => {
		const fit = fitBoundsToViewport(
			{ x: 0, y: 0, widthCm: 1_000_000, heightCm: 1_000_000 },
			STAGE,
			{ insets: NO_INSETS, paddingPx: 0 },
		);
		expect(fit?.scale).toBe(MIN_SCALE);
	});

	it("frames a zero-width target (a single point on one axis)", () => {
		const fit = fitBoundsToViewport(
			{ x: 5, y: 5, widthCm: 0, heightCm: 50 },
			STAGE,
			{ insets: NO_INSETS, paddingPx: 0 },
		);
		expect(fit?.scale).toBeCloseTo(4);
		const pointX = 5 * PX_PER_CM * 4 + (fit?.x ?? 0);
		expect(pointX).toBeCloseTo(500);
	});

	it("returns null for empty, degenerate and unusable viewports", () => {
		expect(
			fitBoundsToViewport({ x: 0, y: 0, widthCm: 0, heightCm: 0 }, STAGE, {
				insets: NO_INSETS,
				paddingPx: 0,
			}),
		).toBeNull();
		expect(
			fitBoundsToViewport(
				{ x: 0, y: 0, widthCm: 10, heightCm: 10 },
				{ width: 0, height: 0 },
				{ insets: NO_INSETS, paddingPx: 0 },
			),
		).toBeNull();
		expect(
			fitBoundsToViewport({ x: 0, y: 0, widthCm: 10, heightCm: 10 }, STAGE, {
				insets: { top: 400, right: 500, bottom: 400, left: 500 },
				paddingPx: 0,
			}),
		).toBeNull();
		expect(
			fitBoundsToViewport(
				{ x: Number.NaN, y: 0, widthCm: 10, heightCm: 10 },
				STAGE,
				{ insets: NO_INSETS, paddingPx: 0 },
			),
		).toBeNull();
	});
});

describe("focusInsets", () => {
	it("reserves the desktop chrome only", () => {
		expect(
			focusInsets(
				{ width: 1000, height: 800 },
				{ mobile: false, sheetHeight: 0 },
			),
		).toEqual({ top: 72, right: 24, bottom: 24, left: 24 });
	});

	it("reserves the mobile dock + strip + info peek", () => {
		expect(
			focusInsets(
				{ width: 400, height: 800 },
				{ mobile: true, sheetHeight: 0 },
			),
		).toEqual({ top: 72, right: 16, bottom: 150, left: 16 });
		expect(
			focusInsets(
				{ width: 400, height: 800 },
				{ mobile: true, sheetHeight: 300 },
			),
		).toMatchObject({ top: 72, right: 16, bottom: 360, left: 16 });
	});

	it("caps the reserve on a short viewport so the frame cannot collapse", () => {
		const insets = focusInsets(
			{ width: 400, height: 200 },
			{ mobile: true, sheetHeight: 0 },
		);
		expect(insets.top).toBe(30);
		expect(insets.bottom).toBe(90);
		expect(200 - insets.top - insets.bottom).toBeGreaterThanOrEqual(80);
	});
});

describe("focus bounds reuse the export scope", () => {
	it("matches the selected-board export content bounds (items included)", () => {
		const board = customBoard();
		const item = attachedItem({ x: 58, y: 28 });
		const scene = {
			boards: [board],
			items: [item],
			customPedals: [customPedal],
			endpoints: [],
			cables: [],
		};
		const expected = resolveExportPlan(scene, {
			scope: "board",
			boardUid: board.uid,
		}).contentBoundsCm;
		expect(boardFocusBounds(scene, board.uid)).toEqual(expected);
		// The item sits at board-local x=58 and is 6 cm wide, so its world AABB
		// reaches x=74 — 4 cm past the board's right edge (included on purpose).
		expect(boardFocusBounds(scene, board.uid)?.widthCm).toBeCloseTo(64);
	});

	it("matches the all-content export bounds (loose items included)", () => {
		const scene = {
			boards: [customBoard()],
			items: [
				attachedItem(),
				attachedItem({ uid: "item-2", boardUid: null, x: 120, y: 80 }),
			],
			customPedals: [customPedal],
			endpoints: [],
			cables: [],
		};
		const expected = resolveExportPlan(scene, { scope: "all" }).contentBoundsCm;
		expect(sceneFocusBounds(scene)).toEqual(expected);
	});

	it("includes a rotated board's true AABB", () => {
		const board = customBoard({ rotationDeg: 90 });
		const scene = {
			boards: [board],
			items: [],
			customPedals: [],
			endpoints: [],
			cables: [],
		};
		const bounds = boardFocusBounds(scene, board.uid);
		expect(bounds?.widthCm).toBeCloseTo(30);
		expect(bounds?.heightCm).toBeCloseTo(60);
	});

	it("returns null for an empty sheet or a missing board", () => {
		const empty = {
			boards: [],
			items: [],
			customPedals: [],
			endpoints: [],
			cables: [],
		};
		expect(sceneFocusBounds(empty)).toBeNull();
		expect(boardFocusBounds(empty, "missing")).toBeNull();
	});
});
