import type { PointerEvent as ReactPointerEvent } from "react";
import { useRef } from "react";
import { PX_PER_CM } from "../lib/geometry";
import {
	distanceCm,
	formatGridCell,
	formatMeasureDistance,
	snapMeasurePoint,
} from "../lib/measure";
import { useIsMobile } from "../lib/useMobile";
import { useMeasure } from "../state/measure";
import { useScene } from "../state/scene";
import { useSettings } from "../state/settings";
import { pxToWorldCm, useViewport } from "../state/viewport";

/**
 * Transient measure mode: drag on the canvas to draw a true-length line with a
 * live cm/in chip. Endpoints snap to board/item corners and centres, jacks,
 * endpoints, then the current grid cell. Esc/clear; never persisted or shared.
 */
export function MeasureOverlay() {
	const active = useMeasure((state) => state.active);
	const start = useMeasure((state) => state.start);
	const end = useMeasure((state) => state.end);
	const boards = useScene((state) => state.boards);
	const items = useScene((state) => state.items);
	const customPedals = useScene((state) => state.customPedals);
	const endpoints = useScene((state) => state.endpoints);
	const scale = useViewport((state) => state.scale);
	const vx = useViewport((state) => state.x);
	const vy = useViewport((state) => state.y);
	const size = useViewport((state) => state.size);
	const units = useSettings((state) => state.units);
	const isMobile = useIsMobile();
	const dragging = useRef(false);

	if (!active || size.width <= 0 || size.height <= 0) return null;

	const toScreen = (point: { x: number; y: number }) => ({
		x: point.x * PX_PER_CM * scale + vx,
		y: point.y * PX_PER_CM * scale + vy,
	});
	const begin = start ? toScreen(start) : null;
	const finish = end ? toScreen(end) : null;
	const measured =
		start && end ? formatMeasureDistance(distanceCm(start, end), units) : null;
	const mid =
		begin && finish
			? { x: (begin.x + finish.x) / 2, y: (begin.y + finish.y) / 2 }
			: null;
	const grid = formatGridCell(scale);

	const snapAt = (event: ReactPointerEvent<HTMLDivElement>) => {
		const rect = event.currentTarget.getBoundingClientRect();
		const world = pxToWorldCm(
			{ x: event.clientX - rect.left, y: event.clientY - rect.top },
			{ scale, x: vx, y: vy },
		);
		return snapMeasurePoint(
			world,
			scale,
			event.pointerType === "touch" ? 24 : 12,
			{ boards, items, customPedals, endpoints },
		);
	};

	const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
		if (event.button !== 0) return;
		event.preventDefault();
		event.stopPropagation();
		const snap = snapAt(event);
		event.currentTarget.setPointerCapture(event.pointerId);
		dragging.current = true;
		useMeasure.getState().startAt(snap.point, snap.kind);
	};

	const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
		if (!dragging.current) return;
		event.preventDefault();
		const snap = snapAt(event);
		useMeasure.getState().moveTo(snap.point, snap.kind);
	};

	const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
		if (!dragging.current) return;
		const snap = snapAt(event);
		useMeasure.getState().moveTo(snap.point, snap.kind);
		dragging.current = false;
		if (event.currentTarget.hasPointerCapture(event.pointerId)) {
			event.currentTarget.releasePointerCapture(event.pointerId);
		}
	};

	return (
		<div
			className="measure-overlay"
			data-testid="measure-overlay"
			onPointerDown={onPointerDown}
			onPointerMove={onPointerMove}
			onPointerUp={onPointerUp}
			onPointerCancel={onPointerUp}
		>
			<div
				className="measure-status"
				data-testid="measure-status"
				onPointerDown={(event) => event.stopPropagation()}
			>
				<span>
					Drag to measure · {grid} cm grid
					{isMobile ? "" : " · Esc to exit"}
				</span>
				<button
					type="button"
					className="measure-status__clear"
					data-testid="measure-clear"
					onClick={() => useMeasure.getState().clear()}
				>
					Clear line
				</button>
			</div>
			{begin && finish ? (
				<svg
					className="measure-overlay__svg"
					width={size.width}
					height={size.height}
					aria-hidden="true"
				>
					<line
						x1={begin.x}
						y1={begin.y}
						x2={finish.x}
						y2={finish.y}
						stroke="var(--color-canvas-bg)"
						strokeWidth={5}
						strokeLinecap="round"
					/>
					<line
						x1={begin.x}
						y1={begin.y}
						x2={finish.x}
						y2={finish.y}
						stroke="var(--color-ink)"
						strokeWidth={2.5}
						strokeDasharray="6 4"
						strokeLinecap="round"
					/>
					<circle cx={begin.x} cy={begin.y} r={3} fill="var(--color-ink)" />
					<circle cx={finish.x} cy={finish.y} r={3} fill="var(--color-ink)" />
				</svg>
			) : null}
			{measured && mid ? (
				<div
					className="measure-chip"
					data-testid="measure-chip"
					style={{ left: mid.x, top: mid.y }}
				>
					{measured}
				</div>
			) : null}
		</div>
	);
}
