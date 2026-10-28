import type {
	Cable,
	CustomPedal,
	Endpoint,
	PlacedBoard,
	PlacedItem,
} from "../state/scene";
import {
	type CanvasSize,
	MAX_SCALE,
	MIN_SCALE,
	type Viewport,
} from "../state/viewport";
import { resolveExportPlan } from "./exportScene";
import { PX_PER_CM, type RectCm } from "./geometry";

/**
 * Viewport focus (F-04) — the pure math behind "frame a board / frame the used
 * area". It reuses the export scope's content bounds so "what I framed" and
 * "what I exported" can never drift, then computes the stage transform only
 * (cm stays the source of truth; no object is ever rescaled).
 *
 * No animation lives here: the caller applies the returned transform in one
 * jump (motion is F-05).
 */

/** Screen-space chrome reserved around the usable drawing area. */
export interface FocusInsets {
	top: number;
	right: number;
	bottom: number;
	left: number;
}

/** Chrome measured by the caller (mobile only; desktop has no overlay dock). */
export interface FocusChrome {
	mobile: boolean;
	/** The mobile info sheet's rendered height in px (0 when closed). */
	sheetHeight: number;
}

export interface FitBoundsOptions {
	insets: FocusInsets;
	/** Breathing room inside the safe rect, in screen px. */
	paddingPx: number;
	/** Zoom ceiling (load framing passes 1 so a small sheet is never magnified). */
	maxScale?: number;
}

/** The scene fields the focus bounds need (a subset of the scene store). */
export interface FocusScene {
	boards: PlacedBoard[];
	items: PlacedItem[];
	customPedals: CustomPedal[];
	endpoints: Endpoint[];
	cables: Cable[];
}

/** Never magnify on an automatic scene load (owner decision 2026-10-28). */
export const FOCUS_LOAD_MAX_SCALE = 1;

/**
 * The safe drawing rect for a viewport. Desktop: the stage already excludes the
 * bottom Margin Rule strip, so only the top scene plate/toolbar + side gutters
 * are reserved. Mobile: the full-bleed stage is overlaid by the tab dock, the
 * Margin Rule strip above it, and the info peek — reserve all of them, capped
 * so a large sheet can never collapse the frame to nothing.
 */
export function focusInsets(
	size: CanvasSize,
	chrome: FocusChrome,
): FocusInsets {
	const top = Math.min(72, Math.max(0, size.height * 0.15));
	if (!chrome.mobile) return { top, right: 24, bottom: 24, left: 24 };
	// dock 56 + gap 16 + Margin Rule strip 66 (44 px row + bar) + breathing
	// 12 + info peek.
	const reserve = 56 + 16 + 66 + 12 + Math.max(0, chrome.sheetHeight);
	return {
		top,
		right: 16,
		bottom: Math.max(0, Math.min(reserve, size.height * 0.45)),
		left: 16,
	};
}

/**
 * Fit `bounds` inside the safe rect and return the stage transform that centres
 * it. Returns null for an empty/degenerate target or a viewport with no usable
 * area (the caller then leaves the viewport alone or resets it).
 *
 * `maxScale` is applied after the global zoom clamp; load framing passes 1 so a
 * small scene lands at 1:1 instead of filling the screen.
 */
export function fitBoundsToViewport(
	bounds: RectCm,
	size: CanvasSize,
	options: FitBoundsOptions,
): Viewport | null {
	if (
		!Number.isFinite(bounds.x) ||
		!Number.isFinite(bounds.y) ||
		!Number.isFinite(bounds.widthCm) ||
		!Number.isFinite(bounds.heightCm)
	) {
		return null;
	}
	const widthCm = Math.max(0, bounds.widthCm);
	const heightCm = Math.max(0, bounds.heightCm);
	if (widthCm <= Number.EPSILON && heightCm <= Number.EPSILON) return null;

	const { insets } = options;
	const usableWidth = size.width - insets.left - insets.right;
	const usableHeight = size.height - insets.top - insets.bottom;
	if (usableWidth <= 0 || usableHeight <= 0) return null;

	// Never let the breathing margin eat the whole rect on a tiny viewport.
	const padding = Math.min(
		Math.max(0, options.paddingPx),
		Math.max(0, Math.min(usableWidth, usableHeight) / 2 - 1),
	);
	const availableWidth = Math.max(1, usableWidth - padding * 2);
	const availableHeight = Math.max(1, usableHeight - padding * 2);

	const fitWidthPx =
		widthCm > 0 ? availableWidth / (widthCm * PX_PER_CM) : null;
	const fitHeightPx =
		heightCm > 0 ? availableHeight / (heightCm * PX_PER_CM) : null;
	const rawScale = Math.min(
		fitWidthPx ?? Number.POSITIVE_INFINITY,
		fitHeightPx ?? Number.POSITIVE_INFINITY,
	);
	if (!Number.isFinite(rawScale) || rawScale <= 0) return null;

	const maxScale = Math.min(
		MAX_SCALE,
		Math.max(MIN_SCALE, options.maxScale ?? MAX_SCALE),
	);
	const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, rawScale));
	const cappedScale = Math.min(scale, maxScale);

	const contentWidthPx = widthCm * PX_PER_CM * cappedScale;
	const contentHeightPx = heightCm * PX_PER_CM * cappedScale;
	return {
		scale: cappedScale,
		x:
			insets.left +
			(usableWidth - contentWidthPx) / 2 -
			bounds.x * PX_PER_CM * cappedScale,
		y:
			insets.top +
			(usableHeight - contentHeightPx) / 2 -
			bounds.y * PX_PER_CM * cappedScale,
	};
}

/**
 * The current scene's used area: every board + item + endpoint + in-scope cable
 * curve, matching the export's **all-content** scope. Null when nothing is
 * placed (an empty sheet has no target).
 */
export function sceneFocusBounds(scene: FocusScene): RectCm | null {
	if (
		scene.boards.length === 0 &&
		scene.items.length === 0 &&
		scene.endpoints.length === 0
	) {
		return null;
	}
	try {
		return resolveExportPlan(scene, { scope: "all" }).contentBoundsCm;
	} catch {
		return null;
	}
}

/**
 * One board's focus target: the board + its attached items + in-scope
 * endpoints/cables, matching the export's **selected-board** scope.
 */
export function boardFocusBounds(
	scene: FocusScene,
	boardUid: string,
): RectCm | null {
	if (!scene.boards.some((board) => board.uid === boardUid)) return null;
	try {
		return resolveExportPlan(scene, { scope: "board", boardUid })
			.contentBoundsCm;
	} catch {
		return null;
	}
}
