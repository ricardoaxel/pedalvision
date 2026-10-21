import { create } from "zustand";
import { catalog } from "../catalog/load";
import type {
	CatalogBoard,
	CatalogPedal,
	EffectType,
	Jack,
	JackEdge,
	Power,
} from "../catalog/schema";
import type { BoardTexture } from "../lib/boardTexture";
import {
	addItemRefusal,
	boardAddRefusal,
	duplicateRefusal,
	graphAddRefusal,
} from "../lib/capacity";
import {
	boardToWorld,
	type Point,
	rotatePoint,
	worldToBoard,
} from "../lib/geometry";
import { isReadOnly } from "./readOnly";

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
	/** Custom-board surface finish (P2-05) — only for `boardRefId: null`. */
	texture?: BoardTexture;
	/** Optional user label for a custom board (P2-05). */
	name?: string;
	/** Optional user brand for a custom board (P2-05). */
	brand?: string;
	/** World cm of the board's local origin (its unrotated top-left — the
	 * rotation pivot; see geometry.ts §BoardTransform). */
	x: number;
	y: number;
	/** Clockwise-positive (Konva convention), any angle. */
	rotationDeg: number;
}

/**
 * The user-editable definition of a custom board (P2-05). Unlike a custom
 * pedal, a board is never duplicated in v1, so its definition is stored
 * **inline on `PlacedBoard`** rather than in a separate scene table — no
 * shared-definition propagation is needed.
 */
export interface CustomBoardDefinition {
	widthCm: number;
	heightCm: number;
	texture: BoardTexture;
	name?: string;
	brand?: string;
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
 * A cable termination (design.md §Data model, F12/P4-01). Item ends name the
 * resolved item's jack by its **decimal index** into that item's `jacks` array
 * (catalog definition first, then the scene's inline custom definition). That
 * index is the only stable identifier the existing `{ kind, edge, pos }` jack
 * contract provides — jacks carry no id, and duplicate kinds are allowed.
 * Endpoint ends point at a scene `Endpoint` (amp / instrument).
 */
export type CableEnd =
	| { itemUid: string; jack: string }
	| { endpointUid: string };

/**
 * A cable between two terminations (design.md §Data model, F12/P4-01). Length is
 * computed at render time, never stored. Cables render above all pedals
 * (`CableLayer`) and are part of the persisted scene graph.
 */
export interface Cable {
	uid: string;
	from: CableEnd;
	to: CableEnd;
	/** Optional user-chosen color (P4-02 UI); absent = theme default. */
	color?: string;
}

/**
 * An amp / instrument cable termination on the canvas (design.md §Data model,
 * F12). Stored in **world cm** — loose, not attached to a board.
 */
export interface Endpoint {
	uid: string;
	kind: "amp" | "instrument";
	x: number;
	y: number;
}

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

/** Is this a user-defined custom board (no catalog ref)? */
export function isCustomBoard(board: PlacedBoard): boolean {
	return board.boardRefId === null;
}

/**
 * The board's four footprint corners in **world cm**, including its rotation
 * about its origin. Used by the HTML board action bar (P2-05) to anchor below
 * the board's real on-screen bounds under any rotation.
 */
export function boardWorldCorners(board: PlacedBoard): Point[] {
	const { widthCm, heightCm } = boardFootprint(board);
	return [
		{ x: 0, y: 0 },
		{ x: widthCm, y: 0 },
		{ x: widthCm, y: heightCm },
		{ x: 0, y: heightCm },
	].map((corner) => boardToWorld(corner, board));
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

/**
 * Documented fallback anchors for **catalog pedals that carry no jack data**
 * (owner decision 2026-10-21; the seed has zero `jacks`). This is an explicit
 * assumption — IN on the left edge midpoint, OUT on the right edge midpoint —
 * not manufacturer data. Custom pedals never get it (an empty jack list there is
 * deliberate), nor do supplies or unknown refs. The canvas renders fallback
 * ticks as hollow diamonds and labels them "assumed".
 */
export const FALLBACK_JACKS: readonly ResolvedJack[] = [
	{ kind: "in", edge: "left", pos: 0.5 },
	{ kind: "out", edge: "right", pos: 0.5 },
];

/**
 * A jack with its resolved position. Catalog data may omit `pos` when only the
 * edge/count is known (P5-01); `resolveJackLayout` fills those evenly along
 * their edge and marks them `approximate`, which the canvas draws as a hollow
 * tick (same visual language as the fallback anchors).
 */
export type ResolvedJack = Jack & { pos: number; approximate?: boolean };

/**
 * Resolve edge-only jacks into concrete anchor positions (P5-01). A source may
 * only confirm "2 jacks on top", so every jack with no `pos` is distributed
 * evenly across its own edge at `(n+1)/(count+1)`; exact positions are kept.
 * Deterministic and side-effect free. Returns the input array unchanged when
 * every jack already has a position (the common case).
 */
export function resolveJackLayout(jacks: Jack[]): ResolvedJack[] {
	if (jacks.every((jack) => jack.pos !== undefined)) {
		return jacks as ResolvedJack[];
	}
	const missingByEdge = new Map<JackEdge, number[]>();
	jacks.forEach((jack, index) => {
		if (jack.pos !== undefined) return;
		const list = missingByEdge.get(jack.edge);
		if (list) list.push(index);
		else missingByEdge.set(jack.edge, [index]);
	});
	const positions = new Map<number, number>();
	for (const indexes of missingByEdge.values()) {
		indexes.forEach((index, position) => {
			positions.set(index, (position + 1) / (indexes.length + 1));
		});
	}
	return jacks.map((jack, index) => {
		if (jack.pos !== undefined) return jack as ResolvedJack;
		return {
			...jack,
			pos: positions.get(index) ?? 0.5,
			approximate: true,
		};
	});
}

/**
 * The jacks an item exposes for cable attachment: the real definition first,
 * then the documented fallback pair for a catalog pedal with no jack data.
 * Persistence validation uses the same resolution, so a cable to a fallback
 * anchor survives save/load. Edge-only jacks get a resolved (approximate)
 * position here (P5-01).
 */
export function resolveItemJacks(
	item: PlacedItem,
	customPedals: CustomPedal[] = [],
): ResolvedJack[] {
	const resolved = resolveItem(item, customPedals);
	const real = resolved.definition?.jacks ?? resolved.custom?.jacks ?? [];
	if (real.length > 0) return resolveJackLayout(real);
	if (resolved.definition !== null && item.kind === "pedal") {
		return [...FALLBACK_JACKS];
	}
	return [];
}

/**
 * Are this item's jacks the documented fallback pair rather than real data?
 * The canvas uses this to draw nested hollow diamonds (an "assumed" anchor).
 */
export function usesFallbackJacks(
	item: PlacedItem,
	customPedals: CustomPedal[] = [],
): boolean {
	const resolved = resolveItem(item, customPedals);
	const real = resolved.definition?.jacks ?? resolved.custom?.jacks ?? [];
	return (
		real.length === 0 && resolved.definition !== null && item.kind === "pedal"
	);
}

/** Parse a cable's opaque jack reference into an array index, or null. */
export function jackIndex(ref: string): number | null {
	if (!/^(0|[1-9]\d*)$/.test(ref)) return null;
	const index = Number(ref);
	return Number.isSafeInteger(index) ? index : null;
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
 * Nudge attached items back inside a custom board after it is **shrunk**
 * (P2-05 edit). Only an axis that actually got smaller is clamped, so renaming,
 * retexturing, enlarging, or a deliberate overhang the user left on an unchanged
 * axis is never moved. Items keep their size and rotation; only their
 * board-local `x`/`y` change. A rotated item's true AABB is larger than its
 * unrotated footprint, so a residual overhang can still be flagged by the P2-03
 * space warning.
 */
export function clampItemsToBoard(
	items: PlacedItem[],
	boardUid: string,
	next: { widthCm: number; heightCm: number },
	previous: { widthCm: number; heightCm: number },
	customPedals: CustomPedal[] = [],
): PlacedItem[] {
	const shrinkX = next.widthCm < previous.widthCm;
	const shrinkY = next.heightCm < previous.heightCm;
	if (!shrinkX && !shrinkY) return items;
	return items.map((item) => {
		if (item.boardUid !== boardUid) return item;
		const size = itemFootprint(item, customPedals);
		const x = shrinkX
			? Math.min(Math.max(item.x, 0), Math.max(0, next.widthCm - size.widthCm))
			: item.x;
		const y = shrinkY
			? Math.min(
					Math.max(item.y, 0),
					Math.max(0, next.heightCm - size.heightCm),
				)
			: item.y;
		return x === item.x && y === item.y ? item : { ...item, x, y };
	});
}

/** The custom pedal with `refId`, or null. */
export function customPedalById(
	customPedals: CustomPedal[],
	refId: string,
): CustomPedal | null {
	return customPedals.find((candidate) => candidate.refId === refId) ?? null;
}

/**
 * Drop custom-pedal definitions that no remaining placed item references, so
 * deleting the last instance of a custom part doesn't leave its definition
 * (jacks + power) accumulating in the scene/persistence forever.
 */
export function pruneCustomPedals(
	customPedals: CustomPedal[],
	items: PlacedItem[],
): CustomPedal[] {
	const referenced = new Set(items.map((item) => item.refId));
	return customPedals.filter((custom) => referenced.has(custom.refId));
}

/** Do two cable ends name the same termination? */
export function sameCableEnd(a: CableEnd, b: CableEnd): boolean {
	if ("endpointUid" in a && "endpointUid" in b) {
		return a.endpointUid === b.endpointUid;
	}
	if ("itemUid" in a && "itemUid" in b) {
		return a.itemUid === b.itemUid && jackIndex(a.jack) === jackIndex(b.jack);
	}
	return false;
}

/** Does a cable end reference `itemUid` (regardless of its jack index)? */
export function cableReferencesItem(cable: Cable, itemUid: string): boolean {
	return (
		("itemUid" in cable.from && cable.from.itemUid === itemUid) ||
		("itemUid" in cable.to && cable.to.itemUid === itemUid)
	);
}

/** Does a cable end reference `endpointUid`? */
export function cableReferencesEndpoint(
	cable: Cable,
	endpointUid: string,
): boolean {
	return (
		("endpointUid" in cable.from && cable.from.endpointUid === endpointUid) ||
		("endpointUid" in cable.to && cable.to.endpointUid === endpointUid)
	);
}

/**
 * Is this cable end resolvable against the scene graph? Item ends must name an
 * existing placed item **and** a jack index that item still exposes (a custom
 * part's jacks can be edited after a cable exists); endpoint ends must name an
 * existing endpoint. An unresolvable jack would render an invisible cable that
 * still occupies the graph budget, so it is rejected/normalised away.
 */
export function cableEndExists(
	end: CableEnd,
	items: readonly PlacedItem[],
	endpoints: readonly Endpoint[],
	customPedals: CustomPedal[] = [],
): boolean {
	if ("endpointUid" in end) {
		return endpoints.some((endpoint) => endpoint.uid === end.endpointUid);
	}
	const item = items.find((candidate) => candidate.uid === end.itemUid);
	if (!item) return false;
	const index = jackIndex(end.jack);
	return (
		index !== null && resolveItemJacks(item, customPedals)[index] !== undefined
	);
}

/** Signal role of a jack / endpoint (P4-02 direction normalization). */
export type CableEndRole = "source" | "sink" | "neutral";

const SOURCE_JACKS = new Set(["out", "send", "exp-out"]);
const SINK_JACKS = new Set(["in", "return", "exp-in"]);

/** Which way signal flows through a cable end, or null for an unknown end. */
export function cableEndRole(
	end: CableEnd,
	items: readonly PlacedItem[],
	endpoints: readonly Endpoint[],
	customPedals: CustomPedal[] = [],
): CableEndRole | null {
	if ("endpointUid" in end) {
		const endpoint = endpoints.find((entry) => entry.uid === end.endpointUid);
		if (!endpoint) return null;
		return endpoint.kind === "instrument" ? "source" : "sink";
	}
	const item = items.find((entry) => entry.uid === end.itemUid);
	const index = jackIndex(end.jack);
	if (!item || index === null) return null;
	const jack = resolveItemJacks(item, customPedals)[index];
	if (!jack) return null;
	if (SOURCE_JACKS.has(jack.kind)) return "source";
	if (SINK_JACKS.has(jack.kind)) return "sink";
	return "neutral";
}

export interface NormalizedCableDirection {
	from: CableEnd;
	to: CableEnd;
	valid: boolean;
}

/**
 * Orient a cable by **signal semantics**, not drag order: OUT/SEND/EXP-OUT and
 * the instrument endpoint are sources; IN/RETURN/EXP-IN and the amp endpoint are
 * sinks. Dragging backwards (or amp → pedal) yields the same arrow direction;
 * source↔source and sink↔sink pairs are refused. Neutral jacks (MIDI/CTRL/EXP/
 * POWER) keep the gesture order.
 */
export function normalizeCableDirection(
	from: CableEnd,
	to: CableEnd,
	scene: {
		items: readonly PlacedItem[];
		endpoints: readonly Endpoint[];
		customPedals?: CustomPedal[];
	},
): NormalizedCableDirection {
	const a = cableEndRole(
		from,
		scene.items,
		scene.endpoints,
		scene.customPedals,
	);
	const b = cableEndRole(to, scene.items, scene.endpoints, scene.customPedals);
	if (!a || !b || sameCableEnd(from, to)) {
		return { from, to, valid: false };
	}
	if (a === "source" && b === "sink") return { from, to, valid: true };
	if (a === "sink" && b === "source")
		return { from: to, to: from, valid: true };
	if (a === "neutral" || b === "neutral") return { from, to, valid: true };
	// source → source or sink → sink.
	return { from, to, valid: false };
}

/** How many cables one socket accepts: mono = 1, stereo/TRS = 2. */
export function jackCapacity(jack: Jack): number {
	return jack.stereo === true ? 2 : 1;
}

/** Does this cable end terminate on `itemUid`'s jack index? */
export function cableEndUsesItemJack(
	end: CableEnd,
	itemUid: string,
	index: number,
): boolean {
	return (
		"itemUid" in end && end.itemUid === itemUid && jackIndex(end.jack) === index
	);
}

/**
 * Can this jack/endpoint accept one more cable? A mono jack and an endpoint
 * accept one cable; a stereo/TRS jack accepts two (P4-02 bug fix: two cables on
 * the same mono output were previously allowed because only the identical pair
 * was rejected). `cables` is the current/partially-accepted list, so this also
 * powers load normalisation.
 */
export function cableEndHasCapacity(
	end: CableEnd,
	cables: readonly Cable[],
	items: readonly PlacedItem[],
	endpoints: readonly Endpoint[],
	customPedals: CustomPedal[] = [],
): boolean {
	if ("endpointUid" in end) {
		if (!endpoints.some((endpoint) => endpoint.uid === end.endpointUid)) {
			return false;
		}
		const used = cables.filter((cable) =>
			cableReferencesEndpoint(cable, end.endpointUid),
		).length;
		return used < 1;
	}
	const item = items.find((candidate) => candidate.uid === end.itemUid);
	if (!item) return false;
	const index = jackIndex(end.jack);
	if (index === null) return false;
	const jack = resolveItemJacks(item, customPedals)[index];
	if (!jack) return false;
	const used = cables.filter(
		(cable) =>
			cableEndUsesItemJack(cable.from, item.uid, index) ||
			cableEndUsesItemJack(cable.to, item.uid, index),
	).length;
	return used < jackCapacity(jack);
}

/** Inline reason when a cable end is already occupied (or full for stereo). */
export function cableEndCapacityNotice(
	end: CableEnd,
	items: readonly PlacedItem[],
	customPedals: CustomPedal[] = [],
): string {
	if ("endpointUid" in end) return "That endpoint is already connected.";
	const item = items.find((candidate) => candidate.uid === end.itemUid);
	const index = jackIndex(end.jack);
	const jack =
		item && index !== null
			? resolveItemJacks(item, customPedals)[index]
			: undefined;
	if (jack?.stereo === true) return "This TRS jack already has two cables.";
	const editable = customPedals.some((custom) => custom.refId === item?.refId);
	return editable
		? "That jack is already connected. A TRS jack can take two cables."
		: "That jack is already connected.";
}

/**
 * Drop cables whose ends no longer resolve and endpoints orphaned by those
 * dropped cables. A standalone endpoint (no stored cable referenced it) is a
 * placed object and survives. Shared by load normalisation and custom-part
 * edits so the two paths can never drift (P4 extension contract).
 */
export function pruneCableGraph(
	cables: Cable[],
	endpoints: Endpoint[],
	items: PlacedItem[],
	customPedals: CustomPedal[] = [],
): { cables: Cable[]; endpoints: Endpoint[] } {
	const resolvable = cables.filter(
		(cable) =>
			cableEndExists(cable.from, items, endpoints, customPedals) &&
			cableEndExists(cable.to, items, endpoints, customPedals),
	);
	// One physical cable per jack pair (unordered), so a hand-edited/shared
	// document can never hold a state the live UI refuses to create.
	const seenPairs = new Set<string>();
	const deduped = resolvable.filter((cable) => {
		const pair = [
			cableEndKeyForPair(cable.from),
			cableEndKeyForPair(cable.to),
		].sort();
		const key = pair.join("|");
		if (seenPairs.has(key)) return false;
		seenPairs.add(key);
		return true;
	});
	// Enforce per-socket capacity in document order: mono = 1, stereo/TRS = 2,
	// endpoint = 1. Keep the first cable(s) and drop the excess.
	const kept: Cable[] = [];
	for (const cable of deduped) {
		if (sameCableEnd(cable.from, cable.to)) continue;
		if (
			!cableEndHasCapacity(cable.from, kept, items, endpoints, customPedals) ||
			!cableEndHasCapacity(cable.to, kept, items, endpoints, customPedals)
		) {
			continue;
		}
		const direction = normalizeCableDirection(cable.from, cable.to, {
			items,
			endpoints,
			customPedals,
		});
		if (!direction.valid) continue;
		kept.push({ ...cable, from: direction.from, to: direction.to });
	}
	const resolvableUids = new Set(resolvable.map((cable) => cable.uid));
	const brokenCables = cables.filter((cable) => !resolvableUids.has(cable.uid));
	// Only cables dropped because their **refs** were gone orphan an endpoint.
	// Duplicate/capacity drops leave the endpoint as a placed object (A4).
	const brokenRefs = endpointRefs(brokenCables);
	const after = endpointRefs(kept);
	return {
		cables: kept,
		endpoints: endpoints.filter(
			(endpoint) => !brokenRefs.has(endpoint.uid) || after.has(endpoint.uid),
		),
	};
}

/** A stable key for one cable end, used to dedupe unordered pairs. */
export function cableEndKeyForPair(end: CableEnd): string {
	return "endpointUid" in end
		? `endpoint:${end.endpointUid}`
		: `item:${end.itemUid}:${jackIndex(end.jack) ?? -1}`;
}

/** The endpoint uids any of these cables terminate on. */
export function endpointRefs(cables: readonly Cable[]): Set<string> {
	const refs = new Set<string>();
	for (const cable of cables) {
		for (const end of [cable.from, cable.to]) {
			if ("endpointUid" in end) refs.add(end.endpointUid);
		}
	}
	return refs;
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
	 * Amp / instrument cable terminations (F12/P4-01), in world cm. Endpoints are
	 * persisted with the scene and travel inline in the document/backup.
	 */
	endpoints: Endpoint[];
	/** Cables between item jacks and/or endpoints (F12/P4-01). */
	cables: Cable[];
	/**
	 * Place an amp/instrument endpoint at `posCm` (world cm). Returns its uid, or
	 * null when the shared cable+endpoint graph cap refuses the add (P3-06).
	 */
	addEndpoint: (kind: Endpoint["kind"], posCm: Point) => string | null;
	moveEndpoint: (uid: string, posCm: Point) => void;
	/** Remove an endpoint and every cable that terminates on it. */
	removeEndpoint: (uid: string) => void;
	/**
	 * Add a cable between two resolved terminations, returning its uid — or null
	 * when the graph cap refuses it or an end names a gone item/endpoint.
	 */
	addCable: (from: CableEnd, to: CableEnd) => string | null;
	removeCable: (uid: string) => void;
	/**
	 * Register a user-defined pedal/supply (assigning a scene-local `refId`) and
	 * return that id, which `addItem` can then place like a catalog pedal.
	 * Returns null in read-only share mode.
	 */
	addCustomPedal: (definition: CustomPedalDefinition) => string | null;
	/**
	 * Replace a custom part's definition in place (P2-02 edit). Every placed item
	 * that references `refId` re-resolves to the new name/footprint — items never
	 * move, only the definition changes.
	 */
	updateCustomPedal: (refId: string, definition: CustomPedalDefinition) => void;
	/**
	 * Add a catalog pedal/supply with its origin at `posCm` (parent frame:
	 * board-local when `boardUid` is set, world cm when loose), returning its uid
	 * — or null when a hard capacity cap refuses the add (P3-06). The caller
	 * shows the inline reason from `src/lib/capacity.ts`.
	 */
	addItem: (
		refId: string,
		kind: PlacedItem["kind"],
		boardUid: string | null,
		posCm: Point,
	) => string | null;
	/**
	 * Clone an item, offset slightly, in the same container. Returns the new uid,
	 * or null when the item hard cap refuses the duplicate (P3-06).
	 */
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
	 * Add a catalog board centred on `centerCm` (world cm), returning its uid —
	 * or null when the board hard cap refuses the add (P3-06). Stored `x`/`y` is
	 * the board's origin (top-left), so the caller stays free of footprint math;
	 * see `viewportCenterCm` for the usual "drop at centre".
	 */
	addBoard: (boardRefId: string, centerCm: Point) => string | null;
	/**
	 * Add a user-defined custom board centred on `centerCm` (world cm),
	 * returning its uid (P2-05), or null at the board hard cap. The definition is
	 * stored inline on the board (`customSize` + `texture` + optional
	 * name/brand); `boardRefId` is null.
	 */
	addCustomBoard: (
		definition: CustomBoardDefinition,
		centerCm: Point,
	) => string | null;
	/** Replace a custom board's definition in place (P2-05 edit). */
	updateCustomBoard: (uid: string, definition: CustomBoardDefinition) => void;
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
export const useScene = create<SceneStore>((set, get) => ({
	boards: [],
	items: [],
	customPedals: [],
	endpoints: [],
	cables: [],
	addEndpoint: (kind, posCm) => {
		if (isReadOnly()) return null;
		if (graphAddRefusal(get())) return null;
		const uid = crypto.randomUUID();
		set((state) => ({
			endpoints: [...state.endpoints, { uid, kind, x: posCm.x, y: posCm.y }],
		}));
		return uid;
	},
	moveEndpoint: (uid, posCm) => {
		if (isReadOnly()) return;
		set((state) => ({
			endpoints: state.endpoints.map((endpoint) =>
				endpoint.uid === uid
					? { ...endpoint, x: posCm.x, y: posCm.y }
					: endpoint,
			),
		}));
	},
	removeEndpoint: (uid) => {
		if (isReadOnly()) return;
		set((state) => {
			if (!state.endpoints.some((endpoint) => endpoint.uid === uid)) {
				return state;
			}
			return {
				endpoints: state.endpoints.filter((endpoint) => endpoint.uid !== uid),
				cables: state.cables.filter(
					(cable) => !cableReferencesEndpoint(cable, uid),
				),
			};
		});
	},
	addCable: (from, to) => {
		if (isReadOnly()) return null;
		const state = get();
		if (
			!cableEndExists(from, state.items, state.endpoints, state.customPedals)
		) {
			return null;
		}
		if (!cableEndExists(to, state.items, state.endpoints, state.customPedals)) {
			return null;
		}
		// Orient by signal semantics so the arrow can never point into an output.
		const direction = normalizeCableDirection(from, to, state);
		if (!direction.valid) return null;
		const fromEnd = direction.from;
		const toEnd = direction.to;
		// One physical cable per jack pair: a repeated drag (or the reverse
		// direction) must not stack a duplicate that double-spends the graph.
		if (
			state.cables.some(
				(cable) =>
					(sameCableEnd(cable.from, fromEnd) &&
						sameCableEnd(cable.to, toEnd)) ||
					(sameCableEnd(cable.from, toEnd) && sameCableEnd(cable.to, fromEnd)),
			)
		) {
			return null;
		}
		// Mono jacks / endpoints accept one cable; stereo/TRS jacks accept two.
		if (
			!cableEndHasCapacity(
				fromEnd,
				state.cables,
				state.items,
				state.endpoints,
				state.customPedals,
			) ||
			!cableEndHasCapacity(
				toEnd,
				state.cables,
				state.items,
				state.endpoints,
				state.customPedals,
			)
		) {
			return null;
		}
		// Cables and endpoints share the 150/300 graph budget (P3-06).
		if (graphAddRefusal(state)) return null;
		const uid = crypto.randomUUID();
		set((current) => ({
			cables: [...current.cables, { uid, from: fromEnd, to: toEnd }],
		}));
		return uid;
	},
	removeCable: (uid) => {
		if (isReadOnly()) return;
		set((state) => ({
			cables: state.cables.filter((cable) => cable.uid !== uid),
		}));
	},
	addCustomPedal: (definition) => {
		if (isReadOnly()) return null;
		const refId = `custom-${crypto.randomUUID()}`;
		set((state) => ({
			customPedals: [...state.customPedals, { ...definition, refId }],
		}));
		return refId;
	},
	updateCustomPedal: (refId, definition) => {
		if (isReadOnly()) return;
		set((state) => {
			const customPedals = state.customPedals.map((candidate) =>
				candidate.refId === refId ? { ...definition, refId } : candidate,
			);
			// A jack edit can invalidate an existing cable (its stored index no
			// longer resolves) or strand an endpoint. Prune immediately rather
			// than leaving an invisible cable in memory until the next load.
			const graph = pruneCableGraph(
				state.cables,
				state.endpoints,
				state.items,
				customPedals,
			);
			return {
				customPedals,
				cables: graph.cables,
				endpoints: graph.endpoints,
			};
		});
	},
	addItem: (refId, kind, boardUid, posCm) => {
		if (isReadOnly()) return null;
		// Hard capacity cap (P3-06): refuse with an inline reason at the caller.
		// A recovered/shared over-cap scene still loads — only adding is guarded.
		if (addItemRefusal(get(), refId)) return null;
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
		if (isReadOnly()) return null;
		if (duplicateRefusal(get())) return null;
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
	removeItem: (uid) => {
		if (isReadOnly()) return;
		set((state) => {
			const item = state.items.find((candidate) => candidate.uid === uid);
			if (!item) return state;
			const remaining = state.items.filter(
				(candidate) => candidate.uid !== uid,
			);
			// Close the z gap the removal leaves behind (keep it dense per
			// container), drop any custom definition left unreferenced, and drop
			// every cable that terminated on the removed item (P4-01).
			return {
				items: normalizeContainerZ(remaining, item.boardUid),
				customPedals: pruneCustomPedals(state.customPedals, remaining),
				cables: state.cables.filter(
					(cable) => !cableReferencesItem(cable, uid),
				),
			};
		});
	},
	reorder: (uid, direction) => {
		if (isReadOnly()) return;
		set((state) => ({ items: reorderItems(state.items, uid, direction) }));
	},
	dropItem: (uid, worldOriginCm, worldRotationDeg) => {
		if (isReadOnly()) return;
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
		});
	},
	rotateItem: (uid, rotationDeg) => {
		if (isReadOnly()) return;
		set((state) => ({
			items: state.items.map((item) =>
				item.uid === uid
					? {
							...item,
							...rotateItemAboutCenter(item, rotationDeg, state.customPedals),
						}
					: item,
			),
		}));
	},
	transformItem: (uid, xCm, yCm, rotationDeg) => {
		if (isReadOnly()) return;
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
		}));
	},
	addBoard: (boardRefId, centerCm) => {
		if (isReadOnly()) return null;
		if (boardAddRefusal(get())) return null;
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
	addCustomBoard: (definition, centerCm) => {
		if (isReadOnly()) return null;
		if (boardAddRefusal(get())) return null;
		const uid = crypto.randomUUID();
		const board: PlacedBoard = {
			uid,
			boardRefId: null,
			customSize: {
				widthCm: definition.widthCm,
				heightCm: definition.heightCm,
			},
			texture: definition.texture,
			name: definition.name,
			brand: definition.brand,
			x: centerCm.x - definition.widthCm / 2,
			y: centerCm.y - definition.heightCm / 2,
			rotationDeg: 0,
		};
		set((state) => ({ boards: [...state.boards, board] }));
		return uid;
	},
	updateCustomBoard: (uid, definition) => {
		if (isReadOnly()) return;
		set((state) => {
			const board = state.boards.find((candidate) => candidate.uid === uid);
			if (!board) return state;
			const previous = boardFootprint(board);
			const footprint = {
				widthCm: definition.widthCm,
				heightCm: definition.heightCm,
			};
			return {
				boards: state.boards.map((candidate) =>
					candidate.uid === uid
						? {
								...candidate,
								boardRefId: null,
								customSize: footprint,
								texture: definition.texture,
								name: definition.name,
								brand: definition.brand,
							}
						: candidate,
				),
				// A shrink must not strand attached pedals off the deck.
				items: clampItemsToBoard(
					state.items,
					uid,
					footprint,
					previous,
					state.customPedals,
				),
			};
		});
	},
	moveBoard: (uid, xCm, yCm) => {
		if (isReadOnly()) return;
		set((state) => ({
			boards: state.boards.map((board) =>
				board.uid === uid ? { ...board, x: xCm, y: yCm } : board,
			),
		}));
	},
	rotateBoard: (uid, rotationDeg) => {
		if (isReadOnly()) return;
		set((state) => ({
			boards: state.boards.map((board) =>
				board.uid === uid ? { ...board, rotationDeg } : board,
			),
		}));
	},
	removeBoard: (uid) => {
		if (isReadOnly()) return;
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
		});
	},
}));
