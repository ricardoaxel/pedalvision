import type { Jack } from "../catalog/schema";
import {
	type CableEnd,
	type CustomPedal,
	type Endpoint,
	itemFootprint,
	jackIndex,
	type PlacedBoard,
	type PlacedItem,
	resolveItemJacks,
	usesFallbackJacks,
} from "../state/scene";
import { boardToWorld, type Point, rotatePoint } from "./geometry";

/**
 * Jack-anchor resolution (F12/P4-01, design.md §Data model).
 *
 * A cable references an item jack by the **decimal index** into the item's
 * resolved `jacks` array (catalog definition first, then the scene's inline
 * custom definition). The anchor is derived from the existing
 * `{ kind, edge, pos }` contract: `pos` runs along the chosen edge (left→right
 * on the top/bottom edges, top→bottom on the left/right edges), the point is
 * rotated with the item about its origin, then the board transform is applied
 * when the item is board-attached. Everything is **world cm** — pixels exist
 * only at render time. Returns null for a gone item / invalid jack index.
 */

export { jackIndex, resolveItemJacks };

/** A resolved cable termination: world-cm point + the jack's outward normal. */
export interface AnchorPoint {
	point: Point;
	/** Unit vector pointing out of the pedal edge (world cm); null for endpoints. */
	normal: Point | null;
	/** The anchor is the documented fallback pair, not manufacturer data. */
	assumed: boolean;
	/** The jack this anchor belongs to (undefined for an endpoint). */
	jack?: Jack;
	/** World visual rotation of the owning item (jack-side handle orientation). */
	rotationDeg?: number;
}

/** A keyed anchor index for one scene mutation. */
export interface AnchorIndex {
	items: Map<string, AnchorPoint>;
	endpoints: Map<string, AnchorPoint>;
	/** Flat list for nearest-target hit-testing. */
	all: Array<
		AnchorPoint & {
			/** `item:<uid>:<index>` or `endpoint:<uid>`. */
			key: string;
			uid: string;
			jackIndex?: number;
		}
	>;
}

/**
 * The outward unit normal of a jack edge in the item's unrotated local frame.
 * `pos` runs along the edge, so this is the direction a cable should leave from.
 */
export function jackNormalLocal(edge: Jack["edge"]): Point {
	switch (edge) {
		case "top":
			return { x: 0, y: -1 };
		case "right":
			return { x: 1, y: 0 };
		case "bottom":
			return { x: 0, y: 1 };
		case "left":
			return { x: -1, y: 0 };
	}
}

function jackAnchorDetailed(
	item: PlacedItem,
	index: number,
	boards: PlacedBoard[],
	customPedals: CustomPedal[],
	assumed: boolean,
): AnchorPoint | null {
	const jacks = resolveItemJacks(item, customPedals);
	const jack = jacks[index];
	if (!jack) return null;
	const local = jackLocalPoint(jack, itemFootprint(item, customPedals));
	const rotated = rotatePoint(local, { x: 0, y: 0 }, item.rotationDeg);
	const normal = rotatePoint(
		jackNormalLocal(jack.edge),
		{ x: 0, y: 0 },
		item.rotationDeg,
	);
	const parent = { x: rotated.x + item.x, y: rotated.y + item.y };
	const board = item.boardUid
		? boards.find((candidate) => candidate.uid === item.boardUid)
		: undefined;
	const point = board ? boardToWorld(parent, board) : parent;
	const worldRotation = (board?.rotationDeg ?? 0) + item.rotationDeg;
	const worldNormal = board
		? rotatePoint(normal, { x: 0, y: 0 }, board.rotationDeg)
		: normal;
	return {
		point,
		normal: worldNormal,
		assumed,
		jack,
		rotationDeg: worldRotation,
	};
}

/**
 * Build the uid→anchor index for a scene mutation. Item anchors are keyed
 * `item:<uid>:<jackIndex>`; endpoints `endpoint:<uid>`. Callers memoize this via
 * {@link anchorIndexFor} (or `useMemo` on the scene arrays) and **never** resolve
 * anchors inside a render loop.
 */
export function buildAnchorIndex(scene: {
	boards: PlacedBoard[];
	items: PlacedItem[];
	customPedals: CustomPedal[];
	endpoints: Endpoint[];
}): AnchorIndex {
	const items = new Map<string, AnchorPoint>();
	const endpoints = new Map<string, AnchorPoint>();
	const all: AnchorIndex["all"] = [];
	for (const item of scene.items) {
		const jacks = resolveItemJacks(item, scene.customPedals);
		const assumed = usesFallbackJacks(item, scene.customPedals);
		for (let index = 0; index < jacks.length; index++) {
			const anchor = jackAnchorDetailed(
				item,
				index,
				scene.boards,
				scene.customPedals,
				assumed,
			);
			if (!anchor) continue;
			const key = `item:${item.uid}:${index}`;
			items.set(key, anchor);
			all.push({ ...anchor, key, uid: item.uid, jackIndex: index });
		}
	}
	for (const endpoint of scene.endpoints) {
		const anchor: AnchorPoint = {
			point: { x: endpoint.x, y: endpoint.y },
			normal: null,
			assumed: false,
		};
		const key = `endpoint:${endpoint.uid}`;
		endpoints.set(key, anchor);
		all.push({ ...anchor, key, uid: endpoint.uid });
	}
	return { items, endpoints, all };
}

/** Identity cache: scene arrays are copy-on-write, so identity = mutation. */
let cached: {
	boards: PlacedBoard[];
	items: PlacedItem[];
	customPedals: CustomPedal[];
	endpoints: Endpoint[];
	index: AnchorIndex;
} | null = null;

/**
 * Memoized anchor index for the current scene mutation. The scene store copies
 * arrays on every edit, so array identity is a safe invalidation key; repeated
 * calls inside one render/mutation share one index.
 */
export function anchorIndexFor(scene: {
	boards: PlacedBoard[];
	items: PlacedItem[];
	customPedals: CustomPedal[];
	endpoints: Endpoint[];
}): AnchorIndex {
	if (
		cached &&
		cached.boards === scene.boards &&
		cached.items === scene.items &&
		cached.customPedals === scene.customPedals &&
		cached.endpoints === scene.endpoints
	) {
		return cached.index;
	}
	const index = buildAnchorIndex(scene);
	cached = {
		boards: scene.boards,
		items: scene.items,
		customPedals: scene.customPedals,
		endpoints: scene.endpoints,
		index,
	};
	return index;
}

/** The key a cable end uses in the anchor index. */
export function cableEndKey(end: CableEnd): string {
	return "endpointUid" in end
		? `endpoint:${end.endpointUid}`
		: `item:${end.itemUid}:${jackIndex(end.jack) ?? -1}`;
}

/** The anchor for a cable end, or null when it no longer resolves. */
export function cableEndAnchorFromIndex(
	end: CableEnd,
	index: AnchorIndex,
): AnchorPoint | null {
	return (
		index.items.get(cableEndKey(end)) ??
		index.endpoints.get(cableEndKey(end)) ??
		null
	);
}

/**
 * The jack's point in the item's **unrotated local frame** (cm from the item's
 * origin). `pos` is clamped to 0..1 defensively; catalog validation already
 * guarantees it.
 */
export function jackLocalPoint(
	jack: Jack,
	footprint: { widthCm: number; heightCm: number },
): Point {
	const pos = Math.min(1, Math.max(0, jack.pos));
	switch (jack.edge) {
		case "top":
			return { x: pos * footprint.widthCm, y: 0 };
		case "right":
			return { x: footprint.widthCm, y: pos * footprint.heightCm };
		case "bottom":
			return { x: pos * footprint.widthCm, y: footprint.heightCm };
		case "left":
			return { x: 0, y: pos * footprint.heightCm };
	}
}

/**
 * The world-cm anchor of `end` — an item jack or an endpoint. Null when the
 * item/endpoint is gone or the jack index no longer resolves.
 */
export function cableEndAnchorWorld(
	end: CableEnd,
	scene: {
		boards: PlacedBoard[];
		items: PlacedItem[];
		customPedals: CustomPedal[];
		endpoints: Endpoint[];
	},
): Point | null {
	if ("endpointUid" in end) {
		const endpoint = scene.endpoints.find(
			(candidate) => candidate.uid === end.endpointUid,
		);
		return endpoint ? { x: endpoint.x, y: endpoint.y } : null;
	}
	const item = scene.items.find((candidate) => candidate.uid === end.itemUid);
	if (!item) return null;
	return jackAnchorWorld(item, end.jack, scene.boards, scene.customPedals);
}

/** The world-cm anchor of one jack on a placed item. */
export function jackAnchorWorld(
	item: PlacedItem,
	jackRef: string,
	boards: PlacedBoard[],
	customPedals: CustomPedal[] = [],
): Point | null {
	const index = jackIndex(jackRef);
	if (index === null) return null;
	const jack = resolveItemJacks(item, customPedals)[index];
	if (!jack) return null;
	const local = jackLocalPoint(jack, itemFootprint(item, customPedals));
	const rotated = rotatePoint(local, { x: 0, y: 0 }, item.rotationDeg);
	const parent = { x: rotated.x + item.x, y: rotated.y + item.y };
	if (!item.boardUid) return parent;
	const board = boards.find((candidate) => candidate.uid === item.boardUid);
	return board ? boardToWorld(parent, board) : parent;
}
