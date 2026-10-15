import type Konva from "konva";
import { useCallback, useEffect, useRef } from "react";
import { Group, Image as KonvaImage, Rect, Text } from "react-konva";
import { resolveImageUrl } from "../lib/cdn";
import { cmToDisplay, cmToPx, pxToCm } from "../lib/geometry";
import { useGesture } from "../state/gesture";
import {
	boardDefinition,
	boardFootprint,
	type PlacedBoard,
	useScene,
} from "../state/scene";
import { useSelection } from "../state/selection";
import type { CanvasTheme } from "../styles/theme";
import { CANVAS_FONTS } from "../styles/theme";
import { useImage } from "./useImage";

interface BoardNodeProps {
	board: PlacedBoard;
	theme: CanvasTheme;
	registerNode: (uid: string, node: Konva.Group | null) => void;
}

/**
 * One placed board (design.md §Canvas architecture → BoardLayer): a Konva
 * `Group` positioned at the board's world cm origin, carrying the board image
 * at its true cm footprint. Falls back to a labeled rectangle while the image
 * loads or if it fails (the image-resolution contract's missing-image clause).
 *
 * The Group is `draggable`; pan never starts on it because the gesture reducer
 * receives `target: "object"` for a hit (the `empty`/`object` seam in
 * gestures.ts). Committing position back to the store in cm keeps the store the
 * single source of truth while Konva owns the live drag.
 */
export function BoardNode({ board, theme, registerNode }: BoardNodeProps) {
	const definition = boardDefinition(board);
	const footprint = boardFootprint(board);
	const widthPx = cmToPx(footprint.widthCm);
	const heightPx = cmToPx(footprint.heightCm);

	const src = definition
		? resolveImageUrl(definition.imageSource, definition.image, "board", 800)
		: null;
	const { image, status } = useImage(src);

	const moveBoard = useScene((state) => state.moveBoard);
	const selectBoard = useSelection((state) => state.selectBoard);
	// While the viewport owns the gesture (pan/pinch), the board must not drag:
	// a second finger would otherwise move it with both the drag and the pan.
	const navigating = useGesture((state) => state.navigating);

	const groupRef = useRef<Konva.Group>(null);
	const draggingRef = useRef(false);
	useEffect(() => {
		registerNode(board.uid, groupRef.current);
		return () => registerNode(board.uid, null);
	}, [board.uid, registerNode]);

	const commitPosition = useCallback(() => {
		const node = groupRef.current;
		if (!node) return;
		moveBoard(board.uid, pxToCm(node.x()), pxToCm(node.y()));
	}, [board.uid, moveBoard]);

	// When the viewport takes the gesture over (pan/pinch), drop the board where
	// it is and stop dragging. Toggling `draggable` off can cancel Konva's drag
	// *without* a `dragend`, so commit explicitly from the node's current position
	// before stopping (otherwise the moved position is silently lost).
	useEffect(() => {
		if (!navigating) return;
		if (!draggingRef.current) return;
		draggingRef.current = false;
		commitPosition();
		groupRef.current?.stopDrag();
	}, [navigating, commitPosition]);

	const label = definition ? `${definition.brand} ${definition.name}` : "Board";
	const dims = `${cmToDisplay(footprint.widthCm, "cm")} × ${cmToDisplay(footprint.heightCm, "cm")} cm`;

	// Labels scale with the footprint: inset from the rounded corners, ellipsis
	// when they'd overflow, and dropped entirely on footprints too small to hold
	// them (the silhouette alone still reads at true scale).
	const pad = Math.min(6, widthPx * 0.1);
	const textWidth = Math.max(0, widthPx - pad * 2);
	const showName = heightPx >= 40 && widthPx >= 72;
	const showDims = heightPx >= 32;

	return (
		<Group
			ref={groupRef}
			x={cmToPx(board.x)}
			y={cmToPx(board.y)}
			rotation={board.rotationDeg}
			draggable={!navigating}
			onMouseDown={(event) => {
				event.cancelBubble = true;
				selectBoard(board.uid);
			}}
			onTouchStart={(event) => {
				event.cancelBubble = true;
				selectBoard(board.uid);
			}}
			onDragStart={() => {
				draggingRef.current = true;
			}}
			onDragEnd={() => {
				draggingRef.current = false;
				commitPosition();
			}}
		>
			{status === "loaded" && image ? (
				<KonvaImage image={image} width={widthPx} height={heightPx} />
			) : (
				<>
					<Rect
						width={widthPx}
						height={heightPx}
						fill={theme.boardDraftFill}
						stroke={theme.boardStroke}
						strokeWidth={1}
						dash={[4, 3]}
						cornerRadius={2}
					/>
					{showName ? (
						<Text
							text={label}
							x={pad}
							width={textWidth}
							y={heightPx / 2 - 15}
							align="center"
							fontFamily={CANVAS_FONTS.sans}
							fontSize={10}
							fill={theme.boardLabel}
							wrap="none"
							ellipsis
							listening={false}
						/>
					) : null}
					{showDims ? (
						<Text
							text={dims}
							x={pad}
							width={textWidth}
							y={showName ? heightPx / 2 - 1 : heightPx / 2 - 6}
							align="center"
							fontFamily={CANVAS_FONTS.mono}
							fontSize={10}
							fill={theme.boardLabel}
							wrap="none"
							ellipsis
							listening={false}
						/>
					) : null}
				</>
			)}
		</Group>
	);
}
