import {
	boardFootprint,
	type CustomPedal,
	itemWorldCorners,
	type PlacedBoard,
	type PlacedItem,
} from "../state/scene";
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

/** All-content fit window: loose content this close to a board stays in frame. */
export const ALL_CONTENT_FIT_RADIUS_CM = 40;

/** Uniform margin around the exported content (cm). Holds the scale bar. */
export const EXPORT_PADDING_CM = 4;

/** Output density at 1× (the live canvas renders at 4 px/cm). */
export const EXPORT_PX_PER_CM = 32;

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
	/** True when far-off loose content was excluded from the all-content frame. */
	trimmed: boolean;
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
	/** True when the pixel clamp reduced the ratio and/or fit scale. */
	clampLimited: boolean;
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

function rectsIntersect(a: RectCm, b: RectCm): boolean {
	return (
		a.x <= b.x + b.widthCm + EPSILON &&
		a.x + a.widthCm >= b.x - EPSILON &&
		a.y <= b.y + b.heightCm + EPSILON &&
		a.y + a.heightCm >= b.y - EPSILON
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

function isNearAnyBoard(
	rect: RectCm,
	boardRects: RectCm[],
	radiusCm: number,
): boolean {
	return boardRects.some((board) =>
		rectsIntersect(rect, expandRect(board, radiusCm)),
	);
}

function computePixelPlan(
	boundsCm: RectCm,
): Pick<
	ExportPlan,
	| "stageWidthPx"
	| "stageHeightPx"
	| "pixelRatio"
	| "outputWidthPx"
	| "outputHeightPx"
	| "fitScale"
	| "outputPpi"
	| "clampLimited"
> {
	const baseWidthPx = Math.max(1, boundsCm.widthCm * EXPORT_PX_PER_CM);
	const baseHeightPx = Math.max(1, boundsCm.heightCm * EXPORT_PX_PER_CM);
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
		EXPORT_MAX_PIXEL_RATIO,
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
		clampLimited:
			pixelRatio < EXPORT_MAX_PIXEL_RATIO - EPSILON || fitScale < 1 - EPSILON,
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
	trimmed: boolean,
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
		trimmed,
		...computePixelPlan(boundsCm),
	};
}

function selectedBoardPlan(
	scene: ExportSceneInput,
	boardUid: string,
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
		false,
	);
}

function allContentPlan(scene: ExportSceneInput): ExportPlan {
	const { boards, items, customPedals } = scene;
	const endpoints = scene.endpoints ?? [];
	const cables = scene.cables ?? [];

	let allContent: RectCm | null = null;
	const boardRects: RectCm[] = [];
	for (const board of boards) {
		const rect = boardAabbCm(board);
		boardRects.push(rect);
		allContent = unionRects(allContent, rect);
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

	// Fit cap: if content balloons far from the boards (a stray loose item), the
	// frame keeps everything within the fit radius of a board so the PNG isn't
	// mostly empty. With no boards there is nothing to fit against.
	let coreContent: RectCm | null = null;
	if (boards.length > 0) {
		for (const rect of boardRects) {
			coreContent = unionRects(coreContent, rect);
		}
		for (const item of items) {
			const attached = item.boardUid !== null;
			const rect = itemAabbCm(item, boards, customPedals);
			if (
				attached ||
				isNearAnyBoard(rect, boardRects, ALL_CONTENT_FIT_RADIUS_CM)
			) {
				coreContent = unionRects(coreContent, rect);
			}
		}
		for (const endpoint of endpoints) {
			if (
				isNearAnyBoard(
					endpointRect(endpoint),
					boardRects,
					ALL_CONTENT_FIT_RADIUS_CM,
				)
			) {
				coreContent = unionRects(coreContent, endpointRect(endpoint));
			}
		}
	}

	const content = coreContent ?? allContent;
	const fitted = boards.length > 0;

	// Keep the payload consistent with the fit-capped frame: content outside the
	// frame is excluded (not merely clipped) so a far item's missing/CORS-blocked
	// image can't abort an export the user cannot see. Attached items always
	// travel with their board; loose items/endpoints must intersect the frame.
	const includedItems = fitted
		? items.filter(
				(item) =>
					item.boardUid !== null ||
					rectsIntersect(itemAabbCm(item, boards, customPedals), content),
			)
		: items;
	const includedEndpoints = fitted
		? endpoints.filter((endpoint) => pointInRect(endpoint, content))
		: endpoints;
	const itemUids = new Set(includedItems.map((item) => item.uid));
	const endpointUids = new Set(
		includedEndpoints.map((endpoint) => endpoint.uid),
	);
	const endIncluded = (end: ExportCableEnd): boolean =>
		"itemUid" in end
			? itemUids.has(end.itemUid)
			: endpointUids.has(end.endpointUid);
	// All-content cables still obey the no-dangling rule: both ends must survive
	// the fit cap, so a cable to trimmed content is dropped rather than clipped.
	const includedCables = fitted
		? cables.filter((cable) => endIncluded(cable.from) && endIncluded(cable.to))
		: cables;
	const trimmed =
		includedItems.length !== items.length ||
		includedEndpoints.length !== endpoints.length ||
		includedCables.length !== cables.length;

	return buildPlan(
		"all",
		boards,
		includedItems,
		customPedals,
		includedEndpoints,
		includedCables,
		content,
		trimmed,
	);
}

/** Resolve an export plan (scope + bounds + iOS-safe output size). */
export function resolveExportPlan(
	scene: ExportSceneInput,
	options: { scope: ExportScope; boardUid?: string | null },
): ExportPlan {
	if (options.scope === "board") {
		if (!options.boardUid) {
			throw new ExportError("scope", "Select a board to export it alone.");
		}
		return selectedBoardPlan(scene, options.boardUid);
	}
	return allContentPlan(scene);
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
