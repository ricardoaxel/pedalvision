import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	Circle,
	Group,
	Image as KonvaImage,
	Line,
	Rect,
	Text,
} from "react-konva";
import { ASSET_RENDITIONS, resolveImageUrl } from "../lib/cdn";
import { cmToPx, type Point } from "../lib/geometry";
import { jackLocalPoint, jackNormalLocal } from "../lib/jackAnchor";
import { useCableDrag } from "../state/cableDrag";
import { useDrag } from "../state/drag";
import { isReadOnly, useReadOnly } from "../state/readOnly";
import {
	cableEndCapacityNotice,
	cableEndHasCapacity,
	type PlacedItem,
	resolveItem,
	resolveItemJacks,
	useScene,
	usesFallbackJacks,
} from "../state/scene";
import { selectSelectedItemUid, useSelection } from "../state/selection";
import { useSettings } from "../state/settings";
import { useViewport } from "../state/viewport";
import type { CanvasTheme } from "../styles/theme";
import {
	CANVAS_FONTS,
	ITEM_LABEL,
	JACK_TICK,
	READ_ONLY_CUE_INNER_OUTSET_PX,
	READ_ONLY_CUE_INNER_STROKE_PX,
	READ_ONLY_CUE_OUTSET_PX,
	READ_ONLY_CUE_STROKE_PX,
	READ_ONLY_CUE_UNDER_STROKE_PX,
	WARNING_OUTSET_PX,
	WARNING_STROKE_PX,
} from "../styles/theme";
import { registerItemNode, unregisterItemNode } from "./itemNodeRegistry";
import { useCoarsePointer } from "./useCoarsePointer";
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
/** Compact canvas labels for jack kinds (full names live in the info panel). */
const JACK_LABELS: Record<string, string> = {
	in: "I",
	out: "O",
	exp: "EXP",
	"exp-in": "EXP I",
	"exp-out": "EXP O",
	send: "SEND",
	return: "RET",
	midi: "MIDI",
	ctrl: "CTRL",
	power: "PWR",
};

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
				ASSET_RENDITIONS.canvas,
			)
		: null;
	const { image, status } = useImage(src, item.uid);

	const selectItem = useSelection((state) => state.selectItem);
	const setHoveredItem = useSelection((state) => state.setHoveredItem);
	const hoveredItemUid = useSelection((state) => state.hoveredItemUid);
	const selectedItemUid = useSelection(selectSelectedItemUid);
	const scale = useViewport((state) => state.scale);
	const beginCandidate = useDrag((state) => state.beginCandidate);
	// Only the attempted item re-renders when the cue appears/clears.
	const readOnlyCueNonce = useReadOnly((state) =>
		state.cue?.kind === "item" && state.cue.uid === item.uid
			? state.cue.nonce
			: 0,
	);
	const beginReadOnlyAttempt = useReadOnly((state) => state.beginAttempt);
	// Drag-connect (P4-02). Subscribe to a **primitive per pedal** (never the live
	// pointer or the whole target object) so a pointermove re-renders only the
	// pedals whose source/target jack actually changed.
	const cableSourceJack = useCableDrag((state) =>
		state.source?.itemUid === item.uid ? state.source.jackIndex : -1,
	);
	const cableTargetJack = useCableDrag((state) =>
		state.target?.kind === "item" && state.target.uid === item.uid
			? state.target.jackIndex
			: -1,
	);
	const readOnly = isReadOnly();
	const showCables = useSettings((state) => state.showCables);
	const coarsePointer = useCoarsePointer();
	const [hoveredJack, setHoveredJack] = useState<number | null>(null);

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
			if (isReadOnly()) {
				beginReadOnlyAttempt({
					uid: item.uid,
					kind: "item",
					startClient: client,
				});
				return;
			}
			beginCandidate({ uid: item.uid, startClient: client });
		},
		[item.uid, selectItem, beginCandidate, beginReadOnlyAttempt],
	);

	const label = resolved.name;
	const pad = Math.min(4, widthPx * 0.08);
	const textWidth = Math.max(0, widthPx - pad * 2);
	// Screen-size gates (not raw px) so the labeled fallback stays legible at
	// any zoom — the 7 cm × 12 cm unknown-ref footprint is only 28 raw px wide.
	const labelScale = scale > 0 ? scale : 1;
	const screenWidth = widthPx * labelScale;
	const screenHeight = heightPx * labelScale;
	const showFallbackText = screenHeight >= 18 && screenWidth >= 20;

	// Always-on name label ("Specimen Bench"): a chip inside the pedal's bottom
	// edge, drawn at screen-constant size (counter-scaled by the stage zoom) so
	// it never becomes 3px text or a banner. Hidden when the footprint is too
	// narrow to hold a readable name; full opacity when hovered/selected or once
	// the footprint passes the legibility threshold. A custom part always shows
	// it (the chip is its identity), so it is exempt from the image-loaded guard.
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
	const cueOuter = READ_ONLY_CUE_OUTSET_PX / labelScale;
	const cueInner = READ_ONLY_CUE_INNER_OUTSET_PX / labelScale;
	const readOnlyCueRects =
		readOnlyCueNonce > 0 ? (
			<>
				<Rect
					x={-cueOuter}
					y={-cueOuter}
					width={widthPx + cueOuter * 2}
					height={heightPx + cueOuter * 2}
					stroke={theme.canvasBackground}
					strokeWidth={READ_ONLY_CUE_UNDER_STROKE_PX / labelScale}
					fillEnabled={false}
					cornerRadius={5 / labelScale}
					listening={false}
					perfectDrawEnabled={false}
				/>
				<Rect
					x={-cueOuter}
					y={-cueOuter}
					width={widthPx + cueOuter * 2}
					height={heightPx + cueOuter * 2}
					stroke={theme.dangerOutline}
					strokeWidth={READ_ONLY_CUE_STROKE_PX / labelScale}
					fillEnabled={false}
					cornerRadius={5 / labelScale}
					listening={false}
					perfectDrawEnabled={false}
				/>
				<Rect
					x={-cueInner}
					y={-cueInner}
					width={widthPx + cueInner * 2}
					height={heightPx + cueInner * 2}
					stroke={theme.dangerOutlineSoft}
					strokeWidth={READ_ONLY_CUE_INNER_STROKE_PX / labelScale}
					fillEnabled={false}
					cornerRadius={3 / labelScale}
					listening={false}
					perfectDrawEnabled={false}
				/>
			</>
		) : null;

	// Jack ticks (P4-02 "Patch Drafting"): quiet sockets on the footprint edge.
	// Real jacks show a ring + centre dot; the documented fallback pair shows a
	// hollow diamond + "assumed" so it never reads as manufacturer data.
	const jacks =
		readOnly || !showCables ? [] : resolveItemJacks(item, customPedals);
	const assumedJacks = usesFallbackJacks(item, customPedals);
	const showSecondaryJacks =
		hoveredItemUid === item.uid ||
		selectedItemUid === item.uid ||
		screenWidth >= 44;
	const jackTicks = jacks.map((jack, index) => {
		if (!showSecondaryJacks && jack.kind !== "in" && jack.kind !== "out") {
			return null;
		}
		const local = jackLocalPoint(jack, {
			widthCm: resolved.widthCm,
			heightCm: resolved.heightCm,
		});
		const x = cmToPx(local.x);
		const y = cmToPx(local.y);
		const isSource = cableSourceJack === index;
		const isTarget = cableTargetJack === index;
		const isHovered = hoveredJack === index;
		// Edge-only catalog data (P5-01) is approximate like the fallback pair:
		// draw a hollow diamond so it never reads as a measured position.
		const approximate = jack.approximate === true;
		const hollow = assumedJacks || approximate;
		const diameter = hollow
			? JACK_TICK.diameterPx / labelScale
			: (isTarget
					? JACK_TICK.targetDiameterPx
					: isHovered
						? JACK_TICK.hoverDiameterPx
						: JACK_TICK.diameterPx) / labelScale;
		const radius = diameter / 2;
		const diamondRadius = hollow ? radius * 0.85 : radius;
		const ringColor = isSource || isTarget ? theme.selection : theme.jack;
		const label = JACK_LABELS[jack.kind] ?? jack.kind.toUpperCase();
		// Short socket label only; the hollow diamond + info-panel note carry the
		// "assumed" disclosure without a long chip (owner feedback).
		const chipText = label;
		const chipWidth = (Math.max(26, chipText.length * 6.2) + 8) / labelScale;
		const chipHeight = 16 / labelScale;
		// The hit disc sits mostly OUTSIDE the edge: a full 44px disc centred on
		// the socket would cover the whole ~29px pedal at zoom 1 and steal the
		// drag. It overlaps only ~4px inwards.
		const hitRadius = (coarsePointer ? JACK_TICK.hitPx : 28) / 2 / labelScale;
		const outward = jackNormalLocal(jack.edge);
		const hitOffset = Math.max(0, hitRadius - 4 / labelScale);
		const chipAbove = jack.edge !== "bottom";
		const chipY = chipAbove
			? y - radius - 6 / labelScale - chipHeight
			: y + radius + 6 / labelScale;
		const begin = (
			event: KonvaEventObject<MouseEvent | TouchEvent>,
			client: Point,
		) => {
			event.cancelBubble = true;
			if (
				"button" in event.evt &&
				event.evt instanceof MouseEvent &&
				event.evt.button !== 0
			) {
				return;
			}
			// On touch, do not select while starting a connection: selecting opens
			// the info sheet over the canvas and hides the connection guidance.
			if (!coarsePointer) selectItem(item.uid);
			if (readOnly) {
				beginReadOnlyAttempt({
					uid: item.uid,
					kind: "item",
					startClient: client,
				});
				return;
			}
			// Mono jacks accept one cable, stereo/TRS two: never start a second
			// connection on an occupied socket (owner bug report, 2026-10-21).
			const scene = useScene.getState();
			const end = { itemUid: item.uid, jack: String(index) };
			if (
				!cableEndHasCapacity(
					end,
					scene.cables,
					scene.items,
					scene.endpoints,
					scene.customPedals,
				)
			) {
				useCableDrag
					.getState()
					.setNotice(
						cableEndCapacityNotice(end, scene.items, scene.customPedals),
					);
				return;
			}
			useCableDrag.getState().begin({ itemUid: item.uid, jackIndex: index });
		};
		return (
			<Group
				// biome-ignore lint/suspicious/noArrayIndexKey: jacks carry no id; the index is the cable reference
				key={`jack-${index}`}
				x={x}
				y={y}
			>
				{hollow ? (
					/* Fallback anchor: a clearly hollow diamond (no centre dot) so an
					 * assumed socket can never be mistaken for real jack data. */
					<>
						<Line
							points={
								[
									[0, -(diamondRadius + 0.8 / labelScale)],
									[diamondRadius + 0.8 / labelScale, 0],
									[0, diamondRadius + 0.8 / labelScale],
									[-(diamondRadius + 0.8 / labelScale), 0],
								].flat() as number[]
							}
							closed
							stroke={theme.canvasBackground}
							strokeWidth={(JACK_TICK.collarPx * 2) / labelScale}
							lineJoin="round"
							listening={false}
							perfectDrawEnabled={false}
						/>
						<Line
							points={
								[
									[0, -diamondRadius],
									[diamondRadius, 0],
									[0, diamondRadius],
									[-diamondRadius, 0],
								].flat() as number[]
							}
							closed
							stroke={ringColor}
							strokeWidth={(isSource || isTarget ? 2 : 1) / labelScale}
							fill={isSource ? theme.selection : undefined}
							lineJoin="round"
							listening={false}
							perfectDrawEnabled={false}
						/>
					</>
				) : (
					<>
						<Circle
							radius={radius + JACK_TICK.collarPx / labelScale}
							stroke={theme.canvasBackground}
							strokeWidth={(JACK_TICK.collarPx * 2) / labelScale}
							fillEnabled={false}
							listening={false}
							perfectDrawEnabled={false}
						/>
						<Circle
							radius={radius}
							stroke={ringColor}
							strokeWidth={
								(isSource || isTarget ? 2 : JACK_TICK.strokePx) / labelScale
							}
							fill={isSource ? theme.selection : theme.canvasBackground}
							fillEnabled={isSource}
							listening={false}
							perfectDrawEnabled={false}
						/>
						{isSource ? (
							<Circle
								radius={JACK_TICK.dotPx / labelScale}
								fill={theme.itemLabelInk}
								listening={false}
								perfectDrawEnabled={false}
							/>
						) : (
							<Circle
								radius={JACK_TICK.dotPx / labelScale}
								fill={ringColor}
								listening={false}
								perfectDrawEnabled={false}
							/>
						)}
					</>
				)}
				{jack.stereo ? (
					<Circle
						radius={radius + 2.5 / labelScale}
						stroke={ringColor}
						strokeWidth={0.8 / labelScale}
						fillEnabled={false}
						listening={false}
						perfectDrawEnabled={false}
					/>
				) : null}
				{/* Invisible 44px hit disc: the stroke-only socket is too thin to
				 * hit reliably over a photo, and touch needs the full target. */}
				<Circle
					x={outward.x * hitOffset}
					y={outward.y * hitOffset}
					radius={hitRadius}
					fill="rgba(0,0,0,0.001)"
					onMouseDown={(event) => begin(event, clientPoint(event.evt))}
					onTouchStart={(event) => begin(event, clientPoint(event.evt))}
					onMouseEnter={() => setHoveredJack(index)}
					onMouseLeave={() =>
						setHoveredJack((current) => (current === index ? null : current))
					}
				/>
				{isHovered || isSource || isTarget || selectedItemUid === item.uid ? (
					<Group listening={false}>
						<Rect
							x={-chipWidth / 2}
							y={chipY}
							width={chipWidth}
							height={chipHeight}
							fill={theme.itemLabelBg}
							cornerRadius={3 / labelScale}
						/>
						<Text
							text={chipText}
							x={-chipWidth / 2}
							y={chipY}
							width={chipWidth}
							height={chipHeight}
							align="center"
							verticalAlign="middle"
							fontFamily={CANVAS_FONTS.mono}
							fontSize={(JACK_TICK.dotPx * 4) / labelScale}
							fill={theme.itemLabelInk}
							wrap="none"
							ellipsis
						/>
					</Group>
				) : null}
			</Group>
		);
	});

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
			{jackTicks}
			{warningCue}
			{readOnlyCueRects}
		</Group>
	);
}
