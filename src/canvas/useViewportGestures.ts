import type { RefObject } from "react";
import { useEffect } from "react";
import {
	applyPinch,
	type PinchStart,
	type Point,
	useViewport,
	type Viewport,
} from "../state/viewport";

/** Wheel delta → zoom factor. `deltaY` of ~100px ≈ 1.16×. */
const WHEEL_ZOOM_SENSITIVITY = 0.0015;
/** Firefox reports deltas in lines/pages; normalise to px. */
const LINE_HEIGHT_PX = 16;
const PAGE_HEIGHT_PX = 100;

type Gesture =
	| { type: "none" }
	| { type: "pan"; start: Point; viewport: Viewport }
	| { type: "pinch"; start: PinchStart };

function snapshot(): Viewport {
	const { scale, x, y } = useViewport.getState();
	return { scale, x, y };
}

/**
 * Stage viewport gestures (design.md §Canvas architecture, N4):
 * - 1 pointer dragged on empty canvas → pan;
 * - 2 pointers → pinch-zoom + pan **regardless of target**;
 * - wheel → zoom-to-pointer.
 *
 * A gesture is either a pan or a pinch — never both; a second pointer always
 * promotes the gesture to pinch. Zoom/pan only ever call the viewport store
 * (the stage transform) — object props are never touched.
 *
 * Object-level pointer handling (select / drag a pedal or board) lands in
 * P1-03/P1-04: a single pointer that starts on a hit object will consume the
 * gesture before it becomes a pan. Until then the canvas has no objects, so a
 * single pointer always pans.
 */
export function useViewportGestures(
	containerRef: RefObject<HTMLElement | null>,
): void {
	useEffect(() => {
		const element = containerRef.current;
		if (!element) return;

		const pointers = new Map<number, Point>();
		let gesture: Gesture = { type: "none" };

		const localPoint = (clientX: number, clientY: number): Point => {
			const rect = element.getBoundingClientRect();
			return { x: clientX - rect.left, y: clientY - rect.top };
		};

		const midpoint = (): Point => {
			let x = 0;
			let y = 0;
			for (const pointer of pointers.values()) {
				x += pointer.x;
				y += pointer.y;
			}
			const count = pointers.size || 1;
			return { x: x / count, y: y / count };
		};

		const spread = (): number => {
			const [a, b] = [...pointers.values()];
			if (!a || !b) return 0;
			return Math.hypot(a.x - b.x, a.y - b.y);
		};

		const onPointerDown = (event: PointerEvent) => {
			if (event.pointerType === "mouse" && event.button !== 0) return;
			pointers.set(event.pointerId, localPoint(event.clientX, event.clientY));

			if (pointers.size === 1) {
				gesture = {
					type: "pan",
					start: localPoint(event.clientX, event.clientY),
					viewport: snapshot(),
				};
			} else if (pointers.size === 2) {
				gesture = {
					type: "pinch",
					start: {
						viewport: snapshot(),
						distance: spread(),
						midpoint: midpoint(),
					},
				};
			}
		};

		const onPointerMove = (event: PointerEvent) => {
			if (!pointers.has(event.pointerId)) return;
			pointers.set(event.pointerId, localPoint(event.clientX, event.clientY));

			if (gesture.type === "pan" && pointers.size === 1) {
				const point = localPoint(event.clientX, event.clientY);
				useViewport.getState().setViewport({
					scale: snapshot().scale,
					x: gesture.viewport.x + (point.x - gesture.start.x),
					y: gesture.viewport.y + (point.y - gesture.start.y),
				});
			} else if (gesture.type === "pinch" && pointers.size >= 2) {
				useViewport
					.getState()
					.setViewport(applyPinch(gesture.start, spread(), midpoint()));
			}
		};

		const onPointerEnd = (event: PointerEvent) => {
			if (!pointers.has(event.pointerId)) return;
			pointers.delete(event.pointerId);

			if (pointers.size === 0) {
				gesture = { type: "none" };
			} else if (pointers.size === 1 && gesture.type === "pinch") {
				// Lift from two fingers to one: continue panning with the rest.
				const [start] = [...pointers.values()];
				gesture = { type: "pan", start, viewport: snapshot() };
			}
		};

		const onWheel = (event: WheelEvent) => {
			event.preventDefault();
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
		window.addEventListener("pointerup", onPointerEnd);
		window.addEventListener("pointercancel", onPointerEnd);
		element.addEventListener("wheel", onWheel, { passive: false });

		return () => {
			element.removeEventListener("pointerdown", onPointerDown);
			window.removeEventListener("pointermove", onPointerMove);
			window.removeEventListener("pointerup", onPointerEnd);
			window.removeEventListener("pointercancel", onPointerEnd);
			element.removeEventListener("wheel", onWheel);
		};
	}, [containerRef]);
}
