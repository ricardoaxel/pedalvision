import { describe, expect, it } from "vitest";
import type { Viewport } from "../state/viewport";
import {
	type GestureEvent,
	type GestureMachine,
	PAN_THRESHOLD_PX,
	reduceGesture,
} from "./gestures";

const START: Viewport = { scale: 1, x: 0, y: 0 };

interface Harness {
	machine: GestureMachine;
	viewport: Viewport;
}

function start(viewport: Viewport = START): Harness {
	return {
		machine: { pointers: new Map(), gesture: { type: "idle" } },
		viewport,
	};
}

function dispatch(harness: Harness, event: GestureEvent): Harness {
	const result = reduceGesture(harness.machine, event, harness.viewport);
	return {
		machine: result.machine,
		viewport: result.viewport ?? harness.viewport,
	};
}

const mouseMove = (
	id: number,
	x: number,
	y: number,
	buttons = 1,
): GestureEvent => ({
	type: "move",
	pointerId: id,
	point: { x, y },
	pointerType: "mouse",
	buttons,
});

describe("reduceGesture — pan (one pointer on empty canvas)", () => {
	it("stays dormant until the pointer passes the threshold, then pans", () => {
		let h = start();
		h = dispatch(h, {
			type: "down",
			pointerId: 1,
			point: { x: 100, y: 100 },
			target: "empty",
		});
		expect(h.machine.gesture.type).toBe("pan");

		h = dispatch(h, mouseMove(1, 100 + PAN_THRESHOLD_PX - 1, 100));
		expect(h.viewport).toEqual(START);

		h = dispatch(h, mouseMove(1, 180, 140));
		expect(h.viewport).toEqual({ scale: 1, x: 80, y: 40 });
	});

	it("does not pan when the press starts on an object", () => {
		let h = start();
		h = dispatch(h, {
			type: "down",
			pointerId: 1,
			point: { x: 10, y: 10 },
			target: "object",
		});
		expect(h.machine.gesture.type).toBe("idle");
		h = dispatch(h, mouseMove(1, 200, 200));
		expect(h.viewport).toEqual(START);
	});
});

describe("reduceGesture — pinch (two pointers)", () => {
	it("promotes to pinch and scales by the finger-distance ratio", () => {
		let h = start();
		h = dispatch(h, {
			type: "down",
			pointerId: 1,
			point: { x: 100, y: 100 },
			target: "empty",
		});
		h = dispatch(h, {
			type: "down",
			pointerId: 2,
			point: { x: 200, y: 100 },
			target: "empty",
		});
		expect(h.machine.gesture.type).toBe("pinch");

		// Spread to 200px (midpoint moves to (200,100)) → 2× about the start
		// midpoint (150,100), which then lands under the new midpoint.
		h = dispatch(h, mouseMove(2, 300, 100));
		expect(h.viewport.scale).toBe(2);
		expect(h.viewport).toEqual({ scale: 2, x: -100, y: -100 });
	});

	it("resumes panning with the remaining finger without a jump", () => {
		let h = start();
		h = dispatch(h, {
			type: "down",
			pointerId: 1,
			point: { x: 100, y: 100 },
			target: "empty",
		});
		h = dispatch(h, {
			type: "down",
			pointerId: 2,
			point: { x: 200, y: 100 },
			target: "empty",
		});
		h = dispatch(h, mouseMove(1, 150, 50));
		h = dispatch(h, mouseMove(2, 250, 50));
		const afterPinch = h.viewport;

		h = dispatch(h, { type: "up", pointerId: 2 });
		expect(h.machine.gesture.type).toBe("pan");

		h = dispatch(h, mouseMove(1, 160, 60));
		expect(h.viewport).toEqual({
			scale: afterPinch.scale,
			x: afterPinch.x + 10,
			y: afterPinch.y + 10,
		});
	});

	it("ignores a third pointer (keeps the first pair)", () => {
		let h = start();
		h = dispatch(h, {
			type: "down",
			pointerId: 1,
			point: { x: 0, y: 0 },
			target: "empty",
		});
		h = dispatch(h, {
			type: "down",
			pointerId: 2,
			point: { x: 100, y: 0 },
			target: "empty",
		});
		h = dispatch(h, {
			type: "down",
			pointerId: 3,
			point: { x: 50, y: 50 },
			target: "empty",
		});
		expect(h.machine.pointers.size).toBe(2);
		expect(h.machine.gesture.type).toBe("pinch");

		// The pinch pair is still 1 & 2 → moving them to 200px apart doubles.
		h = dispatch(h, mouseMove(2, 200, 0));
		expect(h.viewport.scale).toBe(2);

		// Lifting the ignored third pointer changes nothing.
		h = dispatch(h, { type: "up", pointerId: 3 });
		expect(h.machine.pointers.size).toBe(2);
		expect(h.machine.gesture.type).toBe("pinch");

		// Lifting a real finger resumes a pan from the current viewport — no jump.
		h = dispatch(h, { type: "up", pointerId: 1 });
		expect(h.machine.gesture.type).toBe("pan");
		const before = h.viewport;
		h = dispatch(h, mouseMove(2, 210, 10));
		expect(h.viewport).toEqual({
			scale: before.scale,
			x: before.x + 10,
			y: before.y + 10,
		});
	});
});

describe("reduceGesture — endings", () => {
	it("ends the gesture when the last pointer lifts", () => {
		let h = start();
		h = dispatch(h, {
			type: "down",
			pointerId: 1,
			point: { x: 0, y: 0 },
			target: "empty",
		});
		h = dispatch(h, { type: "up", pointerId: 1 });
		expect(h.machine.gesture.type).toBe("idle");
		expect(h.machine.pointers.size).toBe(0);
	});

	it("ends a stuck mouse drag when a move reports no buttons held", () => {
		let h = start();
		h = dispatch(h, {
			type: "down",
			pointerId: 1,
			point: { x: 0, y: 0 },
			target: "empty",
		});
		h = dispatch(h, mouseMove(1, 20, 0, 0));
		expect(h.machine.pointers.size).toBe(0);
		expect(h.machine.gesture.type).toBe("idle");
		// A later move is a no-op (pointer no longer tracked).
		h = dispatch(h, mouseMove(1, 40, 0));
		expect(h.viewport).toEqual(START);
	});

	it("cancel clears all pointers and the gesture", () => {
		let h = start();
		h = dispatch(h, {
			type: "down",
			pointerId: 1,
			point: { x: 0, y: 0 },
			target: "empty",
		});
		h = dispatch(h, {
			type: "down",
			pointerId: 2,
			point: { x: 100, y: 0 },
			target: "empty",
		});
		h = dispatch(h, { type: "cancel" });
		expect(h.machine.pointers.size).toBe(0);
		expect(h.machine.gesture.type).toBe("idle");
	});

	it("ignores moves for untracked pointers", () => {
		const h = start();
		const next = dispatch(h, mouseMove(9, 500, 500));
		expect(next.viewport).toEqual(START);
	});
});
