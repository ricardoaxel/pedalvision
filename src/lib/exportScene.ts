import {
	boardFootprint,
	type CustomPedal,
	itemWorldCorners,
	type PlacedBoard,
	type PlacedItem,
} from "../state/scene";
import { distinctImageUrls } from "./capacity";
import { boardToWorld, type Point, type RectCm } from "./geometry";

/**
 * Pure export model for P3-01 (design.md §Canvas architecture → Export).
 *
 * The export renderer draws from the **scene document**, never the live stage.
 * This module decides *what* is in scope, the rotation-aware world bounds, the
 * fit cap and the iOS-safe output size. It has no DOM/Konva dependency, so the
 * scope + pixel rules are unit-testable.
 */

/** Endpoints (amp/instrument) this close to a board join selected-board export. */
export const ENDPOINT_MARGIN_CM = 30;

/** Uniform margin around the exported content (cm). Holds the scale bar. */
export const EXPORT_PADDING_CM = 4;

/** Standard export density (the default, small-file mode). */
export const EXPORT_STANDARD_PX_PER_CM = 32;

/** HD export density: the maximum the iOS-safe pixel budget can provide. */
export const EXPORT_HD_PX_PER_CM = 64;

/**
 * Hard total-pixel budget. iOS 17 and older cap a canvas at 16,777,216 pixels
 * (dimensions may exceed 4096 as long as the area stays under it); iOS 18+
 * allows more, but we keep the conservative budget so export never blanks.
 */
export const EXPORT_MAX_PIXELS = 16_777_216;

/** Absolute per-edge safety cap (well above 4096; the area budget dominates). */
export const EXPORT_MAX_EDGE_PX = 8192;

/** Never rasterize above 2× regardless of content size. */
export const EXPORT_MAX_PIXEL_RATIO = 2;

/** Drafting scale bar lengths (cm). */
export const SCALE_BAR_LONG_CM = 10;
export const SCALE_BAR_SHORT_CM = 5;
export const SCALE_BAR_SHORT_BELOW_CM = 40;

/**
 * A cable termination in the export input. This mirrors `design.md` §Data model
 * so P4-01/P4-02 can wire the real cable store in without changing the export
 * scope rules.
 */
export interface ExportEndpoint {
	uid: string;
	kind: "amp" | "instrument";
	x: number;
	y: number;
}

export type ExportCableEnd =
	| { itemUid: string; jack: string }
	| { endpointUid: string };

export interface ExportCable {
	uid: string;
	from: ExportCableEnd;
	to: ExportCableEnd;
	color?: string;
}

export interface ExportSceneInput {
	boards: PlacedBoard[];
	items: PlacedItem[];
	customPedals: CustomPedal[];
	endpoints?: ExportEndpoint[];
	cables?: ExportCable[];
}

export type ExportScope = "board" | "all";

/** Downloadable artifact formats (P3-01). */
export type ExportFormat = "png" | "pdf";

/** Export quality modes: Standard is the default; HD uses the full safe budget. */
export type ExportQuality = "standard" | "hd";

export interface ExportPlan {
	scope: ExportScope;
	boards: PlacedBoard[];
	items: PlacedItem[];
	customPedals: CustomPedal[];
	endpoints: ExportEndpoint[];
	cables: ExportCable[];
	/** World-cm bounds **including** the uniform export margin. */
	boundsCm: RectCm;
	/** Content bounds before the margin (scale bar positioning). */
	contentBoundsCm: RectCm;
	/** Stage pixels at fit scale (before `pixelRatio`). */
	stageWidthPx: number;
	stageHeightPx: number;
	/** Effective rasterization ratio (≤2, reduced by the clamp). */
	pixelRatio: number;
	/** Final PNG pixels. */
	outputWidthPx: number;
	outputHeightPx: number;
	/** Uniform content scale applied by the detached stage (<1 = fit-scaled). */
	fitScale: number;
	/** Final output density (pixels per inch) — useful for print expectations. */
	outputPpi: number;
	/** The selected quality mode. */
	quality: ExportQuality;
	/** Export-stage pixels per centimetre (32 standard / 64 HD). */
	pxPerCm: number;
	/** True when the pixel clamp reduced the ratio and/or fit scale. */
	clampLimited: boolean;
	/** Distinct item + board images this export has to decode (P3-06). */
	distinctImages: number;
}

export type ExportErrorCode =
	| "empty"
	| "scope"
	| "image"
	| "tainted"
	| "unknown";

export class ExportError extends Error {
	readonly code: ExportErrorCode;
	readonly parts: string[];

	constructor(code: ExportErrorCode, message: string, parts: string[] = []) {
		super(message);
		this.name = "ExportError";
		this.code = code;
		this.parts = parts;
	}
}

const EPSILON = 1e-6;

function rectFromPoints(points: Point[]): RectCm | null {
	if (points.length === 0) return null;
	let minX = Number.POSITIVE_INFINITY;
	let minY = Number.POSITIVE_INFINITY;
	let maxX = Number.NEGATIVE_INFINITY;
	let maxY = Number.NEGATIVE_INFINITY;
	for (const point of points) {
		if (point.x < minX) minX = point.x;
		if (point.y < minY) minY = point.y;
		if (point.x > maxX) maxX = point.x;
		if (point.y > maxY) maxY = point.y;
	}
	return { x: minX, y: minY, widthCm: maxX - minX, heightCm: maxY - minY };
}

export function unionRects(a: RectCm | null, b: RectCm | null): RectCm | null {
	if (!a) return b;
	if (!b) return a;
	const x = Math.min(a.x, b.x);
	const y = Math.min(a.y, b.y);
	return {
		x,
		y,
		widthCm: Math.max(a.x + a.widthCm, b.x + b.widthCm) - x,
		heightCm: Math.max(a.y + a.heightCm, b.y + b.heightCm) - y,
	};
}

function expandRect(rect: RectCm, margin: number): RectCm {
	return {
		x: rect.x - margin,
		y: rect.y - margin,
		widthCm: rect.widthCm + margin * 2,
		heightCm: rect.heightCm + margin * 2,
	};
}

function pointInRect(point: Point, rect: RectCm): boolean {
	return (
		point.x >= rect.x - EPSILON &&
		point.x <= rect.x + rect.widthCm + EPSILON &&
		point.y >= rect.y - EPSILON &&
		point.y <= rect.y + rect.heightCm + EPSILON
	);
}

/** A board's rotated footprint AABB in world cm. */
export function boardAabbCm(board: PlacedBoard): RectCm {
	const { widthCm, heightCm } = boardFootprint(board);
	const corners = [
		{ x: 0, y: 0 },
		{ x: widthCm, y: 0 },
		{ x: widthCm, y: heightCm },
		{ x: 0, y: heightCm },
	].map((corner) => boardToWorld(corner, board));
	return rectFromPoints(corners) as RectCm;
}

function itemAabbCm(
	item: PlacedItem,
	boards: PlacedBoard[],
	customPedals: CustomPedal[],
): RectCm {
	return rectFromPoints(itemWorldCorners(item, boards, customPedals)) as RectCm;
}

function endpointRect(endpoint: ExportEndpoint): RectCm {
	return { x: endpoint.x, y: endpoint.y, widthCm: 0, heightCm: 0 };
}

function computePixelPlan(
	boundsCm: RectCm,
	quality: ExportQuality,
): Pick<
	ExportPlan,
	| "stageWidthPx"
	| "stageHeightPx"
	| "pixelRatio"
	| "outputWidthPx"
	| "outputHeightPx"
	| "fitScale"
	| "outputPpi"
	| "quality"
	| "pxPerCm"
	| "clampLimited"
> {
	const pxPerCm =
		quality === "hd" ? EXPORT_HD_PX_PER_CM : EXPORT_STANDARD_PX_PER_CM;
	const widthRatioCap = quality === "hd" ? EXPORT_MAX_PIXEL_RATIO : 1;
	const baseWidthPx = Math.max(1, boundsCm.widthCm * pxPerCm);
	const baseHeightPx = Math.max(1, boundsCm.heightCm * pxPerCm);
	// Fit down against BOTH limits before rasterizing so the stage itself never
	// exceeds the budget (a square 2 m board would otherwise blow the area cap).
	const fitScale = Math.min(
		1,
		EXPORT_MAX_EDGE_PX / baseWidthPx,
		EXPORT_MAX_EDGE_PX / baseHeightPx,
		Math.sqrt(EXPORT_MAX_PIXELS / (baseWidthPx * baseHeightPx)),
	);
	const stageWidthPx = Math.max(1, Math.round(baseWidthPx * fitScale));
	const stageHeightPx = Math.max(1, Math.round(baseHeightPx * fitScale));
	const pixelRatio = Math.min(
		widthRatioCap,
		EXPORT_MAX_EDGE_PX / stageWidthPx,
		EXPORT_MAX_EDGE_PX / stageHeightPx,
		Math.sqrt(EXPORT_MAX_PIXELS / (stageWidthPx * stageHeightPx)),
	);
	// Floor so rounding can never push the final area back over the budget.
	const outputWidthPx = Math.min(
		EXPORT_MAX_EDGE_PX,
		Math.max(1, Math.floor(stageWidthPx * pixelRatio)),
	);
	const outputHeightPx = Math.min(
		EXPORT_MAX_EDGE_PX,
		Math.max(1, Math.floor(stageHeightPx * pixelRatio)),
	);
	return {
		stageWidthPx,
		stageHeightPx,
		pixelRatio,
		outputWidthPx,
		outputHeightPx,
		fitScale,
		outputPpi: outputWidthPx / (boundsCm.widthCm / 2.54),
		quality,
		pxPerCm,
		// Flag when the content is so large that even the requested mode had to be
		// fit-scaled (both modes), or Standard could not reach its 1× target. HD
		// hitting the area budget at fitScale 1 is the intended maximum, not a
		// warning.
		clampLimited:
			fitScale < 1 - EPSILON ||
			(quality === "standard" && pixelRatio < 1 - EPSILON),
	};
}

function buildPlan(
	scope: ExportScope,
	boards: PlacedBoard[],
	items: PlacedItem[],
	customPedals: CustomPedal[],
	endpoints: ExportEndpoint[],
	cables: ExportCable[],
	contentBounds: RectCm,
	quality: ExportQuality,
): ExportPlan {
	const boundsCm = expandRect(contentBounds, EXPORT_PADDING_CM);
	return {
		scope,
		boards,
		items,
		customPedals,
		endpoints,
		cables,
		boundsCm,
		contentBoundsCm: contentBounds,
		// Boards are image-bearing too, so the export estimate includes their art
		// (the scene-wide item-image budget does not — boards have their own cap).
		distinctImages: distinctImageUrls({ boards, items, customPedals }, true)
			.length,
		...computePixelPlan(boundsCm, quality),
	};
}

function selectedBoardPlan(
	scene: ExportSceneInput,
	boardUid: string,
	quality: ExportQuality,
): ExportPlan {
	const board = scene.boards.find((candidate) => candidate.uid === boardUid);
	if (!board) {
		throw new ExportError(
			"scope",
			"The selected board is no longer available.",
		);
	}

	const attachedItems = scene.items.filter(
		(item) => item.boardUid === board.uid,
	);
	const attachedUids = new Set(attachedItems.map((item) => item.uid));
	const boardRect = boardAabbCm(board);
	const inflated = expandRect(boardRect, ENDPOINT_MARGIN_CM);
	const allEndpoints = scene.endpoints ?? [];
	const endpointByUid = new Map(
		allEndpoints.map((endpoint) => [endpoint.uid, endpoint]),
	);

	const endpointInScope = (end: ExportCableEnd): boolean => {
		if ("itemUid" in end) return attachedUids.has(end.itemUid);
		const endpoint = endpointByUid.get(end.endpointUid);
		return endpoint !== undefined && pointInRect(endpoint, inflated);
	};

	// A cable is kept only when BOTH ends are in scope; a cable to anything out
	// of scope is dropped (never clipped mid-air) — design.md §Export scope.
	const cables = (scene.cables ?? []).filter(
		(cable) => endpointInScope(cable.from) && endpointInScope(cable.to),
	);

	const includedEndpoints = new Map<string, ExportEndpoint>();
	for (const cable of cables) {
		for (const end of [cable.from, cable.to]) {
			if ("endpointUid" in end) {
				const endpoint = endpointByUid.get(end.endpointUid);
				if (endpoint) includedEndpoints.set(endpoint.uid, endpoint);
			}
		}
	}

	let content: RectCm | null = boardRect;
	for (const item of attachedItems) {
		content = unionRects(
			content,
			itemAabbCm(item, scene.boards, scene.customPedals),
		);
	}
	for (const endpoint of includedEndpoints.values()) {
		content = unionRects(content, endpointRect(endpoint));
	}

	return buildPlan(
		"board",
		[board],
		attachedItems,
		scene.customPedals,
		[...includedEndpoints.values()],
		cables,
		content as RectCm,
		quality,
	);
}

function allContentPlan(
	scene: ExportSceneInput,
	quality: ExportQuality,
): ExportPlan {
	const { boards, items, customPedals } = scene;
	const endpoints = scene.endpoints ?? [];
	const cables = scene.cables ?? [];

	// "All content" means ALL content: loose pedals/supplies and endpoints are
	// part of the plan even when they sit far from every board. The pixel clamp
	// (not a crop) is what keeps an extreme layout renderable.
	let allContent: RectCm | null = null;
	for (const board of boards) {
		allContent = unionRects(allContent, boardAabbCm(board));
	}
	for (const item of items) {
		allContent = unionRects(allContent, itemAabbCm(item, boards, customPedals));
	}
	for (const endpoint of endpoints) {
		allContent = unionRects(allContent, endpointRect(endpoint));
	}
	if (!allContent) {
		throw new ExportError("empty", "There is nothing to export yet.");
	}

	return buildPlan(
		"all",
		boards,
		items,
		customPedals,
		endpoints,
		cables,
		allContent,
		quality,
	);
}

/** Resolve an export plan (scope + bounds + iOS-safe output size). */
export function resolveExportPlan(
	scene: ExportSceneInput,
	options: {
		scope: ExportScope;
		boardUid?: string | null;
		quality?: ExportQuality;
	},
): ExportPlan {
	const quality = options.quality ?? "standard";
	if (options.scope === "board") {
		if (!options.boardUid) {
			throw new ExportError("scope", "Select a board to export it alone.");
		}
		return selectedBoardPlan(scene, options.boardUid, quality);
	}
	return allContentPlan(scene, quality);
}

/** A filename-safe slug for the download. */
export function exportFileSlug(value: string): string {
	const slug = value
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
	return slug || "plan";
}

/** `pedalvision-{board-or-plan}-{YYYY-MM-DD}.png` (local date). */
export function exportFileName(
	plan: ExportPlan,
	boardLabel: string | null,
	now: Date = new Date(),
	format: ExportFormat = "png",
): string {
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, "0");
	const day = String(now.getDate()).padStart(2, "0");
	const scope = plan.scope === "board" && boardLabel ? boardLabel : "plan";
	return `pedalvision-${exportFileSlug(scope)}-${year}-${month}-${day}.${format}`;
}

/** World-cm point for a cable end (item centre / endpoint); P4 refines jacks. */
export function cableEndPointCm(
	end: ExportCableEnd,
	scene: ExportSceneInput,
): Point | null {
	if ("endpointUid" in end) {
		const endpoint = (scene.endpoints ?? []).find(
			(candidate) => candidate.uid === end.endpointUid,
		);
		return endpoint ? { x: endpoint.x, y: endpoint.y } : null;
	}
	const item = scene.items.find((candidate) => candidate.uid === end.itemUid);
	if (!item) return null;
	const corners = itemWorldCorners(item, scene.boards, scene.customPedals);
	if (corners.length === 0) return null;
	let minX = Number.POSITIVE_INFINITY;
	let minY = Number.POSITIVE_INFINITY;
	let maxX = Number.NEGATIVE_INFINITY;
	let maxY = Number.NEGATIVE_INFINITY;
	for (const point of corners) {
		if (point.x < minX) minX = point.x;
		if (point.y < minY) minY = point.y;
		if (point.x > maxX) maxX = point.x;
		if (point.y > maxY) maxY = point.y;
	}
	return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
}
