import type { RefObject } from "react";
import { useEffect, useRef } from "react";
import { useDrag } from "../state/drag";
import { useGesture } from "../state/gesture";
import { itemWorldOrigin, useScene } from "../state/scene";
import { type Point, pxToWorldCm, useViewport } from "../state/viewport";

/** Screen px the pointer may travel before a press becomes a pedal drag. */
export const ITEM_DRAG_THRESHOLD_PX = 4;

interface PendingDrag {
	uid: string;
	/** Client-space pointer position where the press began. */
	startClient: Point;
	/** `itemWorldOrigin − pointerWorld` at press time, so the grab point sticks. */
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
 */
export function useItemDrag(containerRef: RefObject<HTMLElement | null>): void {
	const pendingRef = useRef<PendingDrag | null>(null);

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

		const unsubCandidate = useDrag.subscribe((state, prev) => {
			if (state.candidate && state.candidate !== prev.candidate) {
				const { uid, startClient } = state.candidate;
				const { items, boards } = useScene.getState();
				const item = items.find((candidate) => candidate.uid === uid);
				if (!item) {
					pendingRef.current = null;
					return;
				}
				const origin = itemWorldOrigin(item, boards);
				const pointerWorld = localWorldCm(startClient);
				pendingRef.current = {
					uid,
					startClient,
					grabOffsetCm: {
						x: origin.x - pointerWorld.x,
						y: origin.y - pointerWorld.y,
					},
				};
			}
		});

		const originFromPointer = (client: Point, grabOffsetCm: Point): Point => {
			const pointerWorld = localWorldCm(client);
			return {
				x: pointerWorld.x + grabOffsetCm.x,
				y: pointerWorld.y + grabOffsetCm.y,
			};
		};

		const onMove = (event: PointerEvent) => {
			const pending = pendingRef.current;
			if (!pending) return;
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

		const onUp = () => finish();
		const onCancel = () => finish();
		const onBlur = () => finish();

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
			window.removeEventListener("pointermove", onMove);
			window.removeEventListener("pointerup", onUp);
			window.removeEventListener("pointercancel", onCancel);
			window.removeEventListener("blur", onBlur);
		};
	}, [containerRef]);
}
