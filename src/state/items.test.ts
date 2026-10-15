import { beforeEach, describe, expect, it } from "vitest";
import { catalog } from "../catalog/load";
import { boardToWorld, worldToBoard } from "../lib/geometry";
import {
	DUPLICATE_OFFSET_CM,
	findBoardAt,
	itemWorldOrigin,
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

	it("moveItem writes x/y in the item's own frame", () => {
		const uid = useScene
			.getState()
			.addItem("boss-bd-2-blues-driver", "pedal", null, { x: 0, y: 0 });
		useScene.getState().moveItem(uid, 12.5, -3.25);
		const item = useScene.getState().items[0];
		expect({ x: item.x, y: item.y }).toEqual({ x: 12.5, y: -3.25 });
	});

	it("removeBoard drops its attached items loose at their world positions", () => {
		const uid = useScene.getState().addBoard(boss.id, { x: 50, y: 40 });
		const board = useScene.getState().boards[0];
		useScene.getState().rotateBoard(uid, 30);
		const rotated = { ...board, rotationDeg: 30 };
		const itemUid = useScene
			.getState()
			.addItem("boss-bd-2-blues-driver", "pedal", uid, { x: 10, y: 5 });
		const world = boardToWorld({ x: 10, y: 5 }, rotated);

		useScene.getState().removeBoard(uid);
		const item = useScene
			.getState()
			.items.find((candidate) => candidate.uid === itemUid);
		expect(item?.boardUid).toBeNull();
		expect(item?.x).toBeCloseTo(world.x, 10);
		expect(item?.y).toBeCloseTo(world.y, 10);
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

	it("stores board-relative cm under a rotated board", () => {
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
		// Drop so the pedal's centre lands inside the rotated board.
		const originWorld = { x: 80, y: 60 };
		useScene.getState().dropItem(uid, originWorld);

		const item = useScene.getState().items[0];
		expect(item.boardUid).toBe(boardUid);
		const expected = worldToBoard(originWorld, rotated);
		expect(expected.x).toBeCloseTo(10, 10);
		expect(expected.y).toBeCloseTo(20, 10);
		expect(item.x).toBeCloseTo(expected.x, 10);
		expect(item.y).toBeCloseTo(expected.y, 10);
		// And the stored position maps back to the same world origin.
		const back = boardToWorld({ x: item.x, y: item.y }, rotated);
		expect(back.x).toBeCloseTo(originWorld.x, 10);
		expect(back.y).toBeCloseTo(originWorld.y, 10);
	});

	it("keeps the item loose (world cm) when dropped outside every board", () => {
		const boardUid = useScene.getState().addBoard(boss.id, { x: 0, y: 0 });
		useScene.getState().moveBoard(boardUid, 100, 50);
		const uid = useScene
			.getState()
			.addItem("boss-bd-2-blues-driver", "pedal", boardUid, { x: 5, y: 5 });
		useScene.getState().dropItem(uid, { x: 0, y: 0 });
		const item = useScene.getState().items[0];
		expect(item.boardUid).toBeNull();
		expect({ x: item.x, y: item.y }).toEqual({ x: 0, y: 0 });
	});

	it("re-parents between boards using the topmost hit", () => {
		const a = useScene.getState().addBoard(boss.id, { x: 0, y: 0 });
		const b = useScene.getState().addBoard(boss.id, { x: 0, y: 0 });
		// Both at the viewport origin; the later board (b) is on top.
		const uid = useScene
			.getState()
			.addItem("boss-bd-2-blues-driver", "pedal", a, { x: 5, y: 5 });
		// Drop so the pedal's centre lands inside the overlapping boards.
		useScene.getState().dropItem(uid, { x: HALF.x, y: HALF.y });
		expect(useScene.getState().items[0].boardUid).toBe(b);
	});
});
