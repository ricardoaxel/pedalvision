import { catalog } from "../catalog/load";
import type { CatalogBoard, CatalogPedal } from "../catalog/schema";
import { ASSET_RENDITIONS, resolveImageUrl } from "./cdn";

/**
 * Capacity budgets (design.md §Capacity budgets, P3-06).
 *
 * v1 targets are **scene-wide totals across every placed object type** — boards,
 * items (catalog pedals, supplies, custom parts), cables and endpoints. Distinct
 * **image-bearing items** (not document bytes or raw item count) are the real
 * memory driver: every distinct decoded pedal image is ~1.44 MB, while repeated
 * items share the decode cache.
 *
 * Soft = inline advisory; hard = refusal with an inline reason. A stored scene
 * may legitimately exceed a hard cap (recovered/shared data); load must never
 * reject or trim it — only adding is guarded (AGENTS.md → hard constraints).
 */

export interface CapacityLimit {
	/** null when the dimension has no soft warning (scenes). */
	soft: number | null;
	hard: number;
}

/** Every budget in one place. Raise caps only after re-running the benchmark. */
export const CAPACITY = {
	items: { soft: 200, hard: 400 },
	distinctImages: { soft: 150, hard: 250 },
	boards: { soft: 8, hard: 10 },
	/** One endpoint ≈ one cable node, so both share this graph budget (P4). */
	graph: { soft: 150, hard: 300 },
	scenes: { soft: null, hard: 10 },
	export: {
		/** Soft advisory above ~12 MP or ~15 MB estimated (never a block). */
		softPixels: 12_000_000,
		softBytes: 15_000_000,
	},
} as const satisfies Record<string, unknown>;

export type CapacityLevel = "ok" | "soft" | "hard";

/** A measured dimension against its budget. */
export interface CapacityMeasure {
	value: number;
	soft: number | null;
	hard: number;
	level: CapacityLevel;
	/** True when a stored scene is already above the hard cap (load-only). */
	over: boolean;
}

export interface SceneObjectCounts {
	boards: number;
	/** Every placed item, including supplies and custom parts. */
	items: number;
	pedals: number;
	supplies: number;
	/** Placed items whose ref resolves to a scene-local custom definition. */
	customItems: number;
	/** Inline custom definitions (not a placed object; share-payload bytes). */
	customDefinitions: number;
	cables: number;
	endpoints: number;
	/** Cables + endpoints — the shared P4 graph budget. */
	graph: number;
}

/**
 * The minimal structural scene the capacity model needs. It is intentionally
 * wider than today's store (cables/endpoints are optional) so P4 adds them
 * without rewriting the counters.
 */
export interface CapacityScene {
	boards: readonly { boardRefId: string | null }[];
	items: readonly { refId: string; kind?: "pedal" | "supply" }[];
	customPedals?: readonly { refId: string }[];
	cables?: readonly unknown[];
	endpoints?: readonly unknown[];
}

export interface CapacityStatus {
	counts: SceneObjectCounts;
	/** Distinct catalog item images (custom/text-only parts are exempt). */
	distinctImages: number;
	items: CapacityMeasure;
	images: CapacityMeasure;
	boards: CapacityMeasure;
	graph: CapacityMeasure;
	/** Worst level across the scene-specific dimensions (scenes excluded). */
	level: CapacityLevel;
	/** The single most urgent inline line, or null at ok. */
	warning: string | null;
}

const PEDAL_BY_ID = new Map<string, CatalogPedal>(
	catalog.pedals.map((pedal) => [pedal.id, pedal]),
);

const BOARD_BY_ID = new Map<string, CatalogBoard>(
	catalog.boards.map((board) => [board.id, board]),
);

function customRefs(scene: CapacityScene): Set<string> {
	return new Set((scene.customPedals ?? []).map((custom) => custom.refId));
}

function measure(value: number, limit: CapacityLimit): CapacityMeasure {
	const level: CapacityLevel =
		value >= limit.hard
			? "hard"
			: limit.soft !== null && value >= limit.soft
				? "soft"
				: "ok";
	return {
		value,
		soft: limit.soft,
		hard: limit.hard,
		level,
		over: value > limit.hard,
	};
}

function worstLevel(levels: readonly CapacityLevel[]): CapacityLevel {
	if (levels.includes("hard")) return "hard";
	if (levels.includes("soft")) return "soft";
	return "ok";
}

/**
 * Count **every** scene array so the budgets stay correct when P4 adds cables
 * and endpoints. Supplies and custom parts count as items; custom definitions
 * are reported separately (they are share-payload bytes, not placed objects).
 */
export function sceneObjectCounts(scene: CapacityScene): SceneObjectCounts {
	const custom = customRefs(scene);
	let pedals = 0;
	let supplies = 0;
	let customItems = 0;
	for (const item of scene.items) {
		if (custom.has(item.refId)) customItems += 1;
		if (item.kind === "supply") supplies += 1;
		else pedals += 1;
	}
	const cables = scene.cables?.length ?? 0;
	const endpoints = scene.endpoints?.length ?? 0;
	return {
		boards: scene.boards.length,
		items: scene.items.length,
		pedals,
		supplies,
		customItems,
		customDefinitions: scene.customPedals?.length ?? 0,
		cables,
		endpoints,
		graph: cables + endpoints,
	};
}

/** The image URL a catalog item renders with (mock/static/url contract). */
function itemImageUrl(definition: CatalogPedal): string {
	return resolveImageUrl(
		definition.imageSource,
		definition.image,
		"pedal",
		ASSET_RENDITIONS.export,
	);
}

function boardImageUrl(definition: CatalogBoard): string {
	return resolveImageUrl(
		definition.imageSource,
		definition.image,
		"board",
		ASSET_RENDITIONS.export,
	);
}

/**
 * Distinct image URLs in the scene. Deduped by URL so repeated catalog items
 * share one decode. Custom (text-only) parts and unknown refs have no image and
 * are exempt. Boards are included only for export sizing (`includeBoards`), not
 * for the item-image budget.
 */
export function distinctImageUrls(
	scene: CapacityScene,
	includeBoards = false,
): string[] {
	const custom = customRefs(scene);
	const urls = new Set<string>();
	for (const item of scene.items) {
		if (custom.has(item.refId)) continue;
		const definition = PEDAL_BY_ID.get(item.refId);
		if (definition) urls.add(itemImageUrl(definition));
	}
	if (includeBoards) {
		for (const board of scene.boards) {
			if (!board.boardRefId) continue;
			const definition = BOARD_BY_ID.get(board.boardRefId);
			if (definition) urls.add(boardImageUrl(definition));
		}
	}
	return [...urls];
}

/** Distinct catalog item images (the scene-wide image budget). */
export function distinctImageCount(scene: CapacityScene): number {
	return distinctImageUrls(scene).length;
}

/** Does placing `refId` add a new distinct catalog image? */
export function addsDistinctImage(
	scene: CapacityScene,
	refId: string,
): boolean {
	if (customRefs(scene).has(refId)) return false;
	const definition = PEDAL_BY_ID.get(refId);
	if (!definition) return false;
	const url = itemImageUrl(definition);
	return !distinctImageUrls(scene).includes(url);
}

function softLine(
	kind: "items" | "images" | "boards" | "graph",
	measure: CapacityMeasure,
): string {
	// Show the hard cap as the denominator: "200 of 400" is approaching the
	// limit; using the soft threshold would falsely read as "at the limit".
	const denominator = measure.hard;
	switch (kind) {
		case "items":
			return `${measure.value} of ${denominator} parts — approaching the item limit.`;
		case "images":
			return `${measure.value} of ${denominator} images — approaching the image limit.`;
		case "boards":
			return `${measure.value} of ${denominator} boards — approaching the board limit.`;
		case "graph":
			return `${measure.value} of ${denominator} cables and endpoints — approaching the connection limit.`;
	}
}

function hardLine(
	kind: "items" | "images" | "boards" | "graph",
	measure: CapacityMeasure,
): string {
	switch (kind) {
		case "items":
			return measure.over
				? `Over capacity — ${measure.value} of ${measure.hard} parts. This scene still opens. Remove parts to add more.`
				: `${measure.value} of ${measure.hard} parts — at the item limit. Remove a part to add another.`;
		case "images":
			return measure.over
				? `Over capacity — ${measure.value} of ${measure.hard} images. This scene still opens. Remove parts to add more.`
				: `${measure.value} of ${measure.hard} images — at the image limit. Reusing an image already placed still works.`;
		case "boards":
			return measure.over
				? `Over capacity — ${measure.value} of ${measure.hard} boards. This scene still opens. Remove boards to add more.`
				: `${measure.value} of ${measure.hard} boards — at the board limit. Remove a board to add another.`;
		case "graph":
			return measure.over
				? `Over capacity — ${measure.value} of ${measure.hard} cables and endpoints. This scene still opens. Remove cables to add more.`
				: `${measure.value} of ${measure.hard} cables and endpoints — at the connection limit. Remove a cable to add another.`;
	}
}

/** Measure the live scene against every scene-wide budget. */
export function capacityStatus(scene: CapacityScene): CapacityStatus {
	const counts = sceneObjectCounts(scene);
	const items = measure(counts.items, CAPACITY.items);
	const images = measure(distinctImageCount(scene), CAPACITY.distinctImages);
	const boards = measure(counts.boards, CAPACITY.boards);
	const graph = measure(counts.graph, CAPACITY.graph);
	const level = worstLevel([
		items.level,
		images.level,
		boards.level,
		graph.level,
	]);

	const dimensions = [
		["items", items],
		["images", images],
		["boards", boards],
		["graph", graph],
	] as const;
	const hard = dimensions.find(([, value]) => value.level === "hard");
	const soft = dimensions.find(([, value]) => value.level === "soft");
	const mostUrgent = hard ?? soft;
	const warning = mostUrgent
		? mostUrgent[1].level === "hard"
			? hardLine(mostUrgent[0], mostUrgent[1])
			: softLine(mostUrgent[0], mostUrgent[1])
		: null;

	return {
		counts,
		distinctImages: images.value,
		items,
		images,
		boards,
		graph,
		level,
		warning,
	};
}

/**
 * Refusal for adding a placed item. Returns the user-facing inline reason, or
 * null when the add is allowed. Repeats of an image already in the scene are
 * allowed at the image cap — they add no decode.
 */
export function addItemRefusal(
	scene: CapacityScene,
	refId: string,
): string | null {
	const status = capacityStatus(scene);
	if (status.items.level === "hard") {
		return hardLine("items", status.items);
	}
	if (status.images.level === "hard" && addsDistinctImage(scene, refId)) {
		return hardLine("images", status.images);
	}
	return null;
}

/** Refusal for duplicating an item (same image, one more part). */
export function duplicateRefusal(scene: CapacityScene): string | null {
	const status = capacityStatus(scene);
	return status.items.level === "hard"
		? "Item limit reached. Remove a part to duplicate."
		: null;
}

/** Refusal for adding a catalog board. */
export function boardAddRefusal(scene: CapacityScene): string | null {
	const status = capacityStatus(scene);
	return status.boards.level === "hard"
		? hardLine("boards", status.boards)
		: null;
}

/**
 * Refusal for a new cable or endpoint (P4). Both share the graph budget, so
 * this is ready before cables reach the store.
 */
export function graphAddRefusal(scene: CapacityScene): string | null {
	const status = capacityStatus(scene);
	return status.graph.level === "hard" ? hardLine("graph", status.graph) : null;
}

/* ------------------------------------------------------------------------- */
/* Export estimate (soft-only; the 16.7 MP/8192 px clamp remains the hard cap) */
/* ------------------------------------------------------------------------- */

export type CapacityExportFormat = "png" | "pdf";

/**
 * Deliberately conservative bytes-per-output-pixel. Measured 16.7 MP PNGs were
 * 14.6–24.2 MB (0.87–1.44 B/px), so 0.9 is the low-end honest estimate; PDF
 * wraps a ~0.92-quality JPEG, typically ~0.3 B/px.
 */
const EXPORT_BYTES_PER_PIXEL: Record<CapacityExportFormat, number> = {
	png: 0.9,
	pdf: 0.3,
};

export interface ExportCapacity {
	pixels: number;
	megapixels: number;
	estimatedBytes: number;
	/** Inline soft warning, or null when the export is comfortably small. */
	warning: string | null;
}

function formatMegapixels(pixels: number): string {
	return `${(pixels / 1_000_000).toFixed(1)} MP`;
}

/** `about 18 MB` / `about 1.4 MB` / `about 640 KB`. */
export function formatEstimatedBytes(bytes: number): string {
	const mb = bytes / 1_000_000;
	if (mb >= 10) return `about ${Math.round(mb)} MB`;
	if (mb >= 1) return `about ${mb.toFixed(1)} MB`;
	return `about ${Math.max(1, Math.round(bytes / 1000))} KB`;
}

/** Estimate an export's decoded size + the soft-warning line (if any). */
export function exportCapacity(
	widthPx: number,
	heightPx: number,
	format: CapacityExportFormat,
): ExportCapacity {
	const pixels = Math.max(0, widthPx) * Math.max(0, heightPx);
	const estimatedBytes = Math.round(pixels * EXPORT_BYTES_PER_PIXEL[format]);
	const largePixels = pixels > CAPACITY.export.softPixels;
	const largeBytes = estimatedBytes > CAPACITY.export.softBytes;
	const size = formatEstimatedBytes(estimatedBytes);
	const mp = formatMegapixels(pixels);
	const warning = largePixels
		? largeBytes
			? `Large export — ${mp}, ${size}. Saving may be slow on phones.`
			: `Large export — ${mp}. Saving may be slow on phones.`
		: largeBytes
			? `Large export — ${size}. Saving may be slow on phones.`
			: null;
	return { pixels, megapixels: pixels / 1_000_000, estimatedBytes, warning };
}
