import type { RefObject } from "react";
import { useEffect } from "react";
import { type Point, useViewport, type Viewport } from "../state/viewport";
import {
	type GestureEvent,
	type GestureMachine,
	reduceGesture,
	wheelZoomAllowed,
} from "./gestures";

/** Wheel delta → zoom factor. `deltaY` of ~100px ≈ 1.16×. */
const WHEEL_ZOOM_SENSITIVITY = 0.0015;
/** Firefox reports deltas in lines/pages; normalise to px. */
const LINE_HEIGHT_PX = 16;
const PAGE_HEIGHT_PX = 100;

function snapshot(): Viewport {
	const { scale, x, y } = useViewport.getState();
	return { scale, x, y };
}

/**
 * Binds stage viewport gestures to the container (design.md §Canvas
 * architecture, N4):
 * - 1 pointer dragged on empty canvas → pan;
 * - 1 pointer on an object → no pan (the object's own drag handles it);
 * - 2 pointers → pinch-zoom + pan **regardless of target**;
 * - wheel → zoom-to-pointer.
 *
 * The gesture logic itself is the pure reducer in `./gestures` (unit-tested);
 * this hook only translates DOM events into reducer events, resolves the hit
 * target, and applies the resulting viewport (the stage transform — object
 * props are never touched).
 *
 * `hitTest(point)` is the `empty`/`object` seam: it reports whether a node is
 * under a press. P1-03 passes a Konva hit test so a single pointer on a board
 * drags the board while empty space pans.
 */
export function useViewportGestures(
	containerRef: RefObject<HTMLElement | null>,
	hitTest?: (point: Point) => boolean,
): void {
	useEffect(() => {
		const element = containerRef.current;
		if (!element) return;

		let machine: GestureMachine = {
			pointers: new Map(),
			gesture: { type: "idle" },
		};

		const localPoint = (clientX: number, clientY: number): Point => {
			const rect = element.getBoundingClientRect();
			return { x: clientX - rect.left, y: clientY - rect.top };
		};

		const dispatch = (event: GestureEvent) => {
			const result = reduceGesture(machine, event, snapshot());
			machine = result.machine;
			if (result.viewport) {
				useViewport.getState().setViewport(result.viewport);
			}
		};

		const onPointerDown = (event: PointerEvent) => {
			if (event.pointerType === "mouse" && event.button !== 0) return;
			const point = localPoint(event.clientX, event.clientY);
			dispatch({
				type: "down",
				pointerId: event.pointerId,
				point,
				target: hitTest?.(point) ? "object" : "empty",
			});
		};

		const onPointerMove = (event: PointerEvent) => {
			dispatch({
				type: "move",
				pointerId: event.pointerId,
				point: localPoint(event.clientX, event.clientY),
				pointerType: event.pointerType,
				buttons: event.buttons,
			});
		};

		const onPointerUp = (event: PointerEvent) => {
			dispatch({ type: "up", pointerId: event.pointerId });
		};

		// The browser took over the gesture (e.g. scroll/zoom): abandon it.
		const onPointerCancel = () => dispatch({ type: "cancel" });

		// A window blur can swallow a pointerup; drop all gestures.
		const onWindowBlur = () => dispatch({ type: "cancel" });

		const onWheel = (event: WheelEvent) => {
			event.preventDefault();
			// Never zoom mid-gesture: it would invalidate the pan/pinch baseline.
			if (!wheelZoomAllowed(machine)) return;
			const unit =
				event.deltaMode === 1
					? LINE_HEIGHT_PX
					: event.deltaMode === 2
						? PAGE_HEIGHT_PX
						: 1;
			const factor = Math.exp(-event.deltaY * unit * WHEEL_ZOOM_SENSITIVITY);
			useViewport
				.getState()
				.zoomBy(factor, localPoint(event.clientX, event.clientY));
		};

		element.addEventListener("pointerdown", onPointerDown);
		window.addEventListener("pointermove", onPointerMove);
		window.addEventListener("pointerup", onPointerUp);
		window.addEventListener("pointercancel", onPointerCancel);
		window.addEventListener("blur", onWindowBlur);
		element.addEventListener("wheel", onWheel, { passive: false });

		return () => {
			element.removeEventListener("pointerdown", onPointerDown);
			window.removeEventListener("pointermove", onPointerMove);
			window.removeEventListener("pointerup", onPointerUp);
			window.removeEventListener("pointercancel", onPointerCancel);
			window.removeEventListener("blur", onWindowBlur);
			element.removeEventListener("wheel", onWheel);
		};
	}, [containerRef, hitTest]);
}
