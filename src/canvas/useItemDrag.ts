import type { RefObject } from "react";
import { useEffect, useRef } from "react";
import { useDrag } from "../state/drag";
import { useGesture } from "../state/gesture";
import { pointerGrabOffset, useScene } from "../state/scene";
import { type Point, pxToWorldCm, useViewport } from "../state/viewport";

/** Screen px the pointer may travel before a press becomes a pedal drag. */
export const ITEM_DRAG_THRESHOLD_PX = 4;

interface PendingDrag {
	uid: string;
	/** The pointer that started the drag; other pointers' moves are ignored. */
	pointerId: number | null;
	/** Client-space pointer position where the press began. */
	startClient: Point;
	/** Press offset in the item's unrotated frame (see `pointerGrabOffset`). */
	grabOffsetCm: Point;
}

/**
 * Drives cross-board pedal dragging (design.md §Canvas architecture → DragLayer),
 * deliberately without Konva's built-in `draggable`: lifting an item into the
 * DragLayer unmounts/remounts its node across React trees, which would kill a
 * live Konva drag. Instead this hook follows the pointer on the window:
 *
 * - pointer-down on a pedal (`useDrag.beginCandidate`) captures the grab offset;
 * - past {@link ITEM_DRAG_THRESHOLD_PX} the item lifts into the DragLayer and
 *   tracks the pointer in world cm;
 * - on release it re-parents via `scene.dropItem` (topmost board hit-test, or loose);
 * - a two-finger pan (`state/gesture.navigating`) drops the item **in place**
 *   (R6/N3) instead of snapping back.
 *
 * Object presses never pan (the gesture reducer sees `target: "object"`), so the
 * viewport stays put for the whole single-pointer drag.
 *
 * Copilot review (2026-10-15) hardening: a candidate is rejected while the
 * viewport is navigating (a finger landing on a pedal mid-pan); the drag is
 * bound to the initiating pointer so a stray second pointer can't move/commit
 * it; and a non-touch move with no buttons held (released off-window) ends it —
 * matching `gestures.ts`.
 */
export function useItemDrag(containerRef: RefObject<HTMLElement | null>): void {
	const pendingRef = useRef<PendingDrag | null>(null);
	// Native pointer id of the most recent pointerdown (capture phase), paired
	// with the candidate the Konva handler creates synchronously after it.
	const nativePointerRef = useRef<number | null>(null);

	useEffect(() => {
		const element = containerRef.current;
		if (!element) return;

		const localWorldCm = (client: Point): Point => {
			const rect = element.getBoundingClientRect();
			const { scale, x, y } = useViewport.getState();
			return pxToWorldCm(
				{ x: client.x - rect.left, y: client.y - rect.top },
				{ scale, x, y },
			);
		};

		const onNativePointerDown = (event: PointerEvent) => {
			nativePointerRef.current = event.pointerId;
		};

		const unsubCandidate = useDrag.subscribe((state, prev) => {
			if (state.candidate && state.candidate !== prev.candidate) {
				// A press during navigation (e.g. a finger landing on a pedal while
				// another pans/pinches) must not start a drag: cancellation only
				// fires on the idle→navigating edge, which already passed.
				if (useGesture.getState().navigating) {
					pendingRef.current = null;
					useDrag.getState().clear();
					return;
				}
				const { uid, startClient } = state.candidate;
				const { items, boards } = useScene.getState();
				const item = items.find((candidate) => candidate.uid === uid);
				if (!item) {
					pendingRef.current = null;
					return;
				}
				const pointerWorld = localWorldCm(startClient);
				pendingRef.current = {
					uid,
					pointerId: nativePointerRef.current,
					startClient,
					grabOffsetCm: pointerGrabOffset(item, boards, pointerWorld),
				};
			}
		});

		const originFromPointer = (client: Point, grabOffsetCm: Point): Point => {
			const pointerWorld = localWorldCm(client);
			return {
				x: pointerWorld.x - grabOffsetCm.x,
				y: pointerWorld.y - grabOffsetCm.y,
			};
		};

		const onMove = (event: PointerEvent) => {
			const pending = pendingRef.current;
			if (!pending) return;
			// Only the pointer that started the drag may move it.
			if (pending.pointerId !== null && event.pointerId !== pending.pointerId) {
				return;
			}
			// A non-touch move without buttons means the release was missed (e.g.
			// released off-window): end the drag instead of ghost-moving it.
			if (event.pointerType !== "touch" && event.buttons === 0) {
				finish();
				return;
			}
			const client = { x: event.clientX, y: event.clientY };
			const drag = useDrag.getState();
			if (!drag.liftedUid) {
				const moved = Math.hypot(
					client.x - pending.startClient.x,
					client.y - pending.startClient.y,
				);
				if (moved < ITEM_DRAG_THRESHOLD_PX) return;
				drag.lift(pending.uid, originFromPointer(client, pending.grabOffsetCm));
				return;
			}
			drag.setLiftedWorldCm(originFromPointer(client, pending.grabOffsetCm));
		};

		const finish = () => {
			const drag = useDrag.getState();
			if (drag.liftedUid && drag.liftedWorldCm) {
				useScene.getState().dropItem(drag.liftedUid, drag.liftedWorldCm);
			}
			drag.clear();
			pendingRef.current = null;
		};

		const onUp = (event: PointerEvent) => {
			const pending = pendingRef.current;
			if (!pending) return;
			if (pending.pointerId !== null && event.pointerId !== pending.pointerId) {
				return;
			}
			finish();
		};
		const onCancel = (event: PointerEvent) => {
			const pending = pendingRef.current;
			if (!pending) return;
			if (pending.pointerId !== null && event.pointerId !== pending.pointerId) {
				return;
			}
			finish();
		};
		const onBlur = () => finish();

		window.addEventListener("pointerdown", onNativePointerDown, true);
		window.addEventListener("pointermove", onMove);
		window.addEventListener("pointerup", onUp);
		window.addEventListener("pointercancel", onCancel);
		window.addEventListener("blur", onBlur);

		// Pan/pinch takes the gesture over: drop the lifted item in place.
		const unsubNavigate = useGesture.subscribe((state, prev) => {
			if (state.navigating && !prev.navigating) finish();
		});

		return () => {
			unsubCandidate();
			unsubNavigate();
			window.removeEventListener("pointerdown", onNativePointerDown, true);
			window.removeEventListener("pointermove", onMove);
			window.removeEventListener("pointerup", onUp);
			window.removeEventListener("pointercancel", onCancel);
			window.removeEventListener("blur", onBlur);
		};
	}, [containerRef]);
}
