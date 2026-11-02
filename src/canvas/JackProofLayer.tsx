import type { KonvaEventObject } from "konva/lib/Node";
import { useEffect } from "react";
import { Circle, Group, Layer, Line, Rect, Text } from "react-konva";
import { jackKindLabel } from "../lib/customPedal";
import { cmToPx, PX_PER_CM, pxToCm } from "../lib/geometry";
import { jackPointNormalized, normalizedToWorld } from "../lib/jackProof";
import { formatJackPosition } from "../lib/partInfo";
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
 * Canvas proof layer (F-33 “Press Proof”). While a pedal is being proofed, every
 * effective jack becomes a draggable pin on the actual pedal (including
 * non-cable kinds). Spacing/size are screen-constant; positions are world cm.
 */
export function JackProofLayer({ theme }: { theme: CanvasTheme }) {
	const activeUid = useJackProof((state) => state.activeUid);
	const selectedJack = useJackProof((state) => state.selectedJack);
	const drag = useJackProof((state) => state.drag);
	const items = useScene((state) => state.items);
	const boards = useScene((state) => state.boards);
	const customPedals = useScene((state) => state.customPedals);
	const scale = useViewport((state) => state.scale);
	const coarse = useCoarsePointer();
	const isMobile = useIsMobile();
	useEffect(() => {
		if (!activeUid) return;
		const state = useScene.getState();
		const active = state.items.find((candidate) => candidate.uid === activeUid);
		if (!active) return;
		const footprint = itemFootprint(active, state.customPedals);
		const longEdgePx =
			Math.max(footprint.widthCm, footprint.heightCm) * PX_PER_CM * scale;
		if (longEdgePx >= (isMobile ? 200 : 240)) return;
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
					? { top: 72, right: 20, bottom: 200, left: 20 }
					: { top: 80, right: 40, bottom: 60, left: 40 },
				paddingPx: 48,
				maxScale: 6,
			},
		);
		if (fit) useViewport.getState().setViewport(fit);
	}, [activeUid, isMobile, scale]);
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
	const arm = JACK_PROOF.cropArmPx / safeScale;
	const offset = JACK_PROOF.cropOffsetPx / safeScale;
	const labelScale = safeScale;
	const selected = selectedJack;
	const beginNearest = (event: KonvaEventObject<MouseEvent | TouchEvent>) => {
		event.cancelBubble = true;
		const stage = event.target.getStage();
		const pointer = stage?.getPointerPosition();
		if (!pointer) return;
		const local = event.target
			.getAbsoluteTransform()
			.copy()
			.invert()
			.point(pointer);
		const target = {
			x: Math.min(1, Math.max(0, local.x / widthPx)),
			y: Math.min(1, Math.max(0, local.y / heightPx)),
		};
		const hitCm = pxToCm(
			(coarse ? JACK_PROOF.hitTouchPx : JACK_PROOF.hitPx) /
				2 /
				Math.max(scale, 0.0001),
		);
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
		if (!best) return;
		useSelection.getState().selectItem(item.uid);
		useJackProof
			.getState()
			.beginDrag(item.uid, best.index, best.point.x, best.point.y);
	};

	const cropMarks = [
		{ x: -offset, y: -offset, dx: 1, dy: 1 },
		{ x: widthPx + offset, y: -offset, dx: -1, dy: 1 },
		{ x: widthPx + offset, y: heightPx + offset, dx: -1, dy: -1 },
		{ x: -offset, y: heightPx + offset, dx: 1, dy: -1 },
	].map((corner, index) => (
		<Group
			// biome-ignore lint/suspicious/noArrayIndexKey: four fixed crop corners
			key={`crop-${index}`}
			x={corner.x}
			y={corner.y}
		>
			<Line
				points={[0, 0, corner.dx * arm, 0]}
				stroke={theme.selection}
				strokeWidth={JACK_PROOF.cropStrokePx / safeScale}
				listening={false}
			/>
			<Line
				points={[0, 0, 0, corner.dy * arm]}
				stroke={theme.selection}
				strokeWidth={JACK_PROOF.cropStrokePx / safeScale}
				listening={false}
			/>
		</Group>
	));

	return (
		<Layer>
			<Group x={originPx.x} y={originPx.y} rotation={rotation}>
				<Rect
					width={widthPx}
					height={heightPx}
					fill="rgba(0,0,0,0.001)"
					onMouseDown={beginNearest}
					onTouchStart={beginNearest}
				/>
				{cropMarks}
			</Group>
			{jacks
				.map((jack, index) => {
					const point = jackPointNormalized(jack, footprint);
					const live = drag?.jack === index && drag.uid === item.uid;
					const xNorm = live ? drag.x : point.x;
					const yNorm = live ? drag.y : point.y;
					const world = jackWorld(item, boards, xNorm, yNorm);
					const isSelected = selected === index;
					const radius =
						(isSelected ? JACK_PROOF.selectedPinPx : JACK_PROOF.pinPx) /
						2 /
						safeScale;
					const hollow =
						jack.corrected !== true && (jack.assumed || jack.approximate);
					const label = labelText(
						live ? { ...jack, xNorm, yNorm } : jack,
						footprint,
					);
					const chipWidth = Math.max(80, label.length * 6 + 16) / safeScale;
					const labelY =
						yNorm <= 0.5
							? -(yNorm * heightPx) - 24 / safeScale
							: (1 - yNorm) * heightPx + 8 / safeScale;
					return (
						<Group
							// biome-ignore lint/suspicious/noArrayIndexKey: jacks carry no id; the index is the cable reference
							key={`proof-pin-${index}`}
							x={cmToPx(world.x)}
							y={cmToPx(world.y)}
						>
							<Circle
								radius={radius + 1 / safeScale}
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
									stroke={theme.itemLabelInk}
									strokeWidth={1.5 / safeScale}
									listening={false}
								/>
							) : (
								<>
									<Circle
										radius={radius * 0.62}
										stroke={theme.itemLabelInk}
										strokeWidth={1.2 / safeScale}
										listening={false}
									/>
									<Circle
										radius={radius * 0.16}
										fill={theme.itemLabelInk}
										listening={false}
									/>
								</>
							)}
							{isSelected ? (
								<Circle
									radius={radius + 3 / safeScale}
									stroke={theme.selection}
									strokeWidth={2 / safeScale}
									listening={false}
								/>
							) : null}
							{isSelected ? (
								<Group y={labelY} listening={false}>
									<Rect
										x={-(chipWidth / 2)}
										y={-12 / safeScale}
										width={chipWidth}
										height={20 / safeScale}
										fill={theme.itemLabelBg}
										cornerRadius={3 / safeScale}
									/>
									<Text
										text={label}
										width={chipWidth}
										y={-12 / safeScale}
										height={20 / safeScale}
										align="center"
										verticalAlign="middle"
										fontFamily={CANVAS_FONTS.mono}
										fontSize={10 / labelScale}
										fill={theme.itemLabelInk}
									/>
								</Group>
							) : null}
						</Group>
					);
				})
				.reverse()}
		</Layer>
	);
}

function labelText(
	jack: ReturnType<typeof resolveItemJacks>[number],
	footprint: { widthCm: number; heightCm: number },
): string {
	const point = jackPointNormalized(jack, footprint);
	const position = formatJackPosition(
		{ ...jack, xNorm: point.x, yNorm: point.y },
		footprint.widthCm,
		footprint.heightCm,
		"cm",
	);
	return position
		? `${jackKindLabel(jack.kind)} · ${position}`
		: jackKindLabel(jack.kind);
}
