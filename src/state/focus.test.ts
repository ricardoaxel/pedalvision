import { describe, expect, it } from "vitest";
import { type FocusSnapshot, resolveCameraBoardUid } from "./focus";
import type { PlacedBoard } from "./scene";

const board: PlacedBoard = {
	uid: "board-1",
	boardRefId: null,
	customSize: { widthCm: 60, heightCm: 30 },
	texture: "matte",
	x: 0,
	y: 0,
	rotationDeg: 0,
};

const size = { width: 1000, height: 800 };
const viewport = { scale: 1, x: 10, y: 20 };
const scene = {
	boards: [board],
	items: [],
	customPedals: [],
	endpoints: [],
	cables: [],
};

function snapshot(): FocusSnapshot {
	return {
		target: "board",
		targetUid: "board-1",
		bounds: { x: 0, y: 0, widthCm: 60, heightCm: 30 },
		viewport: { ...viewport },
		boards: scene.boards,
		items: scene.items,
		customPedals: scene.customPedals,
		endpoints: scene.endpoints,
		cables: scene.cables,
		size: { ...size },
		scaleStripHeight: 114,
		sheetHeight: 0,
	};
}

function state(overrides: Record<string, unknown> = {}) {
	return {
		last: snapshot(),
		lockedBoardUid: null,
		viewport: { ...viewport },
		size: { ...size },
		scaleStripHeight: 114,
		sheetHeight: 0,
		scene,
		...overrides,
	};
}

describe("resolveCameraBoardUid", () => {
	it("reports the board under the matching camera", () => {
		expect(resolveCameraBoardUid(state())).toBe("board-1");
	});

	it("clears on pan, zoom, resize, strip/sheet change or a scene edit", () => {
		expect(
			resolveCameraBoardUid(
				state({ viewport: { ...viewport, x: viewport.x + 1 } }),
			),
		).toBeNull();
		expect(
			resolveCameraBoardUid(
				state({ size: { ...size, width: size.width + 1 } }),
			),
		).toBeNull();
		expect(resolveCameraBoardUid(state({ scaleStripHeight: 100 }))).toBeNull();
		expect(resolveCameraBoardUid(state({ sheetHeight: 10 }))).toBeNull();
		expect(
			resolveCameraBoardUid(
				state({ scene: { ...scene, boards: [...scene.boards] } }),
			),
		).toBeNull();
	});

	it("is null for an all-content focus, a missing board or no focus", () => {
		expect(
			resolveCameraBoardUid(
				state({ last: { ...snapshot(), target: "scene", targetUid: null } }),
			),
		).toBeNull();
		expect(resolveCameraBoardUid(state({ last: null }))).toBeNull();
		expect(
			resolveCameraBoardUid(state({ scene: { ...scene, boards: [] } })),
		).toBeNull();
	});

	it("the lock pins a board even when the camera has moved", () => {
		expect(
			resolveCameraBoardUid(
				state({
					lockedBoardUid: "board-1",
					viewport: { ...viewport, x: 999 },
					scene: { ...scene, boards: [...scene.boards] },
				}),
			),
		).toBe("board-1");
	});

	it("the lock is ignored once its board is gone", () => {
		expect(
			resolveCameraBoardUid(
				state({ lockedBoardUid: "missing", scene: { ...scene, boards: [] } }),
			),
		).toBeNull();
	});
});
