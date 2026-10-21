import { EFFECT_TYPES, JACK_EDGES, JACK_KINDS } from "../catalog/schema";
import { isBoardTexture } from "../lib/boardTexture";
import { MAX_BOARD_DIMENSION_CM } from "../lib/customBoard";
import type {
	Cable,
	CableEnd,
	CustomPedal,
	Endpoint,
	PlacedBoard,
	PlacedItem,
} from "./scene";
import { normalizeAllZ, pruneCableGraph, pruneCustomPedals } from "./scene";

/**
 * The v1 scene document stored in IndexedDB (design.md §Data model /
 * §Persistence). `version` starts at 1; later additive fields (cables,
 * endpoints) extend the same version, exactly like `customPedals` was added to
 * the old localStorage snapshot in P2-02.
 */
export interface SceneDocument {
	id: string;
	version: 1;
	name: string;
	boards: PlacedBoard[];
	items: PlacedItem[];
	customPedals: CustomPedal[];
	endpoints: Endpoint[];
	cables: Cable[];
	updatedAt: string;
}

/** The persisted scene fields (the scene store's user-editable subset). */
export interface SceneSnapshot {
	boards: PlacedBoard[];
	items: PlacedItem[];
	customPedals: CustomPedal[];
	endpoints: Endpoint[];
	cables: Cable[];
}

/** What a document needs when it is created/replaced from the live store. */
export interface SceneDocumentSource extends SceneSnapshot {
	id: string;
	name: string;
	updatedAt: string;
}

export const SCENE_DOCUMENT_VERSION = 1;

/** Build a well-formed document from the live scene fields. */
export function createSceneDocument(
	source: SceneDocumentSource,
): SceneDocument {
	return {
		id: source.id,
		version: SCENE_DOCUMENT_VERSION,
		name: source.name,
		boards: source.boards,
		items: source.items,
		customPedals: source.customPedals,
		endpoints: source.endpoints,
		cables: source.cables,
		updatedAt: source.updatedAt,
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
	return typeof value === "number" && Number.isFinite(value);
}

function isSize(value: unknown): boolean {
	return (
		isRecord(value) &&
		isFiniteNumber(value.widthCm) &&
		value.widthCm > 0 &&
		value.widthCm <= MAX_BOARD_DIMENSION_CM &&
		isFiniteNumber(value.heightCm) &&
		value.heightCm > 0 &&
		value.heightCm <= MAX_BOARD_DIMENSION_CM
	);
}

/** Validate a placed board (catalog vs inline custom definition invariant). */
export function isPlacedBoard(value: unknown): value is PlacedBoard {
	if (!isRecord(value)) return false;
	if (typeof value.uid !== "string") return false;
	if (value.boardRefId !== null && typeof value.boardRefId !== "string") {
		return false;
	}
	// A custom board (no ref) MUST carry a bounded customSize; a catalog board
	// must NOT carry one (boardFootprint would stretch the catalog image).
	if (value.boardRefId === null) {
		if (!isSize(value.customSize)) return false;
	} else if (value.customSize !== undefined) {
		return false;
	}
	return (
		(value.texture === undefined || isBoardTexture(value.texture)) &&
		(value.name === undefined || typeof value.name === "string") &&
		(value.brand === undefined || typeof value.brand === "string") &&
		isFiniteNumber(value.x) &&
		isFiniteNumber(value.y) &&
		isFiniteNumber(value.rotationDeg)
	);
}

/** Validate a placed item. */
export function isPlacedItem(value: unknown): value is PlacedItem {
	return (
		isRecord(value) &&
		typeof value.uid === "string" &&
		typeof value.refId === "string" &&
		(value.kind === "pedal" || value.kind === "supply") &&
		(value.boardUid === null || typeof value.boardUid === "string") &&
		isFiniteNumber(value.x) &&
		isFiniteNumber(value.y) &&
		isFiniteNumber(value.rotationDeg) &&
		isFiniteNumber(value.z)
	);
}

function isJack(value: unknown): boolean {
	return (
		isRecord(value) &&
		typeof value.kind === "string" &&
		(JACK_KINDS as readonly string[]).includes(value.kind) &&
		typeof value.edge === "string" &&
		(JACK_EDGES as readonly string[]).includes(value.edge) &&
		isFiniteNumber(value.pos) &&
		value.pos >= 0 &&
		value.pos <= 1
	);
}

function isPower(value: unknown): boolean {
	return (
		isRecord(value) &&
		isFiniteNumber(value.voltage) &&
		(value.acDc === "DC" || value.acDc === "AC") &&
		isFiniteNumber(value.currentMa)
	);
}

/** Structural check so a corrupt inline custom pedal can't reach the renderer. */
export function isCustomPedal(value: unknown): value is CustomPedal {
	return (
		isRecord(value) &&
		typeof value.refId === "string" &&
		typeof value.brand === "string" &&
		typeof value.name === "string" &&
		isFiniteNumber(value.widthCm) &&
		value.widthCm > 0 &&
		isFiniteNumber(value.heightCm) &&
		value.heightCm > 0 &&
		(value.category === "pedal" || value.category === "supply") &&
		Array.isArray(value.effectTypes) &&
		value.effectTypes.every(
			(type) =>
				typeof type === "string" &&
				(EFFECT_TYPES as readonly string[]).includes(type),
		) &&
		(value.jacks === undefined ||
			(Array.isArray(value.jacks) && value.jacks.every(isJack))) &&
		(value.power === undefined || isPower(value.power))
	);
}

/** Validate a cable termination (exactly one of item+jack / endpoint). */
function isCableEnd(value: unknown): value is CableEnd {
	if (!isRecord(value)) return false;
	const endpoint =
		typeof value.endpointUid === "string" && value.endpointUid.length > 0;
	const item =
		typeof value.itemUid === "string" &&
		value.itemUid.length > 0 &&
		typeof value.jack === "string";
	return endpoint !== item;
}

/** Validate an amp/instrument endpoint (world cm). */
export function isEndpoint(value: unknown): value is Endpoint {
	return (
		isRecord(value) &&
		typeof value.uid === "string" &&
		value.uid.length > 0 &&
		(value.kind === "amp" || value.kind === "instrument") &&
		isFiniteNumber(value.x) &&
		isFiniteNumber(value.y)
	);
}

/** Validate a cable's structure (its references are checked on normalise). */
export function isCable(value: unknown): value is Cable {
	return (
		isRecord(value) &&
		typeof value.uid === "string" &&
		value.uid.length > 0 &&
		isCableEnd(value.from) &&
		isCableEnd(value.to) &&
		(value.color === undefined || typeof value.color === "string")
	);
}

/**
 * Parse a stored document (IDB returns an already-structured object; strings
 * are accepted for tests/legacy callers). Returns null for anything corrupt or
 * from an unknown version — never throws. Malformed entries are dropped rather
 * than failing the whole document, so one bad record can't blank the canvas.
 */
export function parseSceneDocument(raw: unknown): SceneDocument | null {
	let value: unknown = raw;
	if (typeof raw === "string") {
		try {
			value = JSON.parse(raw);
		} catch {
			return null;
		}
	}
	if (!isRecord(value) || value.version !== SCENE_DOCUMENT_VERSION) return null;
	if (typeof value.id !== "string" || value.id.length === 0) return null;
	if (typeof value.name !== "string") return null;
	if (typeof value.updatedAt !== "string") return null;
	if (!Array.isArray(value.boards) || !Array.isArray(value.items)) return null;
	// `customPedals`, `endpoints` and `cables` are additive — older documents
	// without them stay valid (the additive v1 rule).
	const customPedals = Array.isArray(value.customPedals)
		? value.customPedals.filter(isCustomPedal)
		: [];
	const endpoints = Array.isArray(value.endpoints)
		? value.endpoints.filter(isEndpoint)
		: [];
	const cables = Array.isArray(value.cables)
		? value.cables.filter(isCable)
		: [];
	return {
		id: value.id,
		version: SCENE_DOCUMENT_VERSION,
		name: value.name,
		boards: value.boards.filter(isPlacedBoard),
		items: value.items.filter(isPlacedItem),
		customPedals,
		endpoints,
		cables,
		updatedAt: value.updatedAt,
	};
}

/**
 * Normalise a document's scene content before it reaches the store: items whose
 * owning board is gone are dropped (their board-relative position can't be
 * resolved, and they would render in neither layer), every container's z is
 * re-normalised dense, custom definitions left unreferenced are pruned, cables
 * with a gone item/endpoint or an unresolvable jack are dropped, and endpoints
 * left dangling by those dropped cables are dropped too. A standalone endpoint
 * (one no stored cable references) is a placed object and is kept (A4).
 */
export function normalizeSceneContent(snapshot: SceneSnapshot): SceneSnapshot {
	const boardIds = new Set(snapshot.boards.map((board) => board.uid));
	const items = normalizeAllZ(
		snapshot.items.filter(
			(item) => item.boardUid === null || boardIds.has(item.boardUid),
		),
	);
	const customPedals = pruneCustomPedals(snapshot.customPedals, items);
	// An endpoint is dangling only when a cable in the stored document pointed
	// at it and that cable was dropped (its other end is gone / its jack no
	// longer resolves). An endpoint with no cable at all is a placed object and
	// must survive save → reload (A4) — P4-02's "place the amp, then connect"
	// flow depends on it.
	const graph = pruneCableGraph(
		snapshot.cables,
		snapshot.endpoints,
		items,
		customPedals,
	);
	return {
		boards: snapshot.boards,
		items,
		customPedals,
		endpoints: graph.endpoints,
		cables: graph.cables,
	};
}

/** The normalised scene fields to apply to the store for a document. */
export function sceneFromDocument(document: SceneDocument): SceneSnapshot {
	return normalizeSceneContent({
		boards: document.boards,
		items: document.items,
		customPedals: document.customPedals,
		endpoints: document.endpoints,
		cables: document.cables,
	});
}
