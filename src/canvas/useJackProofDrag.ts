import type { RefObject } from "react";
import { useEffect, useRef } from "react";
import { type Point, pxToCm } from "../lib/geometry";
import {
	clamp01,
	jackPointNormalized,
	nudgeNormalized,
	quantize,
	snapToBoundary,
	worldToNormalized,
} from "../lib/jackProof";
import { useJackProof } from "../state/jackProof";
import { isReadOnly } from "../state/readOnly";
import {
	itemFootprint,
	resolveItem,
	resolveItemJacks,
	useScene,
} from "../state/scene";
import { pxToWorldCm, useViewport } from "../state/viewport";

/** Screen-px movement before a press becomes a drag (tap = select). */
export const JACK_PROOF_DRAG_THRESHOLD_PX = 4;
/** Soft edge snap radius in screen px (Alt suppresses it). */
export const JACK_PROOF_SNAP_PX = 5;

function localWorldCm(element: HTMLElement, client: Point): Point {
	const rect = element.getBoundingClientRect();
	const { scale, x, y } = useViewport.getState();
	return pxToWorldCm(
		{ x: client.x - rect.left, y: client.y - rect.top },
		{ scale, x, y },
	);
}

function worldToItemNormalized(
	uid: string,
	world: Point,
): {
	point: { x: number; y: number };
	footprint: { widthCm: number; heightCm: number };
} | null {
	const { items, boards, customPedals } = useScene.getState();
	const item = items.find((candidate) => candidate.uid === uid);
	if (!item) return null;
	const footprint = itemFootprint(item, customPedals);
	const board = item.boardUid
		? boards.find((candidate) => candidate.uid === item.boardUid)
		: undefined;
	const point = worldToNormalized(
		world,
		{
			x: item.x,
			y: item.y,
			rotationDeg: item.rotationDeg,
			board: board
				? { x: board.x, y: board.y, rotationDeg: board.rotationDeg }
				: undefined,
		},
		footprint,
	);
	return { point, footprint };
}

/**
 * Drives the on-pedal jack drag (F-33 “Press Proof”): the pin follows the
 * pointer in real time, a soft edge snap only near a boundary, and one
 * `setJackOverride` commits on release. Esc/cancel/pointercancel revert the
 * transient without touching history.
 */
export function useJackProofDrag(
	containerRef: RefObject<HTMLElement | null>,
): void {
	const pointerIdRef = useRef<number | null>(null);
	const startClientRef = useRef<Point | null>(null);

	useEffect(() => {
		const element = containerRef.current;
		if (!element) return;

		const onPointerDown = (event: PointerEvent) => {
			pointerIdRef.current = event.pointerId;
			startClientRef.current = { x: event.clientX, y: event.clientY };
		};

		const onMove = (event: PointerEvent) => {
			const drag = useJackProof.getState().drag;
			if (!drag) return;
			if (
				pointerIdRef.current !== null &&
				event.pointerId !== pointerIdRef.current
			) {
				return;
			}
			if (event.pointerType !== "touch" && event.buttons === 0) {
				useJackProof.getState().cancelDrag();
				return;
			}
			const start = startClientRef.current;
			const client = { x: event.clientX, y: event.clientY };
			const moved =
				drag.moved ||
				!start ||
				Math.hypot(client.x - start.x, client.y - start.y) >=
					JACK_PROOF_DRAG_THRESHOLD_PX;
			const world = localWorldCm(element, client);
			const resolved = worldToItemNormalized(drag.uid, world);
			if (!resolved) return;
			const { footprint } = resolved;
			let point = {
				x: clamp01(resolved.point.x),
				y: clamp01(resolved.point.y),
			};
			const scale = useViewport.getState().scale;
			const thresholdCm = pxToCm(JACK_PROOF_SNAP_PX / Math.max(scale, 0.0001));
			if (!event.altKey) {
				const snap = snapToBoundary(point, footprint, thresholdCm);
				if (snap) point = snap.point;
			}
			useJackProof
				.getState()
				.setDrag(quantize(point.x), quantize(point.y), moved);
		};

		const finish = (commit: boolean) => {
			const state = useJackProof.getState();
			const drag = state.drag;
			if (!drag) return;
			startClientRef.current = null;
			if (!commit || !drag.moved) {
				state.cancelDrag();
				return;
			}
			if (isReadOnly()) {
				state.cancelDrag();
				return;
			}
			const result = useScene
				.getState()
				.setJackOverride(drag.uid, drag.jack, { x: drag.x, y: drag.y });
			if (!result.ok) {
				state.setNotice(
					result.reason ?? "That correction couldn’t be applied.",
				);
				state.cancelDrag();
				return;
			}
			state.setNotice(null);
			state.endDrag();
		};

		const onPointerUp = (event: PointerEvent) => {
			if (
				pointerIdRef.current !== null &&
				event.pointerId !== pointerIdRef.current
			) {
				return;
			}
			if (useJackProof.getState().drag) finish(true);
		};

		const onPointerCancel = () => finish(false);
		const onBlur = () => finish(false);
		const onKeyDown = (event: KeyboardEvent) => {
			const state = useJackProof.getState();
			if (event.key !== "Escape") return;
			if (state.drag) {
				event.preventDefault();
				state.cancelDrag();
				return;
			}
			if (state.activeUid) {
				event.preventDefault();
				state.exit();
			}
		};

		window.addEventListener("pointerdown", onPointerDown, true);
		window.addEventListener("pointermove", onMove, { passive: true });
		window.addEventListener("pointerup", onPointerUp);
		window.addEventListener("pointercancel", onPointerCancel);
		window.addEventListener("blur", onBlur);
		window.addEventListener("keydown", onKeyDown);
		return () => {
			window.removeEventListener("pointerdown", onPointerDown, true);
			window.removeEventListener("pointermove", onMove);
			window.removeEventListener("pointerup", onPointerUp);
			window.removeEventListener("pointercancel", onPointerCancel);
			window.removeEventListener("blur", onBlur);
			window.removeEventListener("keydown", onKeyDown);
		};
	}, [containerRef]);

	// Expose keyboard nudging for the ledger's selected row (0.2 cm / Shift 1 cm).
	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			const state = useJackProof.getState();
			if (!state.activeUid || state.selectedJack === null || state.drag) return;
			if (
				event.key !== "ArrowLeft" &&
				event.key !== "ArrowRight" &&
				event.key !== "ArrowUp" &&
				event.key !== "ArrowDown"
			) {
				return;
			}
			const target = event.target as HTMLElement | null;
			if (
				target &&
				(target.isContentEditable ||
					/^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(target.tagName))
			) {
				return;
			}
			const scene = useScene.getState();
			const item = scene.items.find(
				(candidate) => candidate.uid === state.activeUid,
			);
			if (!item) return;
			const resolved = resolveItem(item, scene.customPedals);
			if (!resolved.definition) return;
			const jack = resolveItemJacks(item, scene.customPedals)[
				state.selectedJack
			];
			if (!jack) return;
			event.preventDefault();
			const stepCm = event.shiftKey ? 1 : 0.2;
			const footprint = itemFootprint(item, scene.customPedals);
			const point = jackPointNormalized(jack, footprint);
			const dx =
				event.key === "ArrowLeft"
					? -stepCm
					: event.key === "ArrowRight"
						? stepCm
						: 0;
			const dy =
				event.key === "ArrowUp"
					? -stepCm
					: event.key === "ArrowDown"
						? stepCm
						: 0;
			const next = nudgeNormalized(point, dx, dy, footprint);
			const result = scene.setJackOverride(
				state.activeUid,
				state.selectedJack,
				{
					x: next.x,
					y: next.y,
				},
			);
			if (result.ok) state.setNotice(null);
			else
				state.setNotice(
					result.reason ?? "That correction couldn’t be applied.",
				);
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, []);
}
