import type { RefObject } from "react";
import { useEffect, useRef } from "react";
import { graphAddRefusal } from "../lib/capacity";
import { type Point, pxToCm } from "../lib/geometry";
import { anchorIndexFor } from "../lib/jackAnchor";
import {
	type CableDragTarget,
	isCableTargetValid,
	useCableDrag as useCableDragStore,
} from "../state/cableDrag";
import { useGesture } from "../state/gesture";
import { isReadOnly } from "../state/readOnly";
import { cableEndHasCapacity, sameCableEnd, useScene } from "../state/scene";
import { pxToWorldCm, useViewport } from "../state/viewport";

/** Screen-px snap radius for a mouse / touch destination anchor. */
export const CABLE_SNAP_MOUSE_PX = 18;
export const CABLE_SNAP_TOUCH_PX = 44;

function localWorldCm(element: HTMLElement, client: Point): Point {
	const rect = element.getBoundingClientRect();
	const { scale, x, y } = useViewport.getState();
	return pxToWorldCm(
		{ x: client.x - rect.left, y: client.y - rect.top },
		{ scale, x, y },
	);
}

/**
 * Drives drag-connect (P4-02). A jack tick sets the transient source; this hook
 * follows the pointer, resolves the nearest jack/endpoint inside the snap radius
 * (from the memoized anchor index — never a render-loop scan per frame), and
 * commits **one** `addCable` on release. Pan/pinch, Esc, blur and pointercancel
 * cancel without touching the scene.
 */
export function useCableDrag(
	containerRef: RefObject<HTMLElement | null>,
): void {
	const pointerIdRef = useRef<number | null>(null);

	useEffect(() => {
		const element = containerRef.current;
		if (!element) return;

		const onNativePointerDown = (event: PointerEvent) => {
			pointerIdRef.current = event.pointerId;
		};

		const nearestTarget = (
			client: Point,
			pointerType: string,
		): CableDragTarget | null => {
			const drag = useCableDragStore.getState();
			const source = drag.source;
			if (!source) return null;
			const scene = useScene.getState();
			const index = anchorIndexFor(scene);
			const pointer = localWorldCm(element, client);
			const scale = useViewport.getState().scale;
			const snapPx =
				pointerType === "touch" ? CABLE_SNAP_TOUCH_PX : CABLE_SNAP_MOUSE_PX;
			const snapCm = pxToCm(snapPx / Math.max(scale, 0.0001));
			const sourceKey = `item:${source.itemUid}:${source.jackIndex}`;
			let best: {
				anchor: (typeof index.all)[number];
				distance: number;
			} | null = null;
			for (const anchor of index.all) {
				if (anchor.key === sourceKey) continue;
				const distance = Math.hypot(
					anchor.point.x - pointer.x,
					anchor.point.y - pointer.y,
				);
				if (distance > snapCm) continue;
				if (!best || distance < best.distance) best = { anchor, distance };
			}
			if (!best) return null;
			const target: CableDragTarget =
				best.anchor.jackIndex !== undefined
					? {
							kind: "item",
							uid: best.anchor.uid,
							jackIndex: best.anchor.jackIndex,
						}
					: { kind: "endpoint", uid: best.anchor.uid };
			if (!isCableTargetValid(source, target)) return null;
			// The destination must have a free socket (mono = 1, TRS = 2, endpoint
			// = 1); an occupied target never snaps.
			const end =
				target.kind === "item"
					? { itemUid: target.uid, jack: String(target.jackIndex) }
					: { endpointUid: target.uid };
			return cableEndHasCapacity(
				end,
				scene.cables,
				scene.items,
				scene.endpoints,
				scene.customPedals,
			)
				? target
				: null;
		};

		const onMove = (event: PointerEvent) => {
			const drag = useCableDragStore.getState();
			if (!drag.source) return;
			if (
				pointerIdRef.current !== null &&
				event.pointerId !== pointerIdRef.current
			) {
				return;
			}
			if (event.pointerType !== "touch" && event.buttons === 0) {
				drag.cancel();
				return;
			}
			const client = { x: event.clientX, y: event.clientY };
			// One update per move; `update` reuses the target reference when the
			// snapped jack is unchanged, so subscribers don't fan out.
			drag.update(
				localWorldCm(element, client),
				nearestTarget(client, event.pointerType),
			);
		};

		const finish = () => {
			const drag = useCableDragStore.getState();
			const { source, target } = drag;
			if (
				source &&
				target &&
				!isReadOnly() &&
				isCableTargetValid(source, target)
			) {
				const from = {
					itemUid: source.itemUid,
					jack: String(source.jackIndex),
				};
				const to =
					target.kind === "item"
						? { itemUid: target.uid, jack: String(target.jackIndex) }
						: { endpointUid: target.uid };
				const scene = useScene.getState();
				const duplicate = scene.cables.some(
					(cable) =>
						(sameCableEnd(cable.from, from) && sameCableEnd(cable.to, to)) ||
						(sameCableEnd(cable.from, to) && sameCableEnd(cable.to, from)),
				);
				const uid = scene.addCable(from, to);
				if (!uid) {
					// Never fail silently: the duplicate/graph-cap refusal is inline.
					drag.cancel();
					drag.setNotice(
						duplicate
							? "Those jacks are already connected."
							: (graphAddRefusal(scene) ?? "Couldn’t connect those jacks."),
					);
					return;
				}
			}
			drag.cancel();
		};

		const onUp = (event: PointerEvent) => {
			const drag = useCableDragStore.getState();
			if (!drag.source) return;
			if (
				pointerIdRef.current !== null &&
				event.pointerId !== pointerIdRef.current
			) {
				return;
			}
			finish();
		};

		const onCancel = (event: PointerEvent) => {
			const drag = useCableDragStore.getState();
			if (!drag.source) return;
			if (
				pointerIdRef.current !== null &&
				event.pointerId !== pointerIdRef.current
			) {
				return;
			}
			drag.cancel();
		};

		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return;
			if (!useCableDragStore.getState().source) return;
			event.preventDefault();
			useCableDragStore.getState().cancel();
		};

		window.addEventListener("pointerdown", onNativePointerDown, true);
		window.addEventListener("pointermove", onMove);
		window.addEventListener("pointerup", onUp);
		window.addEventListener("pointercancel", onCancel);
		window.addEventListener("blur", finish);
		window.addEventListener("keydown", onKeyDown);

		// Pan/pinch wins: cancel the connection preview, never commit.
		const unsubNavigate = useGesture.subscribe((state, prev) => {
			if (state.navigating && !prev.navigating) {
				useCableDragStore.getState().cancel();
			}
		});

		return () => {
			unsubNavigate();
			window.removeEventListener("pointerdown", onNativePointerDown, true);
			window.removeEventListener("pointermove", onMove);
			window.removeEventListener("pointerup", onUp);
			window.removeEventListener("pointercancel", onCancel);
			window.removeEventListener("blur", finish);
			window.removeEventListener("keydown", onKeyDown);
		};
	}, [containerRef]);
}
