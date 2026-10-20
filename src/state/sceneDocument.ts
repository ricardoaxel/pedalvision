import { EFFECT_TYPES, JACK_EDGES, JACK_KINDS } from "../catalog/schema";
import { isBoardTexture } from "../lib/boardTexture";
import { MAX_BOARD_DIMENSION_CM } from "../lib/customBoard";
import type { CustomPedal, PlacedBoard, PlacedItem } from "./scene";
import { normalizeAllZ, pruneCustomPedals } from "./scene";

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
	updatedAt: string;
}

/** The persisted scene fields (the scene store's user-editable subset). */
export interface SceneSnapshot {
	boards: PlacedBoard[];
	items: PlacedItem[];
	customPedals: CustomPedal[];
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
	// `customPedals` is additive — older documents without it are valid.
	const customPedals = Array.isArray(value.customPedals)
		? value.customPedals.filter(isCustomPedal)
		: [];
	return {
		id: value.id,
		version: SCENE_DOCUMENT_VERSION,
		name: value.name,
		boards: value.boards.filter(isPlacedBoard),
		items: value.items.filter(isPlacedItem),
		customPedals,
		updatedAt: value.updatedAt,
	};
}

/**
 * Normalise a document's scene content before it reaches the store: items whose
 * owning board is gone are dropped (their board-relative position can't be
 * resolved, and they would render in neither layer), every container's z is
 * re-normalised dense, and custom definitions left unreferenced are pruned.
 */
export function normalizeSceneContent(snapshot: SceneSnapshot): SceneSnapshot {
	const boardIds = new Set(snapshot.boards.map((board) => board.uid));
	const items = normalizeAllZ(
		snapshot.items.filter(
			(item) => item.boardUid === null || boardIds.has(item.boardUid),
		),
	);
	return {
		boards: snapshot.boards,
		items,
		customPedals: pruneCustomPedals(snapshot.customPedals, items),
	};
}

/** The normalised scene fields to apply to the store for a document. */
export function sceneFromDocument(document: SceneDocument): SceneSnapshot {
	return normalizeSceneContent({
		boards: document.boards,
		items: document.items,
		customPedals: document.customPedals,
	});
}
