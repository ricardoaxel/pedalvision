import {
	applyPinch,
	type PinchStart,
	type Point,
	type Viewport,
} from "../state/viewport";

/** How far (screen px) a pointer may move before a press becomes a pan. */
export const PAN_THRESHOLD_PX = 3;

/** What is under the pointer where a gesture starts (N4 priority). */
export type GestureTarget = "empty" | "object";

/**
 * Which gesture is in flight. `pan` begins dormant and only starts moving the
 * viewport once the pointer passes {@link PAN_THRESHOLD_PX}, so a click doesn't
 * nudge the canvas.
 */
export type Gesture =
	| { type: "idle" }
	| {
			type: "pan";
			pointerId: number;
			start: Point;
			viewport: Viewport;
			active: boolean;
	  }
	| { type: "pinch"; start: PinchStart };

/** The full machine state: tracked pointers + the active gesture. */
export interface GestureMachine {
	pointers: Map<number, Point>;
	gesture: Gesture;
}

export type GestureEvent =
	| {
			type: "down";
			pointerId: number;
			point: Point;
			target: GestureTarget;
	  }
	| {
			type: "move";
			pointerId: number;
			point: Point;
			pointerType: string;
			buttons: number;
	  }
	| { type: "up"; pointerId: number }
	| { type: "cancel" };

export interface GestureResult {
	machine: GestureMachine;
	/** Set only when the event changed the viewport (stage transform). */
	viewport?: Viewport;
}

function distance(a: Point, b: Point): number {
	return Math.hypot(a.x - b.x, a.y - b.y);
}

/** The first two tracked pointers, in insertion order (the pinch pair). */
function firstTwo(pointers: Map<number, Point>): [Point, Point] | null {
	const iterator = pointers.values();
	const a = iterator.next().value;
	const b = iterator.next().value;
	return a && b ? [a, b] : null;
}

function spread(pointers: Map<number, Point>): number {
	const pair = firstTwo(pointers);
	return pair ? distance(pair[0], pair[1]) : 0;
}

function midpoint(pointers: Map<number, Point>): Point {
	const pair = firstTwo(pointers);
	if (!pair) return { x: 0, y: 0 };
	return { x: (pair[0].x + pair[1].x) / 2, y: (pair[0].y + pair[1].y) / 2 };
}

function clone(machine: GestureMachine): GestureMachine {
	return { pointers: new Map(machine.pointers), gesture: machine.gesture };
}

function onDown(
	machine: GestureMachine,
	event: Extract<GestureEvent, { type: "down" }>,
	viewport: Viewport,
): GestureResult {
	const next = clone(machine);
	next.pointers.set(event.pointerId, event.point);

	if (next.pointers.size === 1) {
		// Two-pointer gestures always win; a single pointer only pans on empty
		// canvas. A hit object will consume the gesture instead (P1-03/P1-04).
		next.gesture =
			event.target === "empty"
				? {
						type: "pan",
						pointerId: event.pointerId,
						start: event.point,
						viewport,
						active: false,
					}
				: { type: "idle" };
	} else if (next.pointers.size === 2) {
		next.gesture = {
			type: "pinch",
			start: {
				viewport,
				distance: spread(next.pointers),
				midpoint: midpoint(next.pointers),
			},
		};
	}
	// A third+ pointer is tracked but doesn't change the gesture.

	return { machine: next };
}

function onEnd(
	machine: GestureMachine,
	pointerId: number,
	viewport: Viewport,
): GestureResult {
	if (!machine.pointers.has(pointerId)) return { machine };
	const next = clone(machine);
	next.pointers.delete(pointerId);

	if (next.pointers.size === 0) {
		next.gesture = { type: "idle" };
	} else if (next.pointers.size === 1 && next.gesture.type === "pinch") {
		// Lift from two fingers to one: keep panning with the remaining finger
		// from the current viewport (so the first move doesn't jump).
		const [remainingId, remainingPoint] = [...next.pointers.entries()][0];
		next.gesture = {
			type: "pan",
			pointerId: remainingId,
			start: remainingPoint,
			viewport,
			active: true,
		};
	}

	return { machine: next };
}

/** Advance the gesture machine by one pointer event. Pure — no DOM/store. */
export function reduceGesture(
	machine: GestureMachine,
	event: GestureEvent,
	viewport: Viewport,
): GestureResult {
	switch (event.type) {
		case "down":
			return onDown(machine, event, viewport);
		case "up":
			return onEnd(machine, event.pointerId, viewport);
		case "cancel":
			return {
				machine: { pointers: new Map(), gesture: { type: "idle" } },
			};
		case "move": {
			if (!machine.pointers.has(event.pointerId)) return { machine };
			// A mouse pointer that reports no buttons held was released outside
			// the window (pointerup never arrived): end its gesture.
			if (event.pointerType !== "touch" && event.buttons === 0) {
				return onEnd(machine, event.pointerId, viewport);
			}

			const next = clone(machine);
			next.pointers.set(event.pointerId, event.point);

			if (
				next.gesture.type === "pan" &&
				next.pointers.size === 1 &&
				next.gesture.pointerId === event.pointerId
			) {
				const pan = next.gesture;
				const dx = event.point.x - pan.start.x;
				const dy = event.point.y - pan.start.y;
				if (!pan.active && Math.hypot(dx, dy) < PAN_THRESHOLD_PX) {
					return { machine: next };
				}
				next.gesture = { ...pan, active: true };
				return {
					machine: next,
					viewport: {
						scale: pan.viewport.scale,
						x: pan.viewport.x + dx,
						y: pan.viewport.y + dy,
					},
				};
			}

			if (next.gesture.type === "pinch" && next.pointers.size >= 2) {
				return {
					machine: next,
					viewport: applyPinch(
						next.gesture.start,
						spread(next.pointers),
						midpoint(next.pointers),
					),
				};
			}

			return { machine: next };
		}
	}
}
