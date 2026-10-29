import type Konva from "konva";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	Group,
	Image as KonvaImage,
	Layer,
	Rect,
	Transformer,
} from "react-konva";
import { cmToPx, pxToCm } from "../lib/geometry";
import { MOTION, motionMs } from "../lib/motion";
import { useBoardDrag } from "../state/boardDrag";
import { useDrag } from "../state/drag";
import { useGesture } from "../state/gesture";
import { type DepartingBoard, useMotion } from "../state/motion";
import { useReadOnly } from "../state/readOnly";
import { itemsByZ, useScene } from "../state/scene";
import {
	selectSelectedBoardUid,
	selectSelectedItemUid,
	useSelection,
} from "../state/selection";
import type { CanvasTheme } from "../styles/theme";
import { BoardNode } from "./BoardNode";
import { useImage } from "./useImage";

interface BoardLayerProps {
	theme: CanvasTheme;
}

/**
 * The board layer (design.md §Canvas architecture): one Group per board, plus a
 * Transformer attached to the selected board. Each board group owns its
 * attached pedals, so board transforms carry them for free and z-order is
 * scoped per container. Boards stack by array order — later-placed boards
 * render on top (S6; user reordering is v2).
 *
 * The board Transformer only exposes the rotate handle for now (no resize
 * anchors): board footprints come from the catalog and aren't resizable. Any-angle
 * rotation is the point (design.md → free rotation); polished touch anchors +
 * on-selection action buttons are P1-05.
 */
export function BoardLayer({ theme }: BoardLayerProps) {
	const boards = useScene((state) => state.boards);
	const items = useScene((state) => state.items);
	const selectedUid = useSelection(selectSelectedBoardUid);
	const selectedItemUid = useSelection(selectSelectedItemUid);
	const moveBoard = useScene((state) => state.moveBoard);
	const rotateBoard = useScene((state) => state.rotateBoard);
	// The lifted item renders in the DragLayer, not in its board group.
	const liftedUid = useDrag((state) => state.liftedUid);
	// Suppress rotation while the viewport owns the gesture (pan/pinch).
	const navigating = useGesture((state) => state.navigating);
	const readOnly = useReadOnly((state) => state.readOnly);
	// While the board is dragged (not rotated), hide the rotate handle so it
	// doesn't float away from the moving board (design-review note, 2026-10-21).
	const boardDragging = useBoardDrag(
		(state) =>
			selectedUid !== null &&
			state.uid === selectedUid &&
			state.kind === "drag",
	);

	const transformerRef = useRef<Konva.Transformer>(null);
	const nodesRef = useRef(new Map<string, Konva.Group>());
	// The board being transformed, captured at transformstart so a live
	// rotation can be committed even if the selection is cleared mid-transform
	// (e.g. a second finger lands on empty canvas).
	const transformingUidRef = useRef<string | null>(null);

	const registerNode = useCallback((uid: string, node: Konva.Group | null) => {
		if (node) nodesRef.current.set(uid, node);
		else nodesRef.current.delete(uid);
	}, []);

	const commitNode = useCallback(
		(node: Konva.Node, uid: string) => {
			rotateBoard(uid, node.rotation());
			moveBoard(uid, pxToCm(node.x()), pxToCm(node.y()));
		},
		[moveBoard, rotateBoard],
	);

	// Commit a live transformer transform (if any) before detaching it, so an
	// interrupted rotation isn't lost. Uses the captured uid, not `selectedUid`.
	const commitActiveTransform = useCallback(() => {
		const transformer = transformerRef.current;
		if (!transformer?.isTransforming()) return;
		const node = transformer.nodes()[0];
		const uid = transformingUidRef.current;
		transformer.stopTransform();
		transformingUidRef.current = null;
		if (node && uid) commitNode(node, uid);
		useBoardDrag.getState().clear();
	}, [commitNode]);

	// Attach the Transformer to the selected board's node. Runs after the child
	// BoardNode effects have registered the node (child effects fire first), so a
	// selection that exists before mount still attaches. Before detaching (navigating,
	// or the selection/board going away) any live transform is committed. `boards`
	// is in the deps so removing the selected board detaches; drags commit on
	// dragend, so this does not re-run per pointer-move.
	useEffect(() => {
		const transformer = transformerRef.current;
		if (!transformer) return;
		if (navigating || readOnly) {
			commitActiveTransform();
			// Keep the nodes attached (identity preserved) but non-interactive.
			return;
		}
		const board = boards.find((candidate) => candidate.uid === selectedUid);
		const node = board ? nodesRef.current.get(board.uid) : undefined;
		if (!node) commitActiveTransform();
		transformer.nodes(node ? [node] : []);
	}, [selectedUid, boards, navigating, readOnly, commitActiveTransform]);

	// A single transform gesture writes both rotation and any origin shift
	// (rotating about the node centre moves the top-left origin).
	const handleTransformEnd = useCallback(() => {
		const node = transformerRef.current?.nodes()[0];
		const uid = transformingUidRef.current ?? selectedUid;
		transformingUidRef.current = null;
		if (node && uid) commitNode(node, uid);
		useBoardDrag.getState().clear();
	}, [commitNode, selectedUid]);

	return (
		<Layer>
			{boards.map((board) => (
				<BoardNode
					key={board.uid}
					board={board}
					theme={theme}
					items={itemsByZ(
						items.filter(
							(item) => item.boardUid === board.uid && item.uid !== liftedUid,
						),
					)}
					selectedItemUid={selectedItemUid}
					registerNode={registerNode}
				/>
			))}
			<BoardGhostLayer theme={theme} />
			<Transformer
				ref={transformerRef}
				enabledAnchors={[]}
				rotateEnabled={!boardDragging}
				listening={!navigating && !readOnly}
				onTransformStart={() => {
					transformingUidRef.current = selectedUid;
					const node = transformerRef.current?.nodes()[0];
					if (node && selectedUid) {
						useBoardDrag.getState().begin({
							uid: selectedUid,
							x: pxToCm(node.x()),
							y: pxToCm(node.y()),
							rotationDeg: node.rotation(),
							kind: "transform",
						});
					}
				}}
				onTransform={() => {
					const node = transformerRef.current?.nodes()[0];
					if (!node) return;
					useBoardDrag.getState().set({
						x: pxToCm(node.x()),
						y: pxToCm(node.y()),
						rotationDeg: node.rotation(),
						kind: "transform",
					});
				}}
				onTransformEnd={handleTransformEnd}
				borderStroke={theme.selectionStrong}
				borderStrokeWidth={1.5}
				anchorStroke={theme.selectionStrong}
				anchorFill={theme.canvasBackground}
				anchorSize={9}
				rotateAnchorOffset={28}
				ignoreStroke
			/>
		</Layer>
	);
}

/**
 * F-05 "Press Fit" — a removed board leaves only a short silhouette ghost. The
 * attached pedals are freed to the loose layer by `removeBoard` and are NOT
 * duplicated here (that would double-expose them). The board image is already
 * in the module image cache; `useImage` reuses it. Data removal is synchronous.
 */
function BoardGhostLayer({ theme }: { theme: CanvasTheme }) {
	const ghost = useMotion((state) => state.boardGhost);
	const clearBoardGhost = useMotion((state) => state.clearBoardGhost);
	if (!ghost) return null;
	return (
		<BoardGhostView
			key={ghost.nonce}
			ghost={ghost}
			theme={theme}
			clearBoardGhost={clearBoardGhost}
		/>
	);
}

function BoardGhostView({
	ghost,
	theme,
	clearBoardGhost,
}: {
	ghost: DepartingBoard;
	theme: CanvasTheme;
	clearBoardGhost: (uid: string) => void;
}) {
	const [opacity, setOpacity] = useState(1);
	const timers = useRef<number[]>([]);
	const { image } = useImage(ghost.imageSrc, `board-ghost-${ghost.uid}`);
	const widthPx = cmToPx(ghost.widthCm);
	const heightPx = cmToPx(ghost.heightCm);

	useEffect(() => {
		const durationMs = motionMs(MOTION.slow);
		const delayMs = motionMs(ghost.delayMs);
		if (durationMs <= 0) {
			clearBoardGhost(ghost.uid);
			return;
		}
		// React-driven steps: the ghost is one transient node, and explicit
		// opacity updates are immune to a tween being torn down by a re-render.
		const steps = 8;
		const stepMs = durationMs / steps;
		const schedule = (fn: () => void, ms: number) => {
			timers.current.push(window.setTimeout(fn, ms));
		};
		for (let step = 1; step <= steps; step += 1) {
			schedule(() => setOpacity(1 - step / steps), delayMs + step * stepMs);
		}
		schedule(() => clearBoardGhost(ghost.uid), delayMs + durationMs + 40);
		return () => {
			for (const timer of timers.current) window.clearTimeout(timer);
			timers.current = [];
		};
	}, [clearBoardGhost, ghost.uid, ghost.delayMs]);

	return (
		<Group
			opacity={opacity}
			x={cmToPx(ghost.xCm)}
			y={cmToPx(ghost.yCm)}
			rotation={ghost.rotationDeg}
			listening={false}
		>
			{image ? (
				<KonvaImage
					image={image}
					width={widthPx}
					height={heightPx}
					listening={false}
				/>
			) : (
				<Rect
					width={widthPx}
					height={heightPx}
					fill={ghost.custom ? theme.customFill : theme.boardDraftFill}
					stroke={ghost.custom ? theme.customStroke : theme.boardStroke}
					strokeWidth={1}
					cornerRadius={2}
					listening={false}
				/>
			)}
		</Group>
	);
}
