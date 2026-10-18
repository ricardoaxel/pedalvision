import { create } from "zustand";
import { catalog } from "../catalog/load";
import type {
	CatalogBoard,
	CatalogPedal,
	EffectType,
	Jack,
	Power,
} from "../catalog/schema";
import {
	boardToWorld,
	type Point,
	rotatePoint,
	worldToBoard,
} from "../lib/geometry";

/**
 * The scene document (design.md §Data model). The boards and pedal/supply
 * items slices exist so far — cables/endpoints arrive in later tasks. All
 * geometry is in cm; pixels are computed at render time only.
 */
export interface PlacedBoard {
	uid: string;
	/** Catalog board id, or null for a custom-size board (P2-05). */
	boardRefId: string | null;
	/** Footprint override for custom boards (P2-05). */
	customSize?: { widthCm: number; heightCm: number };
	/** World cm of the board's local origin (its unrotated top-left — the
	 * rotation pivot; see geometry.ts §BoardTransform). */
	x: number;
	y: number;
	/** Clockwise-positive (Konva convention), any angle. */
	rotationDeg: number;
}

/**
 * A placed pedal/supply (design.md §Data model, PlacedItem). `x`/`y` are cm in
 * the parent frame: relative to the owning board's **unrotated** local origin
 * when `boardUid` is set, or world cm when the item is loose (`boardUid` null).
 * `refId` resolves to a catalog pedal (its `category` must match `kind`).
 */
export interface PlacedItem {
	uid: string;
	refId: string;
	kind: "pedal" | "supply";
	/** Owning board uid, or null when the item is loose (world cm). */
	boardUid: string | null;
	x: number;
	y: number;
	/** Clockwise-positive (Konva convention); always 0 until P1-05. */
	rotationDeg: number;
	/** Dense integer ordered within the item's container (P1-06 uses it). */
	z: number;
}

/**
 * A user-defined pedal/supply (F7/P2-02), embedded in the scene
 * (`Scene.customPedals`) so it travels inline on share (A5). **Text-only** — no
 * image; it renders as the labeled rectangle at its cm footprint. `refId` is a
 * scene-local id (`custom-<uuid>`) that `PlacedItem.refId` resolves to.
 */
export interface CustomPedal {
	refId: string;
	brand: string;
	name: string;
	widthCm: number;
	heightCm: number;
	category: "pedal" | "supply";
	/** OUR effect taxonomy (a supply may have an empty list). */
	effectTypes: EffectType[];
	jacks?: Jack[];
	power?: Power;
}

/** The user-editable part of a custom pedal (the store assigns `refId`). */
export type CustomPedalDefinition = Omit<CustomPedal, "refId">;

/**
 * Z-order operation for an item within its container (F5/P1-06). `forward`/
 * `back` move one step; `front`/`bottom` jump to the top/bottom. There is no
 * global z — an item only competes with the others in its container (B1).
 */
export type ZDirection = "forward" | "back" | "front" | "bottom";

const BOARD_BY_ID = new Map<string, CatalogBoard>(
	catalog.boards.map((board) => [board.id, board]),
);

const PEDAL_BY_ID = new Map<string, CatalogPedal>(
	catalog.pedals.map((pedal) => [pedal.id, pedal]),
);

/** Used only when a board has neither a known ref nor a custom size. */
export const FALLBACK_BOARD_CM = { widthCm: 40, heightCm: 20 };

/** Used only when a pedal ref is unknown (custom pedals keep their own size). */
export const FALLBACK_PEDAL_CM = { widthCm: 7, heightCm: 12 };

/** How far a duplicate lands from its source (cm), so it's visibly offset. */
export const DUPLICATE_OFFSET_CM = 1.5;

/** Resolve a placed board's footprint in cm (catalog ref → custom → fallback). */
export function boardFootprint(board: PlacedBoard): {
	widthCm: number;
	heightCm: number;
} {
	if (board.customSize) return board.customSize;
	const definition = board.boardRefId
		? BOARD_BY_ID.get(board.boardRefId)
		: undefined;
	return definition
		? { widthCm: definition.widthCm, heightCm: definition.heightCm }
		: FALLBACK_BOARD_CM;
}

/** Resolve the catalog entry backing a placed board (null for custom boards). */
export function boardDefinition(board: PlacedBoard): CatalogBoard | null {
	return board.boardRefId ? (BOARD_BY_ID.get(board.boardRefId) ?? null) : null;
}

/**
 * The render-relevant data for a placed item, resolving `refId` against the
 * catalog first, then the scene's inline custom pedals (design.md §Data model /
 * A5). Unknown refs keep their geometry (fallback footprint) and show the refId
 * as the label so a scene never fails to render after the catalog changes.
 */
export interface ResolvedItem {
	name: string;
	widthCm: number;
	heightCm: number;
	/** Catalog definition (image contract applies), or null. */
	definition: CatalogPedal | null;
	/** Inline custom definition (text-only), or null. */
	custom: CustomPedal | null;
}

/** Resolve a placed item against the catalog + the scene's custom pedals. */
export function resolveItem(
	item: PlacedItem,
	customPedals: CustomPedal[] = [],
): ResolvedItem {
	const definition = PEDAL_BY_ID.get(item.refId) ?? null;
	if (definition) {
		return {
			name: definition.name,
			widthCm: definition.widthCm,
			heightCm: definition.heightCm,
			definition,
			custom: null,
		};
	}
	const custom =
		customPedals.find((candidate) => candidate.refId === item.refId) ?? null;
	if (custom) {
		return {
			name: custom.name,
			widthCm: custom.widthCm,
			heightCm: custom.heightCm,
			definition: null,
			custom,
		};
	}
	return {
		name: item.refId,
		...FALLBACK_PEDAL_CM,
		definition: null,
		custom: null,
	};
}

/** Resolve the catalog entry backing a placed item (null for custom/unknown). */
export function itemDefinition(
	item: PlacedItem,
	customPedals: CustomPedal[] = [],
): CatalogPedal | null {
	return resolveItem(item, customPedals).definition;
}

/** Resolve a placed item's footprint in cm (catalog → custom → fallback). */
export function itemFootprint(
	item: PlacedItem,
	customPedals: CustomPedal[] = [],
): {
	widthCm: number;
	heightCm: number;
} {
	const resolved = resolveItem(item, customPedals);
	return { widthCm: resolved.widthCm, heightCm: resolved.heightCm };
}

/**
 * Map an item's stored position to world cm. Attached items (boardUid set) are
 * stored in the board's unrotated frame, so this applies the board transform
 * (`boardToWorld`); loose items are already world cm. Items whose board is gone
 * fall back to treating their position as world (never throws).
 */
export function itemWorldOrigin(
	item: PlacedItem,
	boards: PlacedBoard[],
): Point {
	if (!item.boardUid) return { x: item.x, y: item.y };
	const board = boards.find((candidate) => candidate.uid === item.boardUid);
	if (!board) return { x: item.x, y: item.y };
	return boardToWorld({ x: item.x, y: item.y }, board);
}

/**
 * The topmost board whose rotated footprint contains `worldPoint` (world cm),
 * or null. Later boards render on top, so the search runs back-to-front. The
 * hit-test converts the point into each board's unrotated frame with
 * `worldToBoard`, so it is correct for any board rotation.
 */
export function findBoardAt(
	boards: PlacedBoard[],
	worldPoint: Point,
): PlacedBoard | null {
	for (let index = boards.length - 1; index >= 0; index--) {
		const board = boards[index];
		const local = worldToBoard(worldPoint, board);
		const footprint = boardFootprint(board);
		if (
			local.x >= 0 &&
			local.x <= footprint.widthCm &&
			local.y >= 0 &&
			local.y <= footprint.heightCm
		) {
			return board;
		}
	}
	return null;
}

/**
 * The item's **visible** rotation in world degrees: its own rotation plus its
 * board's, composed. This is what the pedal actually looks like on screen, and
 * it is the value the DragLayer renders while the item is lifted (so lifting a
 * pedal off a rotated board does NOT snap it back to the canvas orientation).
 */
export function itemVisualRotationDeg(
	item: PlacedItem,
	boards: PlacedBoard[],
): number {
	if (!item.boardUid) return normalizeDegrees(item.rotationDeg);
	const board = boards.find((candidate) => candidate.uid === item.boardUid);
	return normalizeDegrees((board?.rotationDeg ?? 0) + item.rotationDeg);
}

/**
 * The world-cm grab offset — the vector from the item's world origin to the
 * pointer at press. The lifted item renders in the world frame with its
 * **composed** rotation (`itemVisualRotationDeg`), so keeping the grabbed point
 * under the pointer requires a world-frame offset (not a board-local one): the
 * lifted origin that tracks the pointer is `pointerWorld − this`. Works for
 * board-attached and loose items alike.
 */
export function pointerGrabOffset(
	item: PlacedItem,
	boards: PlacedBoard[],
	pointerWorld: Point,
): Point {
	const origin = itemWorldOrigin(item, boards);
	return { x: pointerWorld.x - origin.x, y: pointerWorld.y - origin.y };
}

/**
 * Wrap an angle to [0, 360). Stored rotations are always normalised so a long
 * rotation drag can't accumulate unbounded degrees (and A4 save/load stays
 * canonical). Non-finite → 0; `-0` → `0`.
 */
export function normalizeDegrees(deg: number): number {
	if (!Number.isFinite(deg)) return 0;
	const wrapped = ((deg % 360) + 360) % 360;
	return wrapped === 0 ? 0 : wrapped;
}

/**
 * Rotate an item to `rotationDeg` **about its own centre**, returning the new
 * board-relative (or world) origin so the footprint spins in place. The frame
 * cancels: the item's `rotationDeg` is relative to its parent frame, so the
 * same math is correct for a loose item and for one on a rotated board. The
 * result rotation is normalised to [0, 360).
 */
export function rotateItemAboutCenter(
	item: PlacedItem,
	rotationDeg: number,
	customPedals: CustomPedal[] = [],
): { x: number; y: number; rotationDeg: number } {
	const { widthCm, heightCm } = itemFootprint(item, customPedals);
	const origin: Point = { x: 0, y: 0 };
	const half: Point = { x: widthCm / 2, y: heightCm / 2 };
	// The footprint's true centre is origin + R(θ)·half — NOT origin + half once
	// the item is rotated. Keeping that centre fixed means the new origin is
	// `centre − R(θ')·half`. (Rotating about the unrotated centre would translate
	// an already-rotated item on every press after the first.)
	const currentHalf = rotatePoint(half, origin, item.rotationDeg);
	const centre = { x: item.x + currentHalf.x, y: item.y + currentHalf.y };
	const nextRotationDeg = normalizeDegrees(rotationDeg);
	const nextHalf = rotatePoint(half, origin, nextRotationDeg);
	return {
		x: centre.x - nextHalf.x,
		y: centre.y - nextHalf.y,
		rotationDeg: nextRotationDeg,
	};
}

/**
 * The item's four footprint corners in **world cm**, including its own rotation
 * (about its origin) and, for attached items, the board transform. Used by the
 * HTML action bar to anchor below the selection's real on-screen bounds under
 * any rotation (P1-05).
 */
export function itemWorldCorners(
	item: PlacedItem,
	boards: PlacedBoard[],
	customPedals: CustomPedal[] = [],
): Point[] {
	const { widthCm, heightCm } = itemFootprint(item, customPedals);
	const origin: Point = { x: 0, y: 0 };
	const corners: Point[] = [
		{ x: 0, y: 0 },
		{ x: widthCm, y: 0 },
		{ x: widthCm, y: heightCm },
		{ x: 0, y: heightCm },
	];
	const parent = corners.map((corner) => {
		const rotated = rotatePoint(corner, origin, item.rotationDeg);
		return { x: rotated.x + item.x, y: rotated.y + item.y };
	});
	if (!item.boardUid) return parent;
	const board = boards.find((candidate) => candidate.uid === item.boardUid);
	if (!board) return parent;
	return parent.map((point) => boardToWorld(point, board));
}

/** Sentinel grouping key for loose items (`boardUid === null`). */
const LOOSE_CONTAINER = "\u0000loose";

function containerKey(item: PlacedItem): string {
	return item.boardUid ?? LOOSE_CONTAINER;
}

function byAscendingZ(a: PlacedItem, b: PlacedItem): number {
	return a.z - b.z;
}

/** Items in ascending z (render order — later draws on top); stable on ties. */
export function itemsByZ(items: PlacedItem[]): PlacedItem[] {
	return [...items].sort(byAscendingZ);
}

/** Items sharing `item`'s container, in visual (z) order. */
export function containerItemsByZ(
	items: PlacedItem[],
	item: PlacedItem,
): PlacedItem[] {
	return itemsByZ(
		items.filter((candidate) => candidate.boardUid === item.boardUid),
	);
}

/**
 * Re-normalise one container's z to a dense 0..n-1 in visual order. The flat
 * items array order is preserved (only z values change); other containers are
 * untouched. Keeps z dense per container after removals/re-parents (B1).
 */
export function normalizeContainerZ(
	items: PlacedItem[],
	boardUid: string | null,
): PlacedItem[] {
	const key = boardUid ?? LOOSE_CONTAINER;
	const zByUid = new Map(
		items
			.filter((item) => containerKey(item) === key)
			.sort(byAscendingZ)
			.map((item, position) => [item.uid, position]),
	);
	return items.map((item) => {
		if (containerKey(item) !== key) return item;
		const next = zByUid.get(item.uid) ?? item.z;
		return next === item.z ? item : { ...item, z: next };
	});
}

/** Normalise every container's z to dense 0..n-1 (used when loading a scene). */
export function normalizeAllZ(items: PlacedItem[]): PlacedItem[] {
	let result = items;
	for (const key of new Set(items.map(containerKey))) {
		result = normalizeContainerZ(result, key === LOOSE_CONTAINER ? null : key);
	}
	return result;
}

/**
 * Re-order the selected item within its container (its board group, or the
 * loose group) and re-normalise that container's z to a dense 0..n-1 by visual
 * order. Other containers are untouched. A no-op when the item is already at
 * the requested extreme or `uid` is unknown.
 */
export function reorderItems(
	items: PlacedItem[],
	uid: string,
	direction: ZDirection,
): PlacedItem[] {
	const target = items.find((item) => item.uid === uid);
	if (!target) return items;
	const key = containerKey(target);
	const ordered = items
		.filter((item) => containerKey(item) === key)
		.sort(byAscendingZ);
	const index = ordered.findIndex((item) => item.uid === uid);
	if (index === -1) return items;
	// Remove the target, then re-insert it at the direction's slot. `forward`/
	// `back` clamp at the extremes, so an item already at the top/bottom stays
	// put; `front`/`bottom` always jump to the end/start.
	const without = ordered.filter((item) => item.uid !== uid);
	const insertAt =
		direction === "front"
			? without.length
			: direction === "bottom"
				? 0
				: direction === "forward"
					? Math.min(index + 1, without.length)
					: Math.max(index - 1, 0);
	without.splice(insertAt, 0, target);
	const zByUid = new Map(without.map((item, position) => [item.uid, position]));
	return items.map((item) =>
		containerKey(item) === key
			? { ...item, z: zByUid.get(item.uid) ?? item.z }
			: item,
	);
}

/** The next dense z within a container (board or loose). */
function nextZ(items: PlacedItem[], boardUid: string | null): number {
	let max = -1;
	for (const item of items) {
		if (item.boardUid !== boardUid) continue;
		if (item.z > max) max = item.z;
	}
	return max + 1;
}

interface SceneStore {
	boards: PlacedBoard[];
	items: PlacedItem[];
	/**
	 * User-defined pedals/supplies (F7/P2-02), inline in the scene so a shared
	 * scene renders them anywhere (A5). `PlacedItem.refId` may resolve here.
	 */
	customPedals: CustomPedal[];
	/**
	 * Register a user-defined pedal/supply (assigning a scene-local `refId`) and
	 * return that id, which `addItem` can then place like a catalog pedal.
	 */
	addCustomPedal: (definition: CustomPedalDefinition) => string;
	/**
	 * Add a catalog pedal/supply with its origin at `posCm` (parent frame:
	 * board-local when `boardUid` is set, world cm when loose), returning its uid.
	 */
	addItem: (
		refId: string,
		kind: PlacedItem["kind"],
		boardUid: string | null,
		posCm: Point,
	) => string;
	/** Clone an item, offset slightly, in the same container. Returns the new uid. */
	duplicateItem: (uid: string) => string | null;
	removeItem: (uid: string) => void;
	/**
	 * Move an item one step forward/back or to the front/bottom of its container
	 * (its board group, or the loose group), keeping `z` dense per container
	 * (F5/P1-06).
	 */
	reorder: (uid: string, direction: ZDirection) => void;
	/**
	 * Finish a drag: hit-test the item's visible world centre against the boards
	 * and move it to the topmost containing board (storing board-relative cm) or
	 * leave it loose (world cm). `worldOriginCm` is the item's origin in world cm
	 * and `worldRotationDeg` its **visible** rotation, both at drop time — the
	 * drop preserves that visible orientation (it stores `worldRotationDeg −
	 * board.rotationDeg` for an attached item, or `worldRotationDeg` loose), so a
	 * pedal no longer snaps when lifted onto/off a rotated board. All the move +
	 * re-parenting math lives here so it is unit-testable (the rotated-board case).
	 */
	dropItem: (
		uid: string,
		worldOriginCm: Point,
		worldRotationDeg: number,
	) => void;
	/**
	 * Set an item's absolute rotation (degrees), spinning it about its own
	 * centre so it stays put. Rotation is normalised to [0, 360) (P1-05).
	 */
	rotateItem: (uid: string, rotationDeg: number) => void;
	/**
	 * Commit a live Transformer transform: the item's origin in its parent frame
	 * (board-local cm when attached, world cm when loose) plus a rotation that is
	 * normalised to [0, 360) (P1-05).
	 */
	transformItem: (
		uid: string,
		xCm: number,
		yCm: number,
		rotationDeg: number,
	) => void;
	/**
	 * Add a catalog board centred on `centerCm` (world cm), returning its uid.
	 * Stored `x`/`y` is the board's origin (top-left), so the caller stays free
	 * of footprint math; see `viewportCenterCm` for the usual "drop at centre".
	 */
	addBoard: (boardRefId: string, centerCm: Point) => string;
	moveBoard: (uid: string, xCm: number, yCm: number) => void;
	rotateBoard: (uid: string, rotationDeg: number) => void;
	/** Remove a board; its attached items fall loose at their world positions. */
	removeBoard: (uid: string) => void;
}

/**
 * User scene state. Positions + sizes are cm in world coordinates (AGENTS.md
 * hard constraint); the renderer multiplies by PX_PER_CM × zoom at draw time.
 * Selection is deliberately *not* here — it is transient UI state
 * (`state/selection.ts`) and is not part of the scene document.
 */
export const useScene = create<SceneStore>((set) => ({
	boards: [],
	items: [],
	customPedals: [],
	addCustomPedal: (definition) => {
		const refId = `custom-${crypto.randomUUID()}`;
		set((state) => ({
			customPedals: [...state.customPedals, { ...definition, refId }],
		}));
		return refId;
	},
	addItem: (refId, kind, boardUid, posCm) => {
		const uid = crypto.randomUUID();
		set((state) => ({
			items: [
				...state.items,
				{
					uid,
					refId,
					kind,
					boardUid,
					x: posCm.x,
					y: posCm.y,
					rotationDeg: 0,
					z: nextZ(state.items, boardUid),
				},
			],
		}));
		return uid;
	},
	duplicateItem: (uid) => {
		let cloneUid: string | null = null;
		set((state) => {
			const source = state.items.find((item) => item.uid === uid);
			if (!source) return state;
			cloneUid = crypto.randomUUID();
			return {
				items: [
					...state.items,
					{
						...source,
						uid: cloneUid,
						x: source.x + DUPLICATE_OFFSET_CM,
						y: source.y + DUPLICATE_OFFSET_CM,
						z: nextZ(state.items, source.boardUid),
					},
				],
			};
		});
		return cloneUid;
	},
	removeItem: (uid) =>
		set((state) => {
			const item = state.items.find((candidate) => candidate.uid === uid);
			if (!item) return state;
			const remaining = state.items.filter(
				(candidate) => candidate.uid !== uid,
			);
			// Close the z gap the removal leaves behind (keep it dense per container).
			return { items: normalizeContainerZ(remaining, item.boardUid) };
		}),
	reorder: (uid, direction) =>
		set((state) => ({ items: reorderItems(state.items, uid, direction) })),
	dropItem: (uid, worldOriginCm, worldRotationDeg) =>
		set((state) => {
			const item = state.items.find((candidate) => candidate.uid === uid);
			if (!item) return state;
			const footprint = itemFootprint(item, state.customPedals);
			const half: Point = {
				x: footprint.widthCm / 2,
				y: footprint.heightCm / 2,
			};
			const visual = normalizeDegrees(worldRotationDeg);
			// The lifted item's visible centre is `origin + R(visibleRotation)·half`.
			const rotatedHalf = rotatePoint(half, { x: 0, y: 0 }, visual);
			const centre = {
				x: worldOriginCm.x + rotatedHalf.x,
				y: worldOriginCm.y + rotatedHalf.y,
			};
			const board = findBoardAt(state.boards, centre);
			let boardUid: string | null = null;
			let x = worldOriginCm.x;
			let y = worldOriginCm.y;
			let rotationDeg = visual;
			if (board) {
				// Preserve the visible orientation: store the rotation relative to the
				// destination board so the on-screen angle is unchanged on drop (and
				// future board rotations then add on top). The origin reproduces the
				// world centre in the board's unrotated frame.
				rotationDeg = normalizeDegrees(visual - board.rotationDeg);
				const localCentre = worldToBoard(centre, board);
				const localHalf = rotatePoint(half, { x: 0, y: 0 }, rotationDeg);
				boardUid = board.uid;
				x = localCentre.x - localHalf.x;
				y = localCentre.y - localHalf.y;
			}
			// A drop into a *different* container lands the item on top there (like a
			// fresh add) and closes the source container's z gap; within the same
			// container the item keeps its slot (a drag is not a re-order).
			const sameContainer = item.boardUid === boardUid;
			const z = sameContainer
				? item.z
				: nextZ(
						state.items.filter((candidate) => candidate.uid !== uid),
						boardUid,
					);
			let items = state.items.map((candidate) =>
				candidate.uid === uid
					? { ...candidate, boardUid, x, y, rotationDeg, z }
					: candidate,
			);
			if (!sameContainer) {
				items = normalizeContainerZ(items, item.boardUid);
			}
			return { items };
		}),
	rotateItem: (uid, rotationDeg) =>
		set((state) => ({
			items: state.items.map((item) =>
				item.uid === uid
					? {
							...item,
							...rotateItemAboutCenter(item, rotationDeg, state.customPedals),
						}
					: item,
			),
		})),
	transformItem: (uid, xCm, yCm, rotationDeg) =>
		set((state) => ({
			items: state.items.map((item) =>
				item.uid === uid
					? {
							...item,
							x: xCm,
							y: yCm,
							rotationDeg: normalizeDegrees(rotationDeg),
						}
					: item,
			),
		})),
	addBoard: (boardRefId, centerCm) => {
		const uid = crypto.randomUUID();
		const definition = BOARD_BY_ID.get(boardRefId);
		const widthCm = definition?.widthCm ?? FALLBACK_BOARD_CM.widthCm;
		const heightCm = definition?.heightCm ?? FALLBACK_BOARD_CM.heightCm;
		const board: PlacedBoard = {
			uid,
			boardRefId,
			x: centerCm.x - widthCm / 2,
			y: centerCm.y - heightCm / 2,
			rotationDeg: 0,
		};
		set((state) => ({ boards: [...state.boards, board] }));
		return uid;
	},
	moveBoard: (uid, xCm, yCm) =>
		set((state) => ({
			boards: state.boards.map((board) =>
				board.uid === uid ? { ...board, x: xCm, y: yCm } : board,
			),
		})),
	rotateBoard: (uid, rotationDeg) =>
		set((state) => ({
			boards: state.boards.map((board) =>
				board.uid === uid ? { ...board, rotationDeg } : board,
			),
		})),
	removeBoard: (uid) =>
		set((state) => {
			const board = state.boards.find((candidate) => candidate.uid === uid);
			if (!board) return state;
			// Keep the user's work: attached items fall loose preserving their
			// **visible** orientation and position. The loose renderer drops the
			// board transform, so bake the board rotation into the item (its own
			// rotation becomes the world rotation) and store its world origin —
			// otherwise the pedal visibly rotates by −board.rotationDeg on removal.
			const items = state.items.map((item) => {
				if (item.boardUid !== uid) return item;
				const worldOrigin = boardToWorld({ x: item.x, y: item.y }, board);
				return {
					...item,
					boardUid: null,
					x: worldOrigin.x,
					y: worldOrigin.y,
					rotationDeg: normalizeDegrees(board.rotationDeg + item.rotationDeg),
				};
			});
			return {
				boards: state.boards.filter((candidate) => candidate.uid !== uid),
				// The freed items now share the loose container's z; re-normalise it so
				// their board-relative z can't collide with existing loose items (B1).
				items: normalizeContainerZ(items, null),
			};
		}),
}));
