import { beforeEach, describe, expect, it } from "vitest";
import { catalog } from "../catalog/load";
import { boardToWorld, rotatePoint, worldToBoard } from "../lib/geometry";
import {
	DUPLICATE_OFFSET_CM,
	findBoardAt,
	itemWorldOrigin,
	pointerGrabOffset,
	useScene,
} from "./scene";

const boss = catalog.boards.find((board) => board.id === "boss-bcb-1000");
if (!boss) throw new Error("test fixture board missing from the seed");

// A real pedal with known dimensions (7.3 × 13.02 cm) for drop-math fixtures.
const pedal = catalog.pedals.find((p) => p.id === "boss-bd-2-blues-driver");
if (!pedal) throw new Error("test fixture pedal missing from the seed");

const HALF = { x: pedal.widthCm / 2, y: pedal.heightCm / 2 };

describe("items slice", () => {
	beforeEach(() => {
		useScene.setState({ boards: [], items: [] });
	});

	it("addItem stores the origin and a dense per-container z", () => {
		const boardUid = useScene.getState().addBoard(boss.id, { x: 0, y: 0 });
		const a = useScene
			.getState()
			.addItem("boss-bd-2-blues-driver", "pedal", boardUid, { x: 1, y: 2 });
		const b = useScene
			.getState()
			.addItem("boss-bd-2-blues-driver", "pedal", boardUid, { x: 3, y: 4 });
		const loose = useScene
			.getState()
			.addItem("boss-bd-2-blues-driver", "pedal", null, { x: 9, y: 9 });

		const items = useScene.getState().items;
		expect(items.map((item) => item.uid)).toEqual([a, b, loose]);
		expect(items[0].z).toBe(0);
		expect(items[1].z).toBe(1);
		// A different container restarts its own dense z.
		expect(items[2].z).toBe(0);
	});

	it("duplicateItem clones with an offset, same parent and a new uid", () => {
		const boardUid = useScene.getState().addBoard(boss.id, { x: 0, y: 0 });
		const uid = useScene
			.getState()
			.addItem("boss-bd-2-blues-driver", "pedal", boardUid, { x: 5, y: 6 });
		const cloneUid = useScene.getState().duplicateItem(uid);
		const items = useScene.getState().items;
		expect(cloneUid).not.toBe(uid);
		expect(items).toHaveLength(2);
		const clone = items.find((item) => item.uid === cloneUid);
		expect(clone).toMatchObject({
			refId: "boss-bd-2-blues-driver",
			boardUid,
			x: 5 + DUPLICATE_OFFSET_CM,
			y: 6 + DUPLICATE_OFFSET_CM,
		});
	});

	it("removeItem drops only the target", () => {
		const a = useScene
			.getState()
			.addItem("boss-bd-2-blues-driver", "pedal", null, { x: 0, y: 0 });
		const b = useScene
			.getState()
			.addItem("boss-bd-2-blues-driver", "pedal", null, { x: 1, y: 1 });
		useScene.getState().removeItem(a);
		expect(useScene.getState().items.map((item) => item.uid)).toEqual([b]);
	});

	it("dropItem moves an item within its container (world cm when loose)", () => {
		const uid = useScene
			.getState()
			.addItem("boss-bd-2-blues-driver", "pedal", null, { x: 0, y: 0 });
		useScene.getState().dropItem(uid, { x: 12.5, y: -3.25 }, 0);
		const item = useScene.getState().items[0];
		expect({ x: item.x, y: item.y }).toEqual({ x: 12.5, y: -3.25 });
	});

	it("removeBoard keeps a rotated item's visible centre", () => {
		const boardUid = useScene.getState().addBoard(boss.id, { x: 50, y: 40 });
		useScene.getState().rotateBoard(boardUid, 30);
		const rotated = { ...useScene.getState().boards[0] };
		const itemUid = useScene
			.getState()
			.addItem("boss-bd-2-blues-driver", "pedal", boardUid, { x: 10, y: 5 });
		useScene.getState().rotateItem(itemUid, 45);
		const before = useScene
			.getState()
			.items.find((candidate) => candidate.uid === itemUid);
		if (!before) throw new Error("item missing");
		const rotHalf = rotatePoint(HALF, { x: 0, y: 0 }, before.rotationDeg);
		const worldCentre = boardToWorld(
			{ x: before.x + rotHalf.x, y: before.y + rotHalf.y },
			rotated,
		);

		useScene.getState().removeBoard(boardUid);
		const item = useScene
			.getState()
			.items.find((candidate) => candidate.uid === itemUid);
		expect(item?.boardUid).toBeNull();
		expect(item?.rotationDeg).toBe(45);
		// The loose item renders with the same rotation, so its centre is preserved.
		expect((item?.x ?? 0) + rotHalf.x).toBeCloseTo(worldCentre.x, 10);
		expect((item?.y ?? 0) + rotHalf.y).toBeCloseTo(worldCentre.y, 10);
	});

	it("removeBoard keeps an attached item's visible centre under rotation", () => {
		const uid = useScene.getState().addBoard(boss.id, { x: 50, y: 40 });
		const board = useScene.getState().boards[0];
		useScene.getState().rotateBoard(uid, 30);
		const rotated = { ...board, rotationDeg: 30 };
		const itemUid = useScene
			.getState()
			.addItem("boss-bd-2-blues-driver", "pedal", uid, { x: 10, y: 5 });
		// The attached item's visible world centre (rendered on the rotated board).
		const worldCentre = boardToWorld(
			{ x: 10 + HALF.x, y: 5 + HALF.y },
			rotated,
		);

		useScene.getState().removeBoard(uid);
		const item = useScene
			.getState()
			.items.find((candidate) => candidate.uid === itemUid);
		expect(item?.boardUid).toBeNull();
		// The loose item renders unrotated; its centre is preserved (not the origin).
		expect((item?.x ?? 0) + HALF.x).toBeCloseTo(worldCentre.x, 10);
		expect((item?.y ?? 0) + HALF.y).toBeCloseTo(worldCentre.y, 10);
	});
});

describe("itemWorldOrigin", () => {
	it("applies the board transform for attached items", () => {
		const board = {
			uid: "b",
			boardRefId: null,
			customSize: { widthCm: 40, heightCm: 20 },
			x: 100,
			y: 50,
			rotationDeg: 37,
		};
		const item = {
			uid: "i",
			refId: "boss-bd-2-blues-driver",
			kind: "pedal" as const,
			boardUid: "b",
			x: 4,
			y: 8,
			rotationDeg: 0,
			z: 0,
		};
		expect(itemWorldOrigin(item, [board])).toEqual(
			boardToWorld({ x: 4, y: 8 }, board),
		);
	});

	it("returns stored coordinates for loose items and missing boards", () => {
		const item = {
			uid: "i",
			refId: "boss-bd-2-blues-driver",
			kind: "pedal" as const,
			boardUid: null,
			x: 4,
			y: 8,
			rotationDeg: 0,
			z: 0,
		};
		expect(itemWorldOrigin(item, [])).toEqual({ x: 4, y: 8 });
		expect(itemWorldOrigin({ ...item, boardUid: "gone" }, [])).toEqual({
			x: 4,
			y: 8,
		});
	});
});

describe("pointerGrabOffset", () => {
	it("grabs an unmoved item at its own frame (loose)", () => {
		const item = {
			uid: "i",
			refId: "boss-bd-2-blues-driver",
			kind: "pedal" as const,
			boardUid: null,
			x: 10,
			y: 20,
			rotationDeg: 0,
			z: 0,
		};
		// Press at the item's unrotated centre → offset = half-footprint.
		const offset = pointerGrabOffset(item, [], { x: 13.65, y: 26.51 });
		expect(offset.x).toBeCloseTo(3.65, 10);
		expect(offset.y).toBeCloseTo(6.51, 10);
	});

	it("returns the world-frame offset for a centre-grab on a rotated board", () => {
		const board = {
			uid: "b",
			boardRefId: boss.id,
			x: 100,
			y: 50,
			rotationDeg: 90,
		};
		const item = {
			uid: "i",
			refId: "boss-bd-2-blues-driver",
			kind: "pedal" as const,
			boardUid: "b",
			x: 10,
			y: 20,
			rotationDeg: 0,
			z: 0,
		};
		// The lifted pedal keeps its composed (board+own) rotation, so the grab
		// offset is the world vector from the item's world origin to the press —
		// here the rotated half-footprint R(90)·HALF = (-6.51, 3.65).
		const worldCentre = boardToWorld(
			{ x: item.x + HALF.x, y: item.y + HALF.y },
			board,
		);
		const offset = pointerGrabOffset(item, [board], worldCentre);
		expect(offset.x).toBeCloseTo(-HALF.y, 10);
		expect(offset.y).toBeCloseTo(HALF.x, 10);
	});
});

describe("findBoardAt", () => {
	it("hits an unrotated board inside its footprint, misses outside", () => {
		const board = {
			uid: "b",
			boardRefId: boss.id,
			x: 0,
			y: 0,
			rotationDeg: 0,
		};
		expect(findBoardAt([board], { x: 10, y: 10 })?.uid).toBe("b");
		expect(findBoardAt([board], { x: -1, y: 10 })).toBeNull();
		expect(findBoardAt([board], { x: boss.widthCm + 1, y: 10 })).toBeNull();
	});

	it("hits through a rotated board via worldToBoard", () => {
		const board = {
			uid: "b",
			boardRefId: boss.id,
			x: 100,
			y: 50,
			rotationDeg: 90,
		};
		// local {10,20} → world (boardToWorld) is inside the rotated footprint.
		const inside = boardToWorld({ x: 10, y: 20 }, board);
		expect(findBoardAt([board], inside)?.uid).toBe("b");
		// A world point that is inside the *unrotated* box but outside the
		// rotated one must miss (the bug class this guards).
		const outside = { x: 100 + boss.widthCm / 2, y: 50 + 10 };
		expect(findBoardAt([board], outside)).toBeNull();
	});

	it("returns the topmost (last) board when several contain the point", () => {
		const lower = {
			uid: "lower",
			boardRefId: boss.id,
			x: 0,
			y: 0,
			rotationDeg: 0,
		};
		const upper = {
			uid: "upper",
			boardRefId: boss.id,
			x: 0,
			y: 0,
			rotationDeg: 0,
		};
		expect(findBoardAt([lower, upper], { x: 10, y: 10 })?.uid).toBe("upper");
	});
});

describe("dropItem re-parenting math", () => {
	beforeEach(() => {
		useScene.setState({ boards: [], items: [] });
	});

	it("attaches under a rotated board preserving the hit-tested centre", () => {
		const boardUid = useScene.getState().addBoard(boss.id, { x: 0, y: 0 });
		useScene.getState().rotateBoard(boardUid, 90);
		useScene.getState().moveBoard(boardUid, 100, 50);
		// Board local origin at world (100, 50); a 90° board spans
		// x∈[origin.x−h, origin.x], y∈[origin.y, origin.y+w].
		const rotated = {
			uid: boardUid,
			boardRefId: boss.id,
			x: 100,
			y: 50,
			rotationDeg: 90,
		};

		const uid = useScene
			.getState()
			.addItem("boss-bd-2-blues-driver", "pedal", null, { x: 0, y: 0 });
		// Drop so the pedal's visible centre lands inside the rotated board.
		const originWorld = { x: 80, y: 60 };
		const centre = { x: originWorld.x + HALF.x, y: originWorld.y + HALF.y };
		useScene.getState().dropItem(uid, originWorld, 0);

		const item = useScene.getState().items[0];
		expect(item.boardUid).toBe(boardUid);
		// The drop preserves the visible orientation: relative rotation = 0 − 90°.
		expect(item.rotationDeg).toBe(270);
		// Stored board-local origin = local centre − the (relative-rotation) half.
		const localHalf = rotatePoint(HALF, { x: 0, y: 0 }, item.rotationDeg);
		const localCentre = worldToBoard(centre, rotated);
		expect(item.x).toBeCloseTo(localCentre.x - localHalf.x, 10);
		expect(item.y).toBeCloseTo(localCentre.y - localHalf.y, 10);
		// The rendered world centre is preserved across the attach (no jump caused
		// by the board group rotating the footprint about the origin).
		const renderedCentre = boardToWorld(
			{ x: item.x + localHalf.x, y: item.y + localHalf.y },
			rotated,
		);
		expect(renderedCentre.x).toBeCloseTo(centre.x, 10);
		expect(renderedCentre.y).toBeCloseTo(centre.y, 10);
	});

	it("preserves the rendered centre when nudging within a rotated board", () => {
		const boardUid = useScene.getState().addBoard(boss.id, { x: 0, y: 0 });
		useScene.getState().rotateBoard(boardUid, 90);
		useScene.getState().moveBoard(boardUid, 100, 50);
		const rotated = {
			uid: boardUid,
			boardRefId: boss.id,
			x: 100,
			y: 50,
			rotationDeg: 90,
		};
		const uid = useScene
			.getState()
			.addItem("boss-bd-2-blues-driver", "pedal", boardUid, { x: 5, y: 5 });

		const dropOrigin = { x: 75, y: 55 };
		const centre = { x: dropOrigin.x + HALF.x, y: dropOrigin.y + HALF.y };
		useScene.getState().dropItem(uid, dropOrigin, 0);

		const item = useScene.getState().items[0];
		const localHalf = rotatePoint(HALF, { x: 0, y: 0 }, item.rotationDeg);
		const renderedCentre = boardToWorld(
			{ x: item.x + localHalf.x, y: item.y + localHalf.y },
			rotated,
		);
		expect(renderedCentre.x).toBeCloseTo(centre.x, 10);
		expect(renderedCentre.y).toBeCloseTo(centre.y, 10);
	});

	it("preserves the visible centre of a rotated item dropped onto a rotated board", () => {
		const boardUid = useScene.getState().addBoard(boss.id, { x: 0, y: 0 });
		useScene.getState().rotateBoard(boardUid, 90);
		useScene.getState().moveBoard(boardUid, 100, 50);
		const rotatedBoard = {
			uid: boardUid,
			boardRefId: boss.id,
			x: 100,
			y: 50,
			rotationDeg: 90,
		};

		// A loose item the user has rotated to 45°.
		const uid = useScene
			.getState()
			.addItem("boss-bd-2-blues-driver", "pedal", null, { x: 0, y: 0 });
		useScene.getState().rotateItem(uid, 45);
		const before = useScene.getState().items[0];
		const rotHalf = rotatePoint(HALF, { x: 0, y: 0 }, before.rotationDeg);
		expect(before.rotationDeg).toBe(45);

		// Drop so the rotated item's visible centre lands inside the board, keeping
		// its 45° visible orientation (visual rotation passed to dropItem).
		const targetCentre = boardToWorld({ x: 20, y: 10 }, rotatedBoard);
		useScene.getState().dropItem(
			uid,
			{
				x: targetCentre.x - rotHalf.x,
				y: targetCentre.y - rotHalf.y,
			},
			before.rotationDeg,
		);

		const item = useScene.getState().items[0];
		expect(item.boardUid).toBe(boardUid);
		// Relative rotation = visible (45°) − board (90°).
		expect(item.rotationDeg).toBe(315);
		const localHalf = rotatePoint(HALF, { x: 0, y: 0 }, item.rotationDeg);
		const renderedCentre = boardToWorld(
			{ x: item.x + localHalf.x, y: item.y + localHalf.y },
			rotatedBoard,
		);
		expect(renderedCentre.x).toBeCloseTo(targetCentre.x, 10);
		expect(renderedCentre.y).toBeCloseTo(targetCentre.y, 10);
	});

	it("keeps the item loose (world cm) when dropped outside every board", () => {
		const boardUid = useScene.getState().addBoard(boss.id, { x: 0, y: 0 });
		useScene.getState().moveBoard(boardUid, 100, 50);
		const uid = useScene
			.getState()
			.addItem("boss-bd-2-blues-driver", "pedal", boardUid, { x: 5, y: 5 });
		useScene.getState().dropItem(uid, { x: 0, y: 0 }, 0);
		const item = useScene.getState().items[0];
		expect(item.boardUid).toBeNull();
		expect({ x: item.x, y: item.y }).toEqual({ x: 0, y: 0 });
		expect(item.rotationDeg).toBe(0);
	});

	it("re-parents between boards using the topmost hit", () => {
		const a = useScene.getState().addBoard(boss.id, { x: 0, y: 0 });
		const b = useScene.getState().addBoard(boss.id, { x: 0, y: 0 });
		// Both at the viewport origin; the later board (b) is on top.
		const uid = useScene
			.getState()
			.addItem("boss-bd-2-blues-driver", "pedal", a, { x: 5, y: 5 });
		// Drop so the pedal's centre lands inside the overlapping boards.
		useScene.getState().dropItem(uid, { x: HALF.x, y: HALF.y }, 0);
		expect(useScene.getState().items[0].boardUid).toBe(b);
	});
});
