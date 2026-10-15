import { create } from "zustand";
import { type Point, PX_PER_CM } from "../lib/geometry";

export type { Point };

/** The stage's pixel size (its container's content box). */
export interface CanvasSize {
	width: number;
	height: number;
}

/** Screen px → cm under `viewport` (screen px → stage-local px → cm). */
export function pxToWorldCm(point: Point, viewport: Viewport): Point {
	const local = screenToWorld(point, viewport);
	return { x: local.x / PX_PER_CM, y: local.y / PX_PER_CM };
}

/**
 * The world cm point under the centre of the canvas (screen px). Used to drop a
 * newly-added board "at the viewport centre" regardless of pan/zoom. Zoom/pan
 * only move what is under the centre — they never change the world positions of
 * existing objects (A1).
 */
export function viewportCenterCm(size: CanvasSize, viewport: Viewport): Point {
	return pxToWorldCm({ x: size.width / 2, y: size.height / 2 }, viewport);
}

/** Zoom bounds (design.md §Canvas architecture): 0.1×–8×. */
export const MIN_SCALE = 0.1;
export const MAX_SCALE = 8;

/**
 * Pinch references below this finger distance (px) are ignored (treated as a
 * pure translate) — two near-coincident fingers would otherwise produce a huge
 * scale factor.
 */
export const MIN_PINCH_DISTANCE_PX = 8;

/**
 * The viewport *is* the stage transform: `scale` is the zoom factor and `x`/`y`
 * are the stage position in screen px. Stage-local ("world") coordinates are
 * unscaled px (`cm × PX_PER_CM`); the mapping to screen is
 * `screen = local × scale + (x, y)` (design.md §Canvas architecture).
 *
 * Zoom/pan mutate this transform only — never object props.
 */
export interface Viewport {
	scale: number;
	x: number;
	y: number;
}

export const DEFAULT_VIEWPORT: Viewport = { scale: 1, x: 0, y: 0 };

/** Clamp a zoom factor to [{@link MIN_SCALE}, {@link MAX_SCALE}]. Non-finite → 1. */
export function clampScale(scale: number): number {
	if (!Number.isFinite(scale)) return DEFAULT_VIEWPORT.scale;
	return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

/** Screen px → stage-local px under `viewport`. */
export function screenToWorld(point: Point, viewport: Viewport): Point {
	return {
		x: (point.x - viewport.x) / viewport.scale,
		y: (point.y - viewport.y) / viewport.scale,
	};
}

/** Stage-local px → screen px under `viewport` (inverse of {@link screenToWorld}). */
export function worldToScreen(point: Point, viewport: Viewport): Point {
	return {
		x: point.x * viewport.scale + viewport.x,
		y: point.y * viewport.scale + viewport.y,
	};
}

/**
 * Zoom to `nextScale` while keeping the stage-local point currently under
 * `anchor` (screen px) fixed — the wheel/pointer "zoom-to-pointer" contract.
 * The result scale is clamped.
 */
export function zoomAroundPoint(
	viewport: Viewport,
	nextScale: number,
	anchor: Point,
): Viewport {
	const scale = clampScale(nextScale);
	const world = screenToWorld(anchor, viewport);
	return {
		scale,
		x: anchor.x - world.x * scale,
		y: anchor.y - world.y * scale,
	};
}

/** The initial state of a two-finger gesture. */
export interface PinchStart {
	viewport: Viewport;
	distance: number;
	midpoint: Point;
}

/**
 * Two-finger gesture: scale by the change in finger distance and translate by
 * the change in midpoint (pinch-zoom + pan in one), keeping the stage-local
 * point under the initial midpoint anchored to the current midpoint. The
 * result scale is clamped.
 */
export function applyPinch(
	start: PinchStart,
	distance: number,
	midpoint: Point,
): Viewport {
	const factor =
		start.distance >= MIN_PINCH_DISTANCE_PX ? distance / start.distance : 1;
	const scale = clampScale(start.viewport.scale * factor);
	const world = screenToWorld(start.midpoint, start.viewport);
	return {
		scale,
		x: midpoint.x - world.x * scale,
		y: midpoint.y - world.y * scale,
	};
}

interface ViewportStore extends Viewport {
	/** The stage's current pixel size (0 until the first ResizeObserver tick). */
	size: CanvasSize;
	/** Zoom about a screen-space anchor (clamped). */
	zoomBy: (factor: number, anchor: Point) => void;
	/** Set the whole viewport (used by pan/pinch gesture loops). */
	setViewport: (viewport: Viewport) => void;
	/** Record the stage size (ResizeObserver). Never affects world positions. */
	setSize: (size: CanvasSize) => void;
	/** Back to 1×, origin at the container's top-left. */
	reset: () => void;
}

export const useViewport = create<ViewportStore>((set) => ({
	...DEFAULT_VIEWPORT,
	size: { width: 0, height: 0 },
	zoomBy: (factor, anchor) =>
		set((viewport) =>
			zoomAroundPoint(viewport, viewport.scale * factor, anchor),
		),
	setViewport: (viewport) => set({ ...viewport }),
	setSize: (size) =>
		set((state) =>
			state.size.width === size.width && state.size.height === size.height
				? state
				: { size },
		),
	reset: () => set({ ...DEFAULT_VIEWPORT }),
}));
