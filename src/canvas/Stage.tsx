import Konva from "konva";
import { useCallback, useEffect, useRef, useState } from "react";
import { Stage as KonvaStage } from "react-konva";
import { useScene } from "../state/scene";
import { useSelection } from "../state/selection";
import { type Point, useViewport } from "../state/viewport";
import { BoardLayer } from "./BoardLayer";
import { GridLayer } from "./GridLayer";
import { useCanvasTheme } from "./useCanvasTheme";
import { useViewportGestures } from "./useViewportGestures";

// Enable hit detection while dragging (task note). Harmless with no draggable
// objects yet; required once P1-03/P1-04 add board/pedal dragging.
Konva.hitOnDragEnabled = true;

interface Size {
	width: number;
	height: number;
}

/**
 * The canvas host: a Konva `Stage` that fills its container and owns the
 * viewport (pan/zoom) as a stage transform (design.md §Canvas architecture).
 *
 * Sizing is driven by a ResizeObserver — Konva doesn't resize its stage on its
 * own (ADR-001 risk 4). The stage transform comes straight from the viewport
 * store; world positions never depend on the container size, so a resize can't
 * move anything (A1).
 */
export function Stage() {
	const containerRef = useRef<HTMLDivElement>(null);
	const stageRef = useRef<Konva.Stage>(null);
	const [size, setSize] = useState<Size>({ width: 0, height: 0 });

	const scale = useViewport((state) => state.scale);
	const x = useViewport((state) => state.x);
	const y = useViewport((state) => state.y);
	const setSizeInStore = useViewport((state) => state.setSize);
	const boardCount = useScene((state) => state.boards.length);
	// Rotation + positions per board — debug/assertion hooks (like data-scale).
	const rotations = useScene((state) =>
		state.boards.map((board) => board.rotationDeg).join(","),
	);
	const positions = useScene((state) =>
		state.boards
			.map((board) => `${board.x.toFixed(2)},${board.y.toFixed(2)}`)
			.join(";"),
	);
	const selectBoard = useSelection((state) => state.selectBoard);
	const theme = useCanvasTheme();

	// Hit-test seam (gestures.ts `empty` | `object`): a press that lands on a
	// node is an object gesture (drag the board), anything else pans the stage.
	// The grid layer is non-listening, so an empty press misses every node.
	const hitTest = useCallback((point: Point) => {
		return stageRef.current?.getIntersection(point) != null;
	}, []);

	useViewportGestures(containerRef, hitTest);

	useEffect(() => {
		const element = containerRef.current;
		if (!element) return;
		const observer = new ResizeObserver((entries) => {
			const rect = entries[0]?.contentRect;
			if (!rect) return;
			const next = {
				width: Math.round(rect.width),
				height: Math.round(rect.height),
			};
			setSize(next);
			setSizeInStore(next);
		});
		observer.observe(element);
		return () => observer.disconnect();
	}, [setSizeInStore]);

	return (
		<div
			ref={containerRef}
			className="stage"
			data-testid="stage"
			data-scale={scale}
			data-x={x}
			data-y={y}
			data-boards={boardCount}
			data-rotations={rotations}
			data-positions={positions}
		>
			{size.width > 0 && size.height > 0 ? (
				<KonvaStage
					ref={stageRef}
					width={size.width}
					height={size.height}
					x={x}
					y={y}
					scaleX={scale}
					scaleY={scale}
					// Tapping empty space clears the selection (Konva target ===
					// stage means no node was hit).
					onMouseDown={(event) => {
						if (event.target === event.target.getStage()) selectBoard(null);
					}}
					onTouchStart={(event) => {
						if (event.target === event.target.getStage()) selectBoard(null);
					}}
				>
					<GridLayer
						color={theme.gridDot}
						width={size.width}
						height={size.height}
						scale={scale}
						x={x}
						y={y}
					/>
					<BoardLayer theme={theme} />
				</KonvaStage>
			) : null}
		</div>
	);
}
