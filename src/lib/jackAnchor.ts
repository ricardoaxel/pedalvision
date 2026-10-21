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
