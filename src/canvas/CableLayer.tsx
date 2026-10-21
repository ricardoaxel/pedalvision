import { useMemo } from "react";
import { Layer, Line, Path } from "react-konva";
import { cableCurve, cablePathData } from "../lib/cablePath";
import { rotatePoint } from "../lib/geometry";
import {
	type AnchorPoint,
	anchorIndexFor,
	cableEndAnchorFromIndex,
	jackAnchorWorld,
	jackNormalLocal,
	liftedJackAnchor,
} from "../lib/jackAnchor";
import { useBoardDrag } from "../state/boardDrag";
import { useCableDrag } from "../state/cableDrag";
import { useDrag } from "../state/drag";
import { useEndpointDrag } from "../state/endpointDrag";
import { useReadOnly } from "../state/readOnly";
import {
	type Cable,
	cableReferencesEndpoint,
	cableReferencesItem,
	useScene,
} from "../state/scene";
import {
	selectSelectedCableUid,
	selectSelectedItemUid,
	useSelection,
} from "../state/selection";
import { useViewport } from "../state/viewport";
import { CABLE, type CanvasTheme } from "../styles/theme";

interface CableLayerProps {
	theme: CanvasTheme;
}

/**
 * Cables render above boards + loose items and below the DragLayer (S5). Every
 * anchor comes from the memoized {@link anchorIndexFor} map — never a per-frame
 * scene scan. A cable is a neutral ink trace over a theme-inverted halo, with one
 * screen-constant arrowhead at the destination end (direction = `from` → `to`).
 *
 * The layer subscribes to scene/selection/zoom only; the live drag preview lives
 * in {@link CablePreview}, so a pointermove never reconciles the whole cable
 * list (P4-02 performance review).
 */
export function CableLayer({ theme }: CableLayerProps) {
	const boards = useScene((state) => state.boards);
	const items = useScene((state) => state.items);
	const customPedals = useScene((state) => state.customPedals);
	const endpoints = useScene((state) => state.endpoints);
	const cables = useScene((state) => state.cables);
	const readOnly = useReadOnly((state) => state.readOnly);
	const scale = useViewport((state) => state.scale);
	const selectedCableUid = useSelection(selectSelectedCableUid);
	const selectedItemUid = useSelection(selectSelectedItemUid);
	const hoveredItemUid = useSelection((state) => state.hoveredItemUid);
	const selectedEndpointUid = useSelection((state) =>
		state.selection?.kind === "endpoint" ? state.selection.uid : null,
	);
	// Live endpoint drag: incident cables follow the tag frame-by-frame. Only
	// endpoint drags subscribe here (not cable drags, which have their own preview).
	const draggingEndpointUid = useEndpointDrag((state) => state.uid);
	const draggingEndpointCm = useEndpointDrag((state) => state.worldCm);
	// A lifted pedal renders in the DragLayer at its transient world origin; its
	// incident cables must follow it frame-by-frame (owner bug report).
	const liftedUid = useDrag((state) => state.liftedUid);
	const liftedWorldCm = useDrag((state) => state.liftedWorldCm);
	const liftedRotationDeg = useDrag((state) => state.liftedRotationDeg);
	// A board is moved natively by Konva and commits on release; its attached
	// pedals + cables must follow the live transform meanwhile (owner bug report).
	const boardDragUid = useBoardDrag((state) => state.uid);
	const boardDragX = useBoardDrag((state) => state.x);
	const boardDragY = useBoardDrag((state) => state.y);
	const boardDragRotation = useBoardDrag((state) => state.rotationDeg);

	const index = anchorIndexFor({ boards, items, customPedals, endpoints });
	const safeScale = Math.max(scale, 0.0001);
	const dimFocus =
		selectedItemUid ?? hoveredItemUid ?? selectedEndpointUid ?? null;

	const rendered = useMemo(() => {
		const anchorFor = (end: Cable["from"]): AnchorPoint | null => {
			const anchor = cableEndAnchorFromIndex(end, index);
			if (!anchor) return null;
			// A dragged endpoint's cable should follow the transient position.
			if (
				"endpointUid" in end &&
				draggingEndpointUid === end.endpointUid &&
				draggingEndpointCm
			) {
				return { ...anchor, point: draggingEndpointCm };
			}
			// A lifted pedal lives in the DragLayer at its live world origin +
			// composed rotation; recompute its jack anchor there so the cable is
			// attached to the pedal while it moves.
			if (
				!("endpointUid" in end) &&
				liftedUid === end.itemUid &&
				liftedWorldCm
			) {
				const item = items.find((candidate) => candidate.uid === end.itemUid);
				if (item) {
					return liftedJackAnchor(
						anchor,
						item,
						customPedals,
						liftedWorldCm,
						liftedRotationDeg ?? item.rotationDeg,
					);
				}
			}
			// A board drag/rotation moves its attached pedals without committing to
			// the scene until release; recompute those anchors from the live board.
			if (
				!("endpointUid" in end) &&
				boardDragUid &&
				boardDragUid ===
					items.find((candidate) => candidate.uid === end.itemUid)?.boardUid
			) {
				const item = items.find((candidate) => candidate.uid === end.itemUid);
				const board = item?.boardUid
					? boards.find((candidate) => candidate.uid === item.boardUid)
					: undefined;
				if (item && board && anchor.jack) {
					const liveBoard = {
						...board,
						x: boardDragX,
						y: boardDragY,
						rotationDeg: boardDragRotation,
					};
					const point = jackAnchorWorld(
						item,
						end.jack,
						[liveBoard],
						customPedals,
					);
					if (point) {
						return {
							...anchor,
							point,
							normal: rotatePoint(
								jackNormalLocal(anchor.jack.edge),
								{ x: 0, y: 0 },
								boardDragRotation + item.rotationDeg,
							),
						};
					}
				}
			}
			return anchor;
		};
		return cables.flatMap((cable) => {
			const from = anchorFor(cable.from);
			const to = anchorFor(cable.to);
			if (!from || !to) return [];
			const selected = cable.uid === selectedCableUid;
			const incident =
				(dimFocus !== null &&
					(cableReferencesItem(cable, dimFocus) ||
						cableReferencesEndpoint(cable, dimFocus))) ||
				selected;
			const dimmed = dimFocus !== null && !incident;
			return [
				{
					uid: cable.uid,
					curve: cableCurve(from, to, safeScale),
					selected,
					opacity: dimmed ? CABLE.dimOpacity : 1,
				},
			];
		});
	}, [
		cables,
		index,
		selectedCableUid,
		dimFocus,
		safeScale,
		draggingEndpointUid,
		draggingEndpointCm,
		liftedUid,
		liftedWorldCm,
		liftedRotationDeg,
		boardDragUid,
		boardDragX,
		boardDragY,
		boardDragRotation,
		items,
		boards,
		customPedals,
	]);

	const colors = (selected: boolean) => ({
		halo: selected ? theme.selection : theme.cableHalo,
		haloWidth: (selected ? CABLE.selectedHaloPx : CABLE.haloPx) / safeScale,
		line: selected ? theme.selection : theme.cable,
		lineWidth: (selected ? CABLE.selectedStrokePx : CABLE.strokePx) / safeScale,
	});

	return (
		<Layer>
			{rendered.map(({ uid, curve, selected, opacity }) => {
				const color = colors(selected);
				return (
					<Path
						key={`cable-halo-${uid}`}
						data={cablePathData(curve)}
						stroke={color.halo}
						strokeWidth={color.haloWidth}
						lineCap="round"
						lineJoin="round"
						opacity={opacity}
						listening={false}
						perfectDrawEnabled={false}
					/>
				);
			})}
			{rendered.map(({ uid, curve, selected, opacity }) => {
				const color = colors(selected);
				return (
					<Path
						key={`cable-line-${uid}`}
						data={cablePathData(curve)}
						stroke={color.line}
						strokeWidth={color.lineWidth}
						lineCap="round"
						lineJoin="round"
						opacity={opacity}
						hitStrokeWidth={CABLE.hitStrokePx / safeScale}
						listening={!readOnly}
						onMouseDown={(event) => {
							if (event.evt.button !== 0) return;
							event.cancelBubble = true;
							useSelection.getState().selectCable(uid);
						}}
						onTouchStart={(event) => {
							event.cancelBubble = true;
							useSelection.getState().selectCable(uid);
						}}
						perfectDrawEnabled={false}
					/>
				);
			})}
			{rendered.map(({ uid, curve, selected, opacity }) => {
				const color = colors(selected);
				return (
					<Line
						key={`cable-arrow-${uid}`}
						points={curve.arrow.flatMap((point) => [point.x, point.y])}
						closed
						fill={color.line}
						stroke={theme.canvasBackground}
						strokeWidth={1 / safeScale}
						opacity={opacity}
						listening={false}
						perfectDrawEnabled={false}
					/>
				);
			})}
			<CablePreview theme={theme} />
		</Layer>
	);
}

/**
 * The transient drag-connect preview. It is the only component that subscribes
 * to the live pointer, so a move re-renders one dashed path — not the whole
 * cable list or every pedal.
 */
function CablePreview({ theme }: { theme: CanvasTheme }) {
	const boards = useScene((state) => state.boards);
	const items = useScene((state) => state.items);
	const customPedals = useScene((state) => state.customPedals);
	const endpoints = useScene((state) => state.endpoints);
	const scale = useViewport((state) => state.scale);
	const source = useCableDrag((state) => state.source);
	const pointerWorldCm = useCableDrag((state) => state.pointerWorldCm);
	const target = useCableDrag((state) => state.target);

	const index = anchorIndexFor({ boards, items, customPedals, endpoints });
	const from = source
		? index.items.get(`item:${source.itemUid}:${source.jackIndex}`)
		: undefined;
	const to: AnchorPoint | null = (() => {
		if (target?.kind === "item") {
			return index.items.get(`item:${target.uid}:${target.jackIndex}`) ?? null;
		}
		if (target?.kind === "endpoint") {
			return index.endpoints.get(`endpoint:${target.uid}`) ?? null;
		}
		return pointerWorldCm
			? { point: pointerWorldCm, normal: null, assumed: false }
			: null;
	})();
	if (!from || !to) return null;
	const safeScale = Math.max(scale, 0.0001);
	const preview = cableCurve(from, to, safeScale);
	return (
		<Path
			data={cablePathData(preview)}
			stroke={theme.selection}
			strokeWidth={CABLE.selectedStrokePx / safeScale}
			dash={[...CABLE.previewDash].map((value) => value / safeScale)}
			opacity={0.7}
			lineCap="round"
			lineJoin="round"
			listening={false}
			perfectDrawEnabled={false}
		/>
	);
}
