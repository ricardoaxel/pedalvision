import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { useCallback, useEffect, useRef } from "react";
import { Group, Image as KonvaImage, Rect, Text } from "react-konva";
import { resolveImageUrl } from "../lib/cdn";
import { cmToPx, type Point } from "../lib/geometry";
import { useDrag } from "../state/drag";
import { itemDefinition, itemFootprint, type PlacedItem } from "../state/scene";
import { useSelection } from "../state/selection";
import type { CanvasTheme } from "../styles/theme";
import { CANVAS_FONTS } from "../styles/theme";
import { useImage } from "./useImage";

interface PedalNodeProps {
	item: PlacedItem;
	theme: CanvasTheme;
	/** Position in the parent group's frame (cm): board-local when attached to a
	 * board, world cm when loose or lifted into the DragLayer. */
	xCm: number;
	yCm: number;
	/** True while the item is lifted in the DragLayer — adds the lift shadow. */
	lifted?: boolean;
	registerNode: (uid: string, node: Konva.Group | null) => void;
}

/** Client-space pointer position from a mouse or touch Konva event. */
function clientPoint(evt: MouseEvent | TouchEvent): Point {
	if ("touches" in evt) {
		// The touch that started this event (not an unrelated first finger).
		const touch = evt.changedTouches[0] ?? evt.touches[0];
		return touch ? { x: touch.clientX, y: touch.clientY } : { x: 0, y: 0 };
	}
	return { x: evt.clientX, y: evt.clientY };
}

/**
 * One placed pedal/supply (design.md §Canvas architecture). Rendered inside its
 * container's group — a board's group (so it inherits the board transform for
 * free) or the loose/Drag layer (world cm). Images resolve via the
 * image-resolution contract; a missing/failed image falls back to a labeled
 * rectangle at the true cm footprint.
 *
 * Drag is intentionally NOT Konva's built-in `draggable`: a cross-board drop
 * lifts the item into the DragLayer (a different React tree), which would kill
 * a live Konva drag. `useItemDrag` drives the pointer instead, so the node can
 * unmount/remount freely. A pointer-down selects the item and starts the drag
 * candidate; `cancelBubble` keeps the enclosing (draggable) board from moving.
 */
export function PedalNode({
	item,
	theme,
	xCm,
	yCm,
	lifted = false,
	registerNode,
}: PedalNodeProps) {
	const definition = itemDefinition(item);
	const footprint = itemFootprint(item);
	const widthPx = cmToPx(footprint.widthCm);
	const heightPx = cmToPx(footprint.heightCm);

	const src = definition
		? resolveImageUrl(definition.imageSource, definition.image, "pedal", 800)
		: null;
	const { image, status } = useImage(src);

	const selectItem = useSelection((state) => state.selectItem);
	const beginCandidate = useDrag((state) => state.beginCandidate);

	const groupRef = useRef<Konva.Group>(null);
	useEffect(() => {
		registerNode(item.uid, groupRef.current);
		return () => registerNode(item.uid, null);
	}, [item.uid, registerNode]);

	const handlePointerDown = useCallback(
		(event: KonvaEventObject<MouseEvent | TouchEvent>, client: Point) => {
			// Claim the press: the board underneath must not start dragging.
			event.cancelBubble = true;
			selectItem(item.uid);
			beginCandidate({ uid: item.uid, startClient: client });
		},
		[item.uid, selectItem, beginCandidate],
	);

	const label = definition ? definition.name : item.refId;
	const pad = Math.min(4, widthPx * 0.08);
	const textWidth = Math.max(0, widthPx - pad * 2);
	const showLabel = heightPx >= 26 && widthPx >= 30;

	// Lifted items get a soft shadow so the cross-board drag reads as "raised".
	const shadow = lifted
		? {
				shadowColor: theme.itemShadow,
				shadowBlur: 26,
				shadowOffsetY: 12,
				shadowOpacity: 1,
			}
		: { shadowOpacity: 0 };

	return (
		<Group
			ref={groupRef}
			x={cmToPx(xCm)}
			y={cmToPx(yCm)}
			onMouseDown={(event) => {
				// Only the primary mouse button starts a selection/drag.
				if (event.evt.button !== 0) return;
				handlePointerDown(event, clientPoint(event.evt));
			}}
			onTouchStart={(event) => handlePointerDown(event, clientPoint(event.evt))}
		>
			{status === "loaded" && image ? (
				<KonvaImage
					image={image}
					width={widthPx}
					height={heightPx}
					{...shadow}
				/>
			) : (
				<>
					<Rect
						width={widthPx}
						height={heightPx}
						fill={theme.boardDraftFill}
						stroke={theme.boardStroke}
						strokeWidth={1}
						dash={[3, 2]}
						cornerRadius={2}
						{...shadow}
					/>
					{showLabel ? (
						<Text
							text={label}
							x={pad}
							width={textWidth}
							y={heightPx / 2 - 6}
							align="center"
							fontFamily={CANVAS_FONTS.sans}
							fontSize={9}
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
