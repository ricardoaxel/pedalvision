import Konva from "konva";
import { useCallback, useEffect, useRef, useState } from "react";
import { Stage as KonvaStage } from "react-konva";
import { anchorIndexFor, cableEndKey } from "../lib/jackAnchor";
import { useCableDrag as useCableDragState } from "../state/cableDrag";
import { useDrag } from "../state/drag";
import { useFocus, useIsFramed } from "../state/focus";
import { useHistory } from "../state/history";
import { useReadOnly } from "../state/readOnly";
import {
	boardFootprint,
	itemsByZ,
	resolveItem,
	useScene,
} from "../state/scene";
import {
	selectSelectedBoardUid,
	selectSelectedItemUid,
	useSelection,
} from "../state/selection";
import { useSettings } from "../state/settings";
import { type Point, useViewport } from "../state/viewport";
import { BoardLayer } from "./BoardLayer";
import { CableLayer } from "./CableLayer";
import { DragLayer } from "./DragLayer";
import { EndpointLayer } from "./EndpointLayer";
import { GridLayer } from "./GridLayer";
import { imageStatusSummary, subscribeImageStatus } from "./imageStatus";
import { LooseItemLayer } from "./LooseItemLayer";
import { SelectionLayer } from "./SelectionLayer";
import { useCableDrag } from "./useCableDrag";
import { useCanvasTheme } from "./useCanvasTheme";
import { useItemDrag } from "./useItemDrag";
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
	const boards = useScene((state) => state.boards);
	const items = useScene((state) => state.items);
	const customPedals = useScene((state) => state.customPedals);
	const endpoints = useScene((state) => state.endpoints);
	const cables = useScene((state) => state.cables);
	const selectedItemUid = useSelection(selectSelectedItemUid);
	const selectedBoardUid = useSelection(selectSelectedBoardUid);
	const selectedKind = useSelection((state) => state.selection?.kind ?? "");
	const selectedUid = useSelection((state) => state.selection?.uid ?? "");
	const clearSelection = useSelection((state) => state.clearSelection);
	const setHoveredItem = useSelection((state) => state.setHoveredItem);
	const liftedItemUid = useDrag((state) => state.liftedUid);
	const liftedRotationDeg = useDrag((state) => state.liftedRotationDeg);
	const theme = useCanvasTheme();
	const showCables = useSettings((state) => state.showCables);
	const gridStepCm = useSettings((state) => state.gridStepCm);
	const readOnly = useReadOnly((state) => state.readOnly);
	const readOnlyCue = useReadOnly((state) => state.cue);
	// Undo/redo depth (P3-04) mirrored for deterministic e2e assertions.
	const undoDepth = useHistory((state) => state.past.length);
	const redoDepth = useHistory((state) => state.future.length);
	// Viewport focus (F-04) mirrored for deterministic e2e assertions.
	const framed = useIsFramed();
	const focusTarget = useFocus((state) => state.last?.target ?? "");
	const focusBounds = useFocus((state) => state.last?.bounds ?? null);

	// Debug/assertion hooks (like data-scale): board + item state mirrored onto
	// the DOM so Playwright can assert store-level outcomes without pixels.
	const rotations = boards.map((board) => board.rotationDeg).join(",");
	const positions = boards
		.map((board) => `${board.x.toFixed(2)},${board.y.toFixed(2)}`)
		.join(";");
	// Custom boards (P2-05): count + their finishes, so e2e can assert a custom
	// board was created with the chosen texture without touching pixels.
	const customBoards = boards.filter(
		(board) => board.boardRefId === null,
	).length;
	const boardTextures = boards
		.map((board) =>
			board.boardRefId === null ? (board.texture ?? "matte") : "",
		)
		.join(",");
	const boardUids = boards.map((board) => board.uid).join(",");
	const boardSizes = boards
		.map((board) => {
			const footprint = boardFootprint(board);
			return `${footprint.widthCm}x${footprint.heightCm}`;
		})
		.join(",");
	const itemParents = items
		.map((item) => {
			if (item.boardUid === null) return "loose";
			const index = boards.findIndex((board) => board.uid === item.boardUid);
			return String(index);
		})
		.join(",");
	const itemPositions = items
		.map((item) => `${item.x.toFixed(2)},${item.y.toFixed(2)}`)
		.join(";");
	const itemRotations = items
		.map((item) => item.rotationDeg.toFixed(2))
		.join(",");
	// Resolved labels (catalog → inline custom → unknown-ref fallback). A shared
	// scene with an unknown ref must still render a labeled placeholder; e2e
	// asserts this without reading pixels.
	const itemLabels = items
		.map((item) => resolveItem(item, customPedals).name)
		.join("|");
	// The actually-rendered draw order (uid list). MUST MIRROR the render layers:
	// BoardLayer draws each board (array order) with its attached items sorted by
	// z, then LooseItemLayer draws loose items sorted by z, then DragLayer draws
	// the lifted item last. A smoke test asserts a reorder + reload in this true
	// render order (P1-06), not just that the store array changed.
	const renderOrder = (() => {
		const uids: string[] = [];
		for (const board of boards) {
			for (const item of itemsByZ(
				items.filter(
					(candidate) =>
						candidate.boardUid === board.uid && candidate.uid !== liftedItemUid,
				),
			)) {
				uids.push(item.uid);
			}
		}
		for (const item of itemsByZ(
			items.filter(
				(candidate) =>
					candidate.boardUid === null && candidate.uid !== liftedItemUid,
			),
		)) {
			uids.push(item.uid);
		}
		if (liftedItemUid) uids.push(liftedItemUid);
		return uids.join(",");
	})();

	// P4-02 graph debug hooks. Anchor points are world cm so e2e can compute the
	// exact on-screen jack position from the stage transform (no pixel guessing).
	const anchorIndex = anchorIndexFor({
		boards,
		items,
		customPedals,
		endpoints,
	});
	const jackAnchors = anchorIndex.all
		.map(
			(anchor) =>
				`${anchor.key}@${anchor.point.x.toFixed(2)},${anchor.point.y.toFixed(2)}`,
		)
		.join(";");
	const endpointKinds = endpoints.map((endpoint) => endpoint.kind).join(",");
	const cableDirections = cables
		.map((cable) => {
			const label = (end: typeof cable.from) =>
				"endpointUid" in end
					? `endpoint:${end.endpointUid}`
					: `item:${end.itemUid}:${end.jack}`;
			return `${label(cable.from)}>${label(cable.to)}`;
		})
		.join(";");
	const hasAnchor = (key: string) =>
		anchorIndex.items.has(key) || anchorIndex.endpoints.has(key);
	const cableArrows = cables.filter(
		(cable) =>
			hasAnchor(cableEndKey(cable.from)) && hasAnchor(cableEndKey(cable.to)),
	).length;
	const cablePreviewKey = useCableDragState((state) =>
		state.source
			? `item:${state.source.itemUid}:${state.source.jackIndex}`
			: "",
	);
	const cableTargetKey = useCableDragState((state) =>
		state.target
			? state.target.kind === "item"
				? `item:${state.target.uid}:${state.target.jackIndex}`
				: `endpoint:${state.target.uid}`
			: "",
	);

	// Hit-test seam (gestures.ts `empty` | `object`): a press that lands on a
	// node is an object gesture (drag the board/pedal), anything else pans the
	// stage. The grid layer is non-listening, so an empty press misses every node.
	const hitTest = useCallback((point: Point) => {
		return stageRef.current?.getIntersection(point) != null;
	}, []);

	useViewportGestures(containerRef, hitTest);
	useItemDrag(containerRef);
	useCableDrag(containerRef);

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

	// `data-lifted-position` changes on every drag move; write it straight to the
	// DOM so a drag doesn't re-render the Stage (and the grid/board layers) just
	// to refresh a debug attribute — only the DragLayer re-renders. `data-lifted-item`
	// changes on lift/drop only, so it stays a normal reactive attribute.
	useEffect(() => {
		const apply = (cm: Point | null) => {
			const element = containerRef.current;
			if (!element) return;
			element.dataset.liftedPosition = cm
				? `${cm.x.toFixed(2)},${cm.y.toFixed(2)}`
				: "";
		};
		apply(useDrag.getState().liftedWorldCm);
		return useDrag.subscribe((state, prev) => {
			if (state.liftedWorldCm !== prev.liftedWorldCm) {
				apply(state.liftedWorldCm);
			}
		});
	}, []);

	// Same idea for the hover debug attribute: write it from the store so hover
	// enter/leave doesn't re-render the whole stage (SelectionLayer re-renders).
	useEffect(() => {
		const apply = (uid: string | null) => {
			const element = containerRef.current;
			if (!element) return;
			element.dataset.hoveredItem = uid ?? "";
		};
		apply(useSelection.getState().hoveredItemUid);
		return useSelection.subscribe((state, prev) => {
			if (state.hoveredItemUid !== prev.hoveredItemUid) {
				apply(state.hoveredItemUid);
			}
		});
	}, []);

	// Canvas image load statuses (P2-01 self-heal) → `data-item-images`, written
	// imperatively so an image loading never re-renders the stage.
	useEffect(() => {
		const apply = () => {
			const element = containerRef.current;
			if (!element) return;
			element.dataset.itemImages = imageStatusSummary();
		};
		apply();
		return subscribeImageStatus(apply);
	}, []);

	return (
		<div
			ref={containerRef}
			className="stage"
			data-testid="stage"
			data-scale={scale}
			data-x={x}
			data-y={y}
			data-boards={boards.length}
			data-custom-boards={customBoards}
			data-board-textures={boardTextures}
			data-board-uids={boardUids}
			data-board-sizes={boardSizes}
			data-rotations={rotations}
			data-positions={positions}
			data-items={items.length}
			data-item-parents={itemParents}
			data-item-positions={itemPositions}
			data-item-rotations={itemRotations}
			data-item-labels={itemLabels}
			data-item-order={renderOrder}
			data-readonly-cue={
				readOnlyCue ? `${readOnlyCue.kind}:${readOnlyCue.uid}` : ""
			}
			data-selected-item={selectedItemUid ?? ""}
			data-selected-board={selectedBoardUid ?? ""}
			data-selected-kind={selectedKind}
			data-selected-uid={selectedUid}
			data-lifted-item={liftedItemUid ?? ""}
			data-lifted-rotation={liftedRotationDeg ?? ""}
			data-undo-depth={undoDepth}
			data-redo-depth={redoDepth}
			data-endpoints={endpoints.length}
			data-endpoint-kinds={endpointKinds}
			data-cables={cables.length}
			data-cable-directions={cableDirections}
			data-cable-arrows={cableArrows}
			data-show-cables={showCables ? "true" : "false"}
			data-graph-visible={showCables || readOnly ? "true" : "false"}
			data-cable-preview={cablePreviewKey}
			data-cable-target={cableTargetKey}
			data-jack-anchors={jackAnchors}
			data-framed={framed ? "true" : "false"}
			data-focus-target={focusTarget}
			data-focus-bounds={
				focusBounds
					? `${focusBounds.x.toFixed(2)},${focusBounds.y.toFixed(2)},${focusBounds.widthCm.toFixed(2)},${focusBounds.heightCm.toFixed(2)}`
					: ""
			}
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
						if (event.target === event.target.getStage()) clearSelection();
					}}
					onTouchStart={(event) => {
						if (event.target === event.target.getStage()) clearSelection();
					}}
					// A pointer leaving the whole canvas must drop the hover ring.
					onMouseLeave={() => setHoveredItem(null)}
				>
					<GridLayer
						color={theme.gridDot}
						width={size.width}
						height={size.height}
						scale={scale}
						x={x}
						y={y}
						stepCm={gridStepCm}
					/>
					<BoardLayer theme={theme} />
					<LooseItemLayer theme={theme} />
					<CableLayer theme={theme} />
					<SelectionLayer theme={theme} />
					{/* Terminal tags sit above the selection Transformer so a tag
					 * near a selected pedal is still clickable; the DragLayer stays
					 * above everything. */}
					<EndpointLayer theme={theme} />
					<DragLayer theme={theme} />
				</KonvaStage>
			) : null}
		</div>
	);
}
