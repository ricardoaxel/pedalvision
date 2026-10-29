import type Konva from "konva";
import { useEffect, useRef, useState } from "react";
import { Circle, Group, Layer, Line, Rect, Text } from "react-konva";
import { cmToPx, pxToCm } from "../lib/geometry";
import { easeOutCubic, MOTION, motionMs } from "../lib/motion";
import { useCableDrag } from "../state/cableDrag";
import { useEndpointDrag } from "../state/endpointDrag";
import { useGesture } from "../state/gesture";
import { useReadOnly } from "../state/readOnly";
import { type Endpoint, useScene } from "../state/scene";
import { useSelection } from "../state/selection";
import { useViewport } from "../state/viewport";
import { CANVAS_FONTS, type CanvasTheme, ENDPOINT } from "../styles/theme";
import { useGraphPresence } from "./useGraphPresence";

interface EndpointLayerProps {
	theme: CanvasTheme;
}

/**
 * Amp / instrument terminal tags (P4-02 "Patch Drafting"). Render above the
 * CableLayer and below the DragLayer so an incident cable disappears under the
 * tag and reads as plugged in. Dragging is transient: the tag's live world cm
 * lives in `state/endpointDrag`, incident cables follow it, and the scene store
 * is written exactly once on pointerup (one history step, one autosave).
 */
export function EndpointLayer({ theme }: EndpointLayerProps) {
	const endpoints = useScene((state) => state.endpoints);
	const moveEndpoint = useScene((state) => state.moveEndpoint);
	const readOnly = useReadOnly((state) => state.readOnly);
	const navigating = useGesture((state) => state.navigating);
	const { mounted, exiting, reduced } = useGraphPresence();
	const scale = useViewport((state) => state.scale);
	const selectedUid = useSelection((state) =>
		state.selection?.kind === "endpoint" ? state.selection.uid : null,
	);
	const cableTarget = useCableDrag((state) => state.target);
	const safeScale = Math.max(scale, 0.0001);
	const draggingRef = useRef<string | null>(null);
	const groupRef = useRef<Konva.Group>(null);
	const [entering, setEntering] = useState(mounted && !readOnly && !reduced);

	useEffect(() => {
		const group = groupRef.current;
		if (!mounted || !group) return;
		if (exiting) {
			setEntering(false);
			group.opacity(1);
			const durationMs = motionMs(MOTION.fast, reduced);
			if (durationMs <= 0) return;
			const tween = group.to({
				opacity: 0,
				duration: durationMs / 1000,
				easing: easeOutCubic,
			});
			return () => {
				tween.destroy();
			};
		}
		if (reduced || readOnly) {
			group.opacity(1);
			setEntering(false);
			return;
		}
		group.opacity(0);
		setEntering(true);
		const tween = group.to({
			opacity: 1,
			duration: MOTION.base / 1000,
			easing: easeOutCubic,
		});
		const timer = window.setTimeout(() => setEntering(false), MOTION.base + 40);
		return () => {
			window.clearTimeout(timer);
			tween.destroy();
		};
	}, [mounted, exiting, reduced, readOnly]);

	// Pan/pinch takes the gesture over: commit the endpoint where it currently
	// floats (same "drop in place" contract as a lifted pedal).
	useEffect(() => {
		if (!navigating) return;
		const uid = draggingRef.current;
		const world = useEndpointDrag.getState().worldCm;
		if (!uid || !world) return;
		draggingRef.current = null;
		moveEndpoint(uid, world);
		useEndpointDrag.getState().clear();
	}, [navigating, moveEndpoint]);

	if (!mounted) return null;
	return (
		<Layer>
			<Group ref={groupRef} listening={!entering && !exiting}>
				{endpoints.map((endpoint) => (
					<EndpointTag
						key={endpoint.uid}
						endpoint={endpoint}
						theme={theme}
						scale={safeScale}
						selected={selectedUid === endpoint.uid}
						readOnly={readOnly}
						draggable={!readOnly && !navigating}
						connectTarget={
							cableTarget?.kind === "endpoint" &&
							cableTarget.uid === endpoint.uid
						}
						onSelect={() =>
							useSelection.getState().selectEndpoint(endpoint.uid)
						}
						onDragStart={(node) => {
							draggingRef.current = endpoint.uid;
							useEndpointDrag.getState().begin(endpoint.uid, {
								x: pxToCm(node.x()),
								y: pxToCm(node.y()),
							});
						}}
						onDragMove={(node) =>
							useEndpointDrag.getState().setWorldCm({
								x: pxToCm(node.x()),
								y: pxToCm(node.y()),
							})
						}
						onDragEnd={(node) => {
							draggingRef.current = null;
							moveEndpoint(endpoint.uid, {
								x: pxToCm(node.x()),
								y: pxToCm(node.y()),
							});
							useEndpointDrag.getState().clear();
						}}
					/>
				))}
			</Group>
		</Layer>
	);
}

function EndpointTag({
	endpoint,
	theme,
	scale,
	selected,
	readOnly,
	draggable,
	connectTarget,
	onSelect,
	onDragStart,
	onDragMove,
	onDragEnd,
}: {
	endpoint: Endpoint;
	theme: CanvasTheme;
	scale: number;
	selected: boolean;
	readOnly: boolean;
	draggable: boolean;
	connectTarget: boolean;
	onSelect: () => void;
	onDragStart: (node: Konva.Group) => void;
	onDragMove: (node: Konva.Group) => void;
	onDragEnd: (node: Konva.Group) => void;
}) {
	// Only the dragged tag subscribes to the live position (not every tag).
	const liveWorldCm = useEndpointDrag((state) =>
		state.uid === endpoint.uid ? state.worldCm : null,
	);
	const xCm = liveWorldCm?.x ?? endpoint.x;
	const yCm = liveWorldCm?.y ?? endpoint.y;
	const label = endpoint.kind === "amp" ? "AMP" : "INSTR";
	const height = ENDPOINT.heightPx / scale;
	const glyphWidth = ENDPOINT.glyphPx / scale;
	const width = Math.max(
		ENDPOINT.minWidthPx / scale,
		(label.length * 6.6 + 28) / scale,
	);
	const hitSize = ENDPOINT.hitPx / scale;
	const border = selected || connectTarget ? theme.selection : theme.jack;

	return (
		<Group
			x={cmToPx(xCm)}
			y={cmToPx(yCm)}
			draggable={draggable}
			listening={!readOnly}
			onMouseDown={(event) => {
				if (event.evt.button !== 0) return;
				event.cancelBubble = true;
				onSelect();
			}}
			onTouchStart={(event) => {
				event.cancelBubble = true;
				onSelect();
			}}
			onDragStart={(event) =>
				onDragStart(event.target as unknown as Konva.Group)
			}
			onDragMove={(event) => onDragMove(event.target as unknown as Konva.Group)}
			onDragEnd={(event) => onDragEnd(event.target as unknown as Konva.Group)}
		>
			<Rect
				x={-width / 2}
				y={-height / 2}
				width={width}
				height={height}
				fill={theme.itemLabelBg}
				stroke={theme.canvasBackground}
				strokeWidth={2 / scale}
				cornerRadius={endpoint.kind === "amp" ? 4 / scale : height / 2}
			/>
			<Rect
				x={-width / 2}
				y={-height / 2}
				width={width}
				height={height}
				stroke={border}
				strokeWidth={(selected || connectTarget ? 2 : 1.5) / scale}
				cornerRadius={endpoint.kind === "amp" ? 4 / scale : height / 2}
				fillEnabled={false}
				perfectDrawEnabled={false}
			/>
			{endpoint.kind === "amp" ? (
				<>
					<Rect
						x={-width / 2 + 8 / scale}
						y={-glyphWidth / 2}
						width={glyphWidth}
						height={glyphWidth}
						stroke={theme.itemLabelInk}
						strokeWidth={1 / scale}
						cornerRadius={1 / scale}
						listening={false}
					/>
					<Circle
						x={-width / 2 + 8 / scale + glyphWidth * 0.3}
						y={0}
						radius={1.6 / scale}
						fill={theme.itemLabelInk}
						listening={false}
					/>
					<Circle
						x={-width / 2 + 8 / scale + glyphWidth * 0.7}
						y={0}
						radius={1.6 / scale}
						fill={theme.itemLabelInk}
						listening={false}
					/>
				</>
			) : (
				<Line
					points={
						[
							[-width / 2 + 8 / scale, -glyphWidth / 2],
							[-width / 2 + 8 / scale, glyphWidth / 2],
						].flat() as number[]
					}
					stroke={theme.itemLabelInk}
					strokeWidth={1.5 / scale}
					lineCap="round"
					listening={false}
				/>
			)}
			<Text
				text={label}
				x={-width / 2 + glyphWidth + 12 / scale}
				y={-height / 2}
				width={width - glyphWidth - 16 / scale}
				height={height}
				verticalAlign="middle"
				fontFamily={CANVAS_FONTS.mono}
				fontSize={ENDPOINT.labelPx / scale}
				letterSpacing={0.5 / scale}
				fill={theme.itemLabelInk}
				wrap="none"
				ellipsis
				listening={false}
			/>
			{connectTarget ? (
				<Rect
					x={-width / 2 + 3 / scale}
					y={-height / 2 + 3 / scale}
					width={width - 6 / scale}
					height={height - 6 / scale}
					stroke={theme.selection}
					strokeWidth={1 / scale}
					cornerRadius={endpoint.kind === "amp" ? 3 / scale : height / 2}
					fillEnabled={false}
					listening={false}
					perfectDrawEnabled={false}
				/>
			) : null}
			{/* 44px touch target, visually transparent. */}
			<Rect
				x={-hitSize / 2}
				y={-hitSize / 2}
				width={hitSize}
				height={hitSize}
				fill="rgba(0,0,0,0.001)"
				perfectDrawEnabled={false}
			/>
		</Group>
	);
}
