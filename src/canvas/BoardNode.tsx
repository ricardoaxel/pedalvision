import type Konva from "konva";
import { useCallback, useEffect, useRef } from "react";
import { Group, Image as KonvaImage, Line, Rect, Text } from "react-konva";
import { type BoardTexture, DEFAULT_BOARD_TEXTURE } from "../lib/boardTexture";
import { resolveImageUrl } from "../lib/cdn";
import { cmToDisplay, cmToPx, pxToCm } from "../lib/geometry";
import { useGesture } from "../state/gesture";
import { spaceWarning } from "../state/overlap";
import {
	boardDefinition,
	boardFootprint,
	isCustomBoard,
	itemFootprint,
	type PlacedBoard,
	type PlacedItem,
	useScene,
} from "../state/scene";
import { useSelection } from "../state/selection";
import { useViewport } from "../state/viewport";
import type { CanvasTheme } from "../styles/theme";
import { CANVAS_FONTS, ITEM_LABEL } from "../styles/theme";
import { finishBaseColor, finishPatternTile } from "./boardFinish";
import { PedalNode } from "./PedalNode";
import { SelectionOutline } from "./SelectionOutline";
import { useImage } from "./useImage";

interface BoardNodeProps {
	board: PlacedBoard;
	theme: CanvasTheme;
	/** This board's attached items (excluding the one currently lifted). */
	items: PlacedItem[];
	selectedItemUid: string | null;
	registerNode: (uid: string, node: Konva.Group | null) => void;
}

/**
 * One placed board (design.md §Canvas architecture → BoardLayer): a Konva
 * `Group` positioned at the board's world cm origin, carrying the board image
 * at its true cm footprint and **its attached pedals** (so they inherit the
 * board transform for free — the reason pedals are not a flat layer). Falls
 * back to a labeled rectangle while the image loads or if it fails.
 *
 * The Group is `draggable`; pan never starts on it because the gesture reducer
 * receives `target: "object"` for a hit (the `empty`/`object` seam in
 * gestures.ts). A press on a contained pedal claims the gesture (see
 * PedalNode), so grabbing a pedal never drags the board.
 */
export function BoardNode({
	board,
	theme,
	items,
	selectedItemUid,
	registerNode,
}: BoardNodeProps) {
	const definition = boardDefinition(board);
	const footprint = boardFootprint(board);
	const widthPx = cmToPx(footprint.widthCm);
	const heightPx = cmToPx(footprint.heightCm);
	const custom = isCustomBoard(board);
	const scale = useViewport((state) => state.scale);

	const src = definition
		? resolveImageUrl(definition.imageSource, definition.image, "board", 800)
		: null;
	const { image, status } = useImage(src, board.uid);

	const moveBoard = useScene((state) => state.moveBoard);
	const customPedals = useScene((state) => state.customPedals);
	const allItems = useScene((state) => state.items);
	const boards = useScene((state) => state.boards);
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

	// The selected pedal's halo is drawn here (inheriting the board transform);
	// its rotate Transformer lives in the top-level SelectionLayer and attaches
	// to the node through the global registry (see ItemTransformer).
	const selectedItem = selectedItemUid
		? items.find((item) => item.uid === selectedItemUid)
		: undefined;

	// Space warning (P2-03): only the selected attached item is flagged. The
	// lifted item is excluded from `items` (it renders in the DragLayer), so no
	// live override is needed here.
	const warning = selectedItem
		? spaceWarning(selectedItem, { items: allItems, boards, customPedals }).any
		: false;

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

	// Custom board (P2-05 "Substrate"): a notched board filled with its chosen
	// finish (base + procedural pattern), a solid outline, and an opaque identity
	// chip carrying the mono CUSTOM tag + name. Catalog boards (image or the
	// dashed missing-image fallback) are untouched.
	const finish: BoardTexture = board.texture ?? DEFAULT_BOARD_TEXTURE;
	const finishBase = finishBaseColor(finish, theme);
	const finishTile = finishPatternTile(finish, theme);
	const notch = Math.min(Math.min(widthPx, heightPx) * 0.18, cmToPx(0.9));
	const boardLabelScale = scale > 0 ? scale : 1;
	const screenWidth = widthPx * boardLabelScale;
	const chipInset = ITEM_LABEL.insetPx / boardLabelScale;
	const chipHeight = Math.min(
		ITEM_LABEL.heightPx / boardLabelScale,
		Math.max(0, heightPx - chipInset * 2),
	);
	const chipWidth = Math.max(
		0,
		Math.min(widthPx - chipInset * 2, 240 / boardLabelScale),
	);
	const chipX = (widthPx - chipWidth) / 2;
	const chipY = heightPx - chipInset - chipHeight;
	const chipFont = ITEM_LABEL.fontSizePx / boardLabelScale;
	const tagFont = (ITEM_LABEL.fontSizePx * 0.72) / boardLabelScale;
	const chipPad = 4 / boardLabelScale;
	const tagWidth = Math.min(chipWidth * 0.42, tagFont * 4.6 + chipPad);
	const customName = board.name?.trim() || "Custom board";
	const showChip =
		screenWidth >= ITEM_LABEL.minWidthPx &&
		chipHeight > 0 &&
		chipWidth > 0 &&
		widthPx >= notch + 1;
	const customBody = (
		<>
			<Line
				points={[
					0,
					0,
					widthPx - notch,
					0,
					widthPx,
					notch,
					widthPx,
					heightPx,
					0,
					heightPx,
				]}
				closed
				fill={finishBase}
				fillPatternImage={finishTile ?? undefined}
				fillPriority={finishTile ? "pattern" : "color"}
				stroke={theme.customStroke}
				strokeWidth={1}
				lineJoin="round"
			/>
			<Line
				points={[widthPx - notch, 0, widthPx, notch]}
				stroke={theme.customStroke}
				strokeWidth={1}
				opacity={0.5}
				listening={false}
			/>
			{showChip ? (
				<Group listening={false}>
					<Rect
						x={chipX}
						y={chipY}
						width={chipWidth}
						height={chipHeight}
						fill={theme.itemLabelBg}
						cornerRadius={Math.min(chipHeight / 2, 3 / boardLabelScale)}
					/>
					<Text
						text="CUSTOM"
						x={chipX + chipPad}
						y={chipY}
						height={chipHeight}
						verticalAlign="middle"
						fontFamily={CANVAS_FONTS.mono}
						fontSize={tagFont}
						letterSpacing={0.5 / boardLabelScale}
						fill={theme.itemLabelInk}
						wrap="none"
						listening={false}
					/>
					<Text
						text={customName}
						x={chipX + chipPad + tagWidth}
						y={chipY}
						width={Math.max(0, chipWidth - chipPad * 2 - tagWidth)}
						height={chipHeight}
						verticalAlign="middle"
						fontFamily={CANVAS_FONTS.sans}
						fontSize={chipFont}
						fill={theme.itemLabelInk}
						wrap="none"
						ellipsis
						listening={false}
					/>
				</Group>
			) : null}
		</>
	);

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
			{custom ? (
				customBody
			) : status === "loaded" && image ? (
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
			{items.map((item) => (
				<PedalNode
					key={item.uid}
					item={item}
					theme={theme}
					xCm={item.x}
					yCm={item.y}
					warning={item.uid === selectedItemUid ? warning : false}
				/>
			))}
			{selectedItem ? (
				<SelectionOutline
					xCm={selectedItem.x}
					yCm={selectedItem.y}
					widthCm={itemFootprint(selectedItem, customPedals).widthCm}
					heightCm={itemFootprint(selectedItem, customPedals).heightCm}
					rotationDeg={selectedItem.rotationDeg}
					theme={theme}
				/>
			) : null}
		</Group>
	);
}
