import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { useEffect, useRef } from "react";
import { Circle, Group, Layer, Line, Rect, Text } from "react-konva";
import { cmToPx, PX_PER_CM, pxToCm } from "../lib/geometry";
import { jackPointNormalized, normalizedToWorld } from "../lib/jackProof";
import { formatJackPosition, jackKindLabelAt } from "../lib/partInfo";
import { useIsMobile } from "../lib/useMobile";
import { fitBoundsToViewport } from "../lib/viewportFocus";
import { useJackProof } from "../state/jackProof";
import {
	itemFootprint,
	itemVisualRotationDeg,
	itemWorldCorners,
	itemWorldOrigin,
	type PlacedBoard,
	type PlacedItem,
	resolveItem,
	resolveItemJacks,
	useScene,
} from "../state/scene";
import { useSelection } from "../state/selection";
import { useSettings } from "../state/settings";
import { useViewport } from "../state/viewport";
import { CANVAS_FONTS, type CanvasTheme, JACK_PROOF } from "../styles/theme";
import { useCoarsePointer } from "./useCoarsePointer";

function jackWorld(
	item: PlacedItem,
	boards: PlacedBoard[],
	xNorm: number,
	yNorm: number,
): { x: number; y: number } {
	const footprint = itemFootprint(item);
	const board = item.boardUid
		? boards.find((candidate) => candidate.uid === item.boardUid)
		: undefined;
	return normalizedToWorld(
		{ x: xNorm, y: yNorm },
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
}

/**
 * Canvas proof layer (“Press Proof — Register”, F-33). The proofed pedal gets
 * four printer’s registration ticks, a socket pin per effective jack, hover /
 * nearest / selected / drag states, and one screen-space tag on the pin you are
 * pointing at or holding. The ledger and mobile Proof Bar are the at-rest
 * readout; the canvas stays quiet.
 */
export function JackProofLayer({ theme }: { theme: CanvasTheme }) {
	const activeUid = useJackProof((state) => state.activeUid);
	const selectedJack = useJackProof((state) => state.selectedJack);
	const hoverJack = useJackProof((state) => state.hoverJack);
	const drag = useJackProof((state) => state.drag);
	const refitNonce = useJackProof((state) => state.refitNonce);
	const setHover = useJackProof((state) => state.setHover);
	const beginDrag = useJackProof((state) => state.beginDrag);
	const items = useScene((state) => state.items);
	const boards = useScene((state) => state.boards);
	const customPedals = useScene((state) => state.customPedals);
	const scale = useViewport((state) => state.scale);
	const viewportX = useViewport((state) => state.x);
	const viewportY = useViewport((state) => state.y);
	const size = useViewport((state) => state.size);
	const coarse = useCoarsePointer();
	const isMobile = useIsMobile();
	const units = useSettings((state) => state.units);
	const groupRef = useRef<Konva.Group>(null);

	useEffect(() => {
		if (!activeUid) return;
		const state = useScene.getState();
		const active = state.items.find((candidate) => candidate.uid === activeUid);
		if (!active) return;
		const footprint = itemFootprint(active, state.customPedals);
		const currentScale = useViewport.getState().scale;
		const longEdgePx =
			Math.max(footprint.widthCm, footprint.heightCm) *
			PX_PER_CM *
			currentScale;
		if (refitNonce === 0 && longEdgePx >= (isMobile ? 200 : 240)) return;
		const corners = itemWorldCorners(active, state.boards, state.customPedals);
		const xs = corners.map((point) => point.x);
		const ys = corners.map((point) => point.y);
		const bounds = {
			x: Math.min(...xs),
			y: Math.min(...ys),
			widthCm: Math.max(...xs) - Math.min(...xs),
			heightCm: Math.max(...ys) - Math.min(...ys),
		};
		const element = document.querySelector<HTMLElement>(".stage");
		const rect = element?.getBoundingClientRect();
		if (!rect || rect.width <= 0 || rect.height <= 0) return;
		const fit = fitBoundsToViewport(
			bounds,
			{ width: Math.round(rect.width), height: Math.round(rect.height) },
			{
				insets: isMobile
					? {
							top: 72,
							right: 20,
							bottom: JACK_PROOF.frameInsetMobileBottomPx,
							left: 20,
						}
					: { top: 80, right: 40, bottom: 60, left: 40 },
				paddingPx: 48,
				maxScale: 6,
			},
		);
		if (fit) useViewport.getState().setViewport(fit);
	}, [activeUid, isMobile, refitNonce]);

	if (!activeUid) return null;
	const item = items.find((candidate) => candidate.uid === activeUid);
	if (!item) return null;
	const resolved = resolveItem(item, customPedals);
	if (!resolved.definition) return null;
	const jacks = resolveItemJacks(item, customPedals);
	if (jacks.length === 0) return null;
	const footprint = itemFootprint(item, customPedals);
	const safeScale = Math.max(scale, 0.0001);
	const origin = itemWorldOrigin(item, boards);
	const originPx = { x: cmToPx(origin.x), y: cmToPx(origin.y) };
	const widthPx = cmToPx(footprint.widthCm);
	const heightPx = cmToPx(footprint.heightCm);
	const rotation = itemVisualRotationDeg(item, boards);
	const hitRadius =
		(coarse ? JACK_PROOF.hitTouchPx : JACK_PROOF.hitPx) / 2 / safeScale;

	const nearest = (
		event: KonvaEventObject<MouseEvent | TouchEvent>,
	): { index: number; point: { x: number; y: number } } | null => {
		const group = groupRef.current;
		const pointer = event.target.getStage()?.getPointerPosition();
		if (!group || !pointer) return null;
		const local = group.getAbsoluteTransform().copy().invert().point(pointer);
		const target = {
			x: Math.min(1, Math.max(0, local.x / widthPx)),
			y: Math.min(1, Math.max(0, local.y / heightPx)),
		};
		const hitCm = pxToCm(hitRadius);
		let best: {
			index: number;
			distance: number;
			point: { x: number; y: number };
		} | null = null;
		for (let index = 0; index < jacks.length; index++) {
			const jack = jacks[index];
			if (!jack) continue;
			const point = jackPointNormalized(jack, footprint);
			const distance = Math.hypot(
				(point.x - target.x) * footprint.widthCm,
				(point.y - target.y) * footprint.heightCm,
			);
			if (distance > hitCm) continue;
			if (!best || distance < best.distance) {
				best = { index, distance, point };
			}
		}
		return best ? { index: best.index, point: best.point } : null;
	};

	const updateHover = (event: KonvaEventObject<MouseEvent | TouchEvent>) => {
		const found = nearest(event);
		setHover(found ? found.index : null);
	};
	const begin = (event: KonvaEventObject<MouseEvent | TouchEvent>) => {
		event.cancelBubble = true;
		if (event.evt instanceof MouseEvent && event.evt.button !== 0) return;
		const found = nearest(event);
		if (!found) return;
		useSelection.getState().selectItem(item.uid);
		beginDrag(item.uid, found.index, found.point.x, found.point.y);
	};

	const arm = JACK_PROOF.cropArmPx / safeScale;
	const offset = JACK_PROOF.cropOffsetPx / safeScale;
	const gap = JACK_PROOF.cropGapPx / safeScale;
	const tickWidth = JACK_PROOF.cropStrokePx / safeScale;
	const frameTicks = [
		{ x: -offset, y: -offset, sx: -1, sy: -1 },
		{ x: widthPx + offset, y: -offset, sx: 1, sy: -1 },
		{ x: widthPx + offset, y: heightPx + offset, sx: 1, sy: 1 },
		{ x: -offset, y: heightPx + offset, sx: -1, sy: 1 },
	].map((corner, index) => (
		<Group
			// biome-ignore lint/suspicious/noArrayIndexKey: four fixed registration corners
			key={`tick-${index}`}
			x={corner.x}
			y={corner.y}
			listening={false}
		>
			<Line
				points={[corner.sx * gap, 0, corner.sx * arm, 0]}
				stroke={theme.proofFrame}
				strokeWidth={tickWidth}
				listening={false}
			/>
			<Line
				points={[0, corner.sy * gap, 0, corner.sy * arm]}
				stroke={theme.proofFrame}
				strokeWidth={tickWidth}
				listening={false}
			/>
		</Group>
	));

	const activeIndex = drag?.jack ?? hoverJack ?? null;
	const tagPin =
		activeIndex !== null && jacks[activeIndex]
			? {
					index: activeIndex,
					jack: jacks[activeIndex],
					point: drag
						? { x: drag.x, y: drag.y }
						: jackPointNormalized(jacks[activeIndex], footprint),
				}
			: null;

	return (
		<Layer name="jack-proof">
			<Group ref={groupRef} x={originPx.x} y={originPx.y} rotation={rotation}>
				<Rect
					width={widthPx}
					height={heightPx}
					fill="rgba(0,0,0,0.001)"
					listening={false}
				/>
				{frameTicks}
			</Group>

			{jacks.map((jack, index) => {
				const point = jackPointNormalized(jack, footprint);
				const live = drag?.jack === index && drag.uid === item.uid;
				const xNorm = live ? drag.x : point.x;
				const yNorm = live ? drag.y : point.y;
				const world = jackWorld(item, boards, xNorm, yNorm);
				const isSelected = selectedJack === index;
				const isHovered = hoverJack === index;
				const isDragging = live;
				const diameter =
					isDragging || isSelected
						? JACK_PROOF.selectedPinPx
						: isHovered
							? JACK_PROOF.hoverPinPx
							: JACK_PROOF.pinPx;
				const radius = diameter / 2 / safeScale;
				const hollow =
					jack.corrected !== true && (jack.assumed || jack.approximate);
				const ringColor =
					isDragging || isSelected || isHovered
						? theme.selection
						: theme.itemLabelInk;
				const opacity = drag && drag.jack !== index ? JACK_PROOF.dimOpacity : 1;
				return (
					<Group
						// biome-ignore lint/suspicious/noArrayIndexKey: jacks carry no id; the index is the cable reference
						key={`proof-pin-${index}`}
						x={cmToPx(world.x)}
						y={cmToPx(world.y)}
						opacity={opacity}
					>
						{isDragging ? (
							<Circle
								radius={radius + JACK_PROOF.haloPx / safeScale}
								stroke={theme.selection}
								strokeWidth={1 / safeScale}
								fillEnabled={false}
								listening={false}
							/>
						) : null}
						<Circle
							radius={radius + JACK_PROOF.ringPx / safeScale}
							fill={theme.itemLabelBg}
							stroke={theme.itemLabelInk}
							strokeWidth={1 / safeScale}
							listening={false}
						/>
						{hollow ? (
							<Line
								points={[
									0,
									-radius * 0.7,
									radius * 0.7,
									0,
									0,
									radius * 0.7,
									-radius * 0.7,
									0,
								]}
								closed
								stroke={ringColor}
								strokeWidth={(isHovered || isDragging ? 2 : 1.5) / safeScale}
								listening={false}
							/>
						) : (
							<>
								<Circle
									radius={radius * 0.62}
									stroke={ringColor}
									strokeWidth={
										(isHovered || isDragging ? 2 : JACK_PROOF.ringPx) /
										safeScale
									}
									listening={false}
								/>
								<Circle
									radius={radius * 0.16}
									fill={ringColor}
									listening={false}
								/>
							</>
						)}
						{isDragging || isSelected || isHovered ? (
							<Circle
								radius={radius + 3 / safeScale}
								stroke={theme.selection}
								strokeWidth={
									(isDragging ? JACK_PROOF.selectedRingPx : JACK_PROOF.ringPx) /
									safeScale
								}
								listening={false}
							/>
						) : null}
						<Circle
							name="jack-proof-pin"
							radius={hitRadius}
							fill="rgba(0,0,0,0.001)"
							onMouseMove={updateHover}
							onMouseEnter={updateHover}
							onMouseLeave={() => setHover(null)}
							onMouseDown={begin}
							onTouchStart={begin}
						/>
					</Group>
				);
			})}

			{tagPin ? (
				<ProofTag
					item={item}
					boards={boards}
					footprint={footprint}
					jack={tagPin.jack}
					jackLabel={jackKindLabelAt(jacks, tagPin.index)}
					point={tagPin.point}
					dragging={drag !== null}
					units={units}
					theme={theme}
					scale={safeScale}
					viewportX={viewportX}
					viewportY={viewportY}
					stageWidth={size.width}
					stageHeight={size.height}
				/>
			) : null}
		</Layer>
	);
}

function ProofTag({
	item,
	boards,
	footprint,
	jack,
	jackLabel,
	point,
	dragging,
	units,
	theme,
	scale,
	viewportX,
	viewportY,
	stageWidth,
	stageHeight,
}: {
	item: PlacedItem;
	boards: PlacedBoard[];
	footprint: { widthCm: number; heightCm: number };
	jack: ReturnType<typeof resolveItemJacks>[number];
	jackLabel: string;
	point: { x: number; y: number };
	dragging: boolean;
	units: "cm" | "in";
	theme: CanvasTheme;
	scale: number;
	viewportX: number;
	viewportY: number;
	stageWidth: number;
	stageHeight: number;
}) {
	const world = jackWorld(item, boards, point.x, point.y);
	const pinScreenX = cmToPx(world.x) * scale + viewportX;
	const pinScreenY = cmToPx(world.y) * scale + viewportY;
	const provenance =
		jack.corrected === true
			? "Corrected"
			: jack.assumed === true
				? "Assumed"
				: jack.approximate === true
					? "Approx"
					: "Catalog";
	const text = dragging
		? `${jackLabel} · ${formatJackPosition(
				{ ...jack, xNorm: point.x, yNorm: point.y },
				footprint.widthCm,
				footprint.heightCm,
				units,
			)}`
		: `${jackLabel} · ${provenance}`;
	const screenWidth = Math.min(
		JACK_PROOF.tagMaxWidthPx,
		text.length * (JACK_PROOF.tagFontPx * 0.62) + JACK_PROOF.tagPadPx * 2,
	);
	const width = screenWidth / scale;
	const height = JACK_PROOF.tagHeightPx / scale;
	const half = screenWidth / 2;
	const corners = itemWorldCorners(item, boards).map((corner) => ({
		x: cmToPx(corner.x) * scale + viewportX,
		y: cmToPx(corner.y) * scale + viewportY,
	}));
	const minX = Math.min(...corners.map((corner) => corner.x));
	const maxX = Math.max(...corners.map((corner) => corner.x));
	const minY = Math.min(...corners.map((corner) => corner.y));
	const maxY = Math.max(...corners.map((corner) => corner.y));
	const putRight = pinScreenX >= (minX + maxX) / 2;
	const targetX = putRight
		? maxX + JACK_PROOF.tagGapPx + half
		: minX - JACK_PROOF.tagGapPx - half;
	const clampedScreenX = Math.min(
		Math.max(targetX, half + 12),
		Math.max(half + 12, stageWidth - half - 12),
	);
	const clampedScreenY = Math.min(
		Math.max(pinScreenY, minY + JACK_PROOF.tagHeightPx / 2 + 8),
		Math.max(
			minY + JACK_PROOF.tagHeightPx / 2 + 8,
			Math.min(maxY, stageHeight - 12) - JACK_PROOF.tagHeightPx / 2 - 8,
		),
	);
	return (
		<Group
			x={(clampedScreenX - viewportX) / scale}
			y={(clampedScreenY - viewportY) / scale - height / 2}
			listening={false}
		>
			<Rect
				x={-width / 2}
				y={0}
				width={width}
				height={height}
				fill={theme.itemLabelBg}
				stroke={theme.itemLabelInk}
				strokeWidth={1 / scale}
				cornerRadius={4 / scale}
			/>
			<Text
				x={-width / 2 + JACK_PROOF.tagPadPx / scale}
				y={0}
				width={width - (JACK_PROOF.tagPadPx * 2) / scale}
				height={height}
				text={text}
				align="center"
				verticalAlign="middle"
				wrap="none"
				ellipsis
				fontFamily={CANVAS_FONTS.mono}
				fontSize={JACK_PROOF.tagFontPx / scale}
				fill={theme.itemLabelInk}
			/>
		</Group>
	);
}
