import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { useCallback, useEffect, useRef } from "react";
import { Group, Image as KonvaImage, Rect, Text } from "react-konva";
import { resolveImageUrl } from "../lib/cdn";
import { cmToPx, type Point } from "../lib/geometry";
import { useDrag } from "../state/drag";
import { type PlacedItem, resolveItem, useScene } from "../state/scene";
import { selectSelectedItemUid, useSelection } from "../state/selection";
import { useViewport } from "../state/viewport";
import type { CanvasTheme } from "../styles/theme";
import {
	CANVAS_FONTS,
	ITEM_LABEL,
	WARNING_OUTSET_PX,
	WARNING_STROKE_PX,
} from "../styles/theme";
import { registerItemNode, unregisterItemNode } from "./itemNodeRegistry";
import { useImage } from "./useImage";

interface PedalNodeProps {
	item: PlacedItem;
	theme: CanvasTheme;
	/** Position in the parent group's frame (cm): board-local when attached to a
	 * board, world cm when loose or lifted into the DragLayer. */
	xCm: number;
	yCm: number;
	/** Overrides the rendered rotation (degrees). Defaults to the item's own
	 * rotation; the DragLayer passes the composed board+own rotation so a lifted
	 * pedal keeps its on-board orientation. */
	rotationDeg?: number;
	/** True while the item is lifted in the DragLayer — adds the lift shadow. */
	lifted?: boolean;
	/**
	 * Space warning (P2-03): true when this item overlaps a peer or extends past
	 * its board. Draws a screen-constant amber on-bounds stroke — a non-blocking
	 * cue (never affects the placement).
	 */
	warning?: boolean;
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
 * A **custom pedal** (P2-02) is text-only: it renders as a **solid** neutral
 * rectangle with a **dog-eared top-right corner** and a mono `CUSTOM` tag
 * (distinct from the dashed "missing image" fallback), plus the same bottom name
 * chip catalog pedals get — accent stays reserved for selection.
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
	rotationDeg,
	lifted = false,
	warning = false,
}: PedalNodeProps) {
	const customPedals = useScene((state) => state.customPedals);
	const resolved = resolveItem(item, customPedals);
	const widthPx = cmToPx(resolved.widthCm);
	const heightPx = cmToPx(resolved.heightCm);

	const src = resolved.definition
		? resolveImageUrl(
				resolved.definition.imageSource,
				resolved.definition.image,
				"pedal",
				800,
			)
		: null;
	const { image, status } = useImage(src, item.uid);

	const selectItem = useSelection((state) => state.selectItem);
	const setHoveredItem = useSelection((state) => state.setHoveredItem);
	const hoveredItemUid = useSelection((state) => state.hoveredItemUid);
	const selectedItemUid = useSelection(selectSelectedItemUid);
	const scale = useViewport((state) => state.scale);
	const beginCandidate = useDrag((state) => state.beginCandidate);

	const groupRef = useRef<Konva.Group>(null);
	// Register globally so the top-level rotate Transformer can attach to this
	// node wherever it renders (design.md → SelectionLayer).
	useEffect(() => {
		const node = groupRef.current;
		if (!node) return;
		registerItemNode(item.uid, node);
		return () => unregisterItemNode(item.uid, node);
	}, [item.uid]);

	const handlePointerDown = useCallback(
		(event: KonvaEventObject<MouseEvent | TouchEvent>, client: Point) => {
			// Claim the press: the board underneath must not start dragging.
			event.cancelBubble = true;
			selectItem(item.uid);
			beginCandidate({ uid: item.uid, startClient: client });
		},
		[item.uid, selectItem, beginCandidate],
	);

	const label = resolved.name;
	const pad = Math.min(4, widthPx * 0.08);
	const textWidth = Math.max(0, widthPx - pad * 2);
	const showFallbackText = heightPx >= 26 && widthPx >= 30;

	// Always-on name label ("Specimen Bench"): a chip inside the pedal's bottom
	// edge, drawn at screen-constant size (counter-scaled by the stage zoom) so
	// it never becomes 3px text or a banner. Hidden when the footprint is too
	// narrow to hold a readable name; full opacity when hovered/selected or once
	// the footprint passes the legibility threshold. A custom part always shows
	// it (the chip is its identity), so it is exempt from the image-loaded guard.
	const labelScale = scale > 0 ? scale : 1;
	const screenWidth = widthPx * labelScale;
	const screenHeight = heightPx * labelScale;
	const isCustom = resolved.custom !== null;
	const showItemLabel =
		(isCustom || (status === "loaded" && image !== null)) &&
		screenWidth >= ITEM_LABEL.minWidthPx;
	const labelInset = ITEM_LABEL.insetPx / labelScale;
	const labelPad = 3 / labelScale;
	const labelHeight = Math.max(
		0,
		Math.min(ITEM_LABEL.heightPx / labelScale, heightPx - labelInset * 2),
	);
	const labelWidth = Math.max(0, widthPx - labelInset * 2);
	const labelY = heightPx - labelInset - labelHeight;
	const labelFontSize = ITEM_LABEL.fontSizePx / labelScale;
	const labelEmphasized =
		hoveredItemUid === item.uid || selectedItemUid === item.uid;
	const labelOpacity =
		isCustom || labelEmphasized || screenWidth >= ITEM_LABEL.fullOpacityWidthPx
			? 1
			: ITEM_LABEL.opacity;
	// The `CUSTOM` micro-tag is the always-on cue that this part is user-defined
	// (text-only), so it appears at any legible size — a typical ~6cm pedal at
	// zoom 1 is ~24px wide, below the name-chip threshold, and would otherwise
	// read as a generic shape. The name chip keeps the catalog threshold.
	const showCustomTag = isCustom && screenWidth >= 20 && screenHeight >= 16;
	const tagFontSize = (ITEM_LABEL.fontSizePx * 0.6) / labelScale;

	// Lifted items get a soft shadow so the cross-board drag reads as "raised".
	const shadow = lifted
		? {
				shadowColor: theme.itemShadow,
				shadowBlur: 26,
				shadowOffsetY: 12,
				shadowOpacity: 1,
			}
		: { shadowOpacity: 0 };

	const nameChip =
		showItemLabel && labelHeight > 0 && labelWidth > 0 ? (
			<Group opacity={labelOpacity} listening={false}>
				<Rect
					x={labelInset}
					y={labelY}
					width={labelWidth}
					height={labelHeight}
					fill={theme.itemLabelBg}
					cornerRadius={Math.min(labelHeight / 2, 3 / labelScale)}
				/>
				<Text
					text={label}
					x={labelInset + labelPad}
					y={labelY}
					width={labelWidth - labelPad * 2}
					height={labelHeight}
					align="center"
					verticalAlign="middle"
					fontFamily={CANVAS_FONTS.sans}
					fontSize={labelFontSize}
					fill={theme.itemLabelInk}
					wrap="none"
					ellipsis
					listening={false}
				/>
			</Group>
		) : null;

	const body = isCustom ? (
		<>
			{/* Custom part: solid body + dog-eared top-right corner (not dashed —
			 * dashed means a missing image). */}
			<Rect
				width={widthPx}
				height={heightPx}
				fill={theme.customFill}
				stroke={theme.customStroke}
				strokeWidth={1}
				cornerRadius={[0, Math.min(widthPx, heightPx) * 0.22, 0, 0]}
				{...shadow}
			/>
			{showCustomTag ? (
				<Text
					text="CUSTOM"
					x={labelInset}
					y={labelInset}
					width={labelWidth}
					align="center"
					fontFamily={CANVAS_FONTS.mono}
					fontSize={tagFontSize}
					letterSpacing={0.5 / labelScale}
					fill={theme.itemLabelInk}
					wrap="none"
					ellipsis
					listening={false}
				/>
			) : null}
			{nameChip}
		</>
	) : status === "loaded" && image ? (
		<>
			<KonvaImage image={image} width={widthPx} height={heightPx} {...shadow} />
			{nameChip}
		</>
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
			{showFallbackText ? (
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
	);

	// Non-blocking space-warning cue: a solid amber **outer ring** around the
	// item's footprint. It sits outside the selection halo + Transformer border
	// (both drawn on the bounds) so a selected + warned item shows BOTH the cyan
	// selection and the amber flag; solid (not dashed — dashed is the
	// missing-image language) and no fill tint (the canvas stays neutral). The
	// width and outset are counter-scaled so the cue stays a constant screen
	// weight at any zoom.
	const warningOutset = WARNING_OUTSET_PX / labelScale;
	const warningCue = warning ? (
		<Rect
			x={-warningOutset}
			y={-warningOutset}
			width={widthPx + warningOutset * 2}
			height={heightPx + warningOutset * 2}
			stroke={theme.warningOutline}
			strokeWidth={WARNING_STROKE_PX / labelScale}
			fillEnabled={false}
			cornerRadius={4 / labelScale}
			listening={false}
			perfectDrawEnabled={false}
		/>
	) : null;

	return (
		<Group
			ref={groupRef}
			x={cmToPx(xCm)}
			y={cmToPx(yCm)}
			rotation={rotationDeg ?? item.rotationDeg}
			onMouseDown={(event) => {
				// Only the primary mouse button starts a selection/drag.
				if (event.evt.button !== 0) return;
				handlePointerDown(event, clientPoint(event.evt));
			}}
			onTouchStart={(event) => handlePointerDown(event, clientPoint(event.evt))}
			// Desktop hover outline (touch has no hover). Konva `mouseenter`
			// bubbles to this Group from its child shape.
			onMouseEnter={() => setHoveredItem(item.uid)}
			onMouseLeave={() => setHoveredItem(null)}
		>
			{body}
			{warningCue}
		</Group>
	);
}
