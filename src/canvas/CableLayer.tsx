import { useMemo } from "react";
import { Layer, Line, Path } from "react-konva";
import { type CableCurve, cableCurve, cablePathData } from "../lib/cablePath";
import { rotatePoint } from "../lib/geometry";
import {
	type AnchorIndex,
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
	normalizeCableDirection,
	sameCableEnd,
	useScene,
} from "../state/scene";
import {
	selectSelectedCableUid,
	selectSelectedItemUid,
	useSelection,
} from "../state/selection";
import { useSettings } from "../state/settings";
import { useViewport } from "../state/viewport";
import { CABLE, type CanvasTheme } from "../styles/theme";
import { useCoarsePointer } from "./useCoarsePointer";

interface CableLayerProps {
	theme: CanvasTheme;
}

interface RenderedCable {
	uid: string;
	curve: CableCurve;
	selected: boolean;
	opacity: number;
}

interface RenderOptions {
	cables: Cable[];
	index: AnchorIndex;
	boards: ReturnType<typeof useScene.getState>["boards"];
	items: ReturnType<typeof useScene.getState>["items"];
	customPedals: ReturnType<typeof useScene.getState>["customPedals"];
	scale: number;
	selectedCableUid: string | null;
	dimFocus: string | null;
	liftedUid: string | null;
	liftedWorldCm: { x: number; y: number } | null;
	liftedRotationDeg: number | null;
	boardDragUid: string;
	boardDragX: number;
	boardDragY: number;
	boardDragRotation: number;
	draggingEndpointUid: string | null;
	draggingEndpointCm: { x: number; y: number } | null;
}

/** Build the drawable cable list (curves + selected/dim state). */
function renderCables(options: RenderOptions): RenderedCable[] {
	const {
		cables,
		index,
		boards,
		items,
		customPedals,
		scale,
		selectedCableUid,
		dimFocus,
		liftedUid,
		liftedWorldCm,
		liftedRotationDeg,
		boardDragUid,
		boardDragX,
		boardDragY,
		boardDragRotation,
		draggingEndpointUid,
		draggingEndpointCm,
	} = options;
	const safeScale = Math.max(scale, 0.0001);
	const itemByUid = new Map(items.map((item) => [item.uid, item]));

	const anchorFor = (end: Cable["from"]): AnchorPoint | null => {
		const anchor = cableEndAnchorFromIndex(end, index);
		if (!anchor) return null;
		// A dragged endpoint's cable follows the transient position.
		if (
			"endpointUid" in end &&
			draggingEndpointUid === end.endpointUid &&
			draggingEndpointCm
		) {
			return { ...anchor, point: draggingEndpointCm };
		}
		const item = "endpointUid" in end ? undefined : itemByUid.get(end.itemUid);
		// A lifted pedal renders in the DragLayer at its live world origin/rotation.
		if (item && liftedUid === item.uid && liftedWorldCm && !boardDragUid) {
			return liftedJackAnchor(
				anchor,
				item,
				customPedals,
				liftedWorldCm,
				liftedRotationDeg ?? item.rotationDeg,
			);
		}
		// A board drag/rotation moves its attached pedals without committing.
		if (item && boardDragUid && item.boardUid === boardDragUid && anchor.jack) {
			const board = item.boardUid
				? boards.find((candidate) => candidate.uid === item.boardUid)
				: undefined;
			if (board) {
				const liveBoard = {
					...board,
					x: boardDragX,
					y: boardDragY,
					rotationDeg: boardDragRotation,
				};
				const point = jackAnchorWorld(
					item,
					"endpointUid" in end ? "0" : end.jack,
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
}

/**
 * Cables render above boards + loose items and below the DragLayer (S5). Static
 * cables subscribe to scene/selection/zoom only; the transient `LiveCables`
 * overlay handles the 1–2 incident cables during a pedal/board/endpoint drag, so
 * a pointermove never reconciles the whole graph (P4-02 performance review).
 */
export function CableLayer({ theme }: CableLayerProps) {
	const boards = useScene((state) => state.boards);
	const items = useScene((state) => state.items);
	const customPedals = useScene((state) => state.customPedals);
	const endpoints = useScene((state) => state.endpoints);
	const cables = useScene((state) => state.cables);
	const readOnly = useReadOnly((state) => state.readOnly);
	const showCables = useSettings((state) => state.showCables);
	const scale = useViewport((state) => state.scale);
	const selectedCableUid = useSelection(selectSelectedCableUid);
	const selectedItemUid = useSelection(selectSelectedItemUid);
	const hoveredItemUid = useSelection((state) => state.hoveredItemUid);
	const selectedEndpointUid = useSelection((state) =>
		state.selection?.kind === "endpoint" ? state.selection.uid : null,
	);
	const liftedUid = useDrag((state) => state.liftedUid);
	const boardDragUid = useBoardDrag((state) => state.uid);
	const draggingEndpointUid = useEndpointDrag((state) => state.uid);
	const index = anchorIndexFor({ boards, items, customPedals, endpoints });
	const dimFocus =
		selectedItemUid ?? hoveredItemUid ?? selectedEndpointUid ?? null;

	const hidden = useMemo(() => {
		const set = new Set<string>();
		if (!liftedUid && !boardDragUid && !draggingEndpointUid) return set;
		const boardItemUids = boardDragUid
			? new Set(
					items
						.filter((item) => item.boardUid === boardDragUid)
						.map((item) => item.uid),
				)
			: null;
		for (const cable of cables) {
			const hiddenByLift = liftedUid
				? cableReferencesItem(cable, liftedUid)
				: false;
			const hiddenByEndpoint = draggingEndpointUid
				? cableReferencesEndpoint(cable, draggingEndpointUid)
				: false;
			const hiddenByBoard = boardItemUids
				? "itemUid" in cable.from && boardItemUids.has(cable.from.itemUid)
					? true
					: "itemUid" in cable.to && boardItemUids.has(cable.to.itemUid)
				: false;
			if (hiddenByLift || hiddenByEndpoint || hiddenByBoard) set.add(cable.uid);
		}
		return set;
	}, [cables, items, liftedUid, boardDragUid, draggingEndpointUid]);

	const rendered = useMemo(
		() =>
			showCables
				? renderCables({
						cables: cables.filter((cable) => !hidden.has(cable.uid)),
						index,
						boards,
						items,
						customPedals,
						scale,
						selectedCableUid,
						dimFocus,
						liftedUid: null,
						liftedWorldCm: null,
						liftedRotationDeg: null,
						boardDragUid: "",
						boardDragX: 0,
						boardDragY: 0,
						boardDragRotation: 0,
						draggingEndpointUid: null,
						draggingEndpointCm: null,
					})
				: [],
		[
			showCables,
			cables,
			hidden,
			index,
			boards,
			items,
			customPedals,
			scale,
			selectedCableUid,
			dimFocus,
		],
	);

	if (!showCables) return null;
	return (
		<Layer>
			<CableShapes
				rendered={rendered}
				theme={theme}
				scale={scale}
				readOnly={readOnly}
			/>
			<LiveCables theme={theme} hidden={hidden} />
			<CablePreview theme={theme} />
		</Layer>
	);
}

/** The one-or-two incident cables under a live drag. */
function LiveCables({
	theme,
	hidden,
}: {
	theme: CanvasTheme;
	hidden: Set<string>;
}) {
	const boards = useScene((state) => state.boards);
	const items = useScene((state) => state.items);
	const customPedals = useScene((state) => state.customPedals);
	const endpoints = useScene((state) => state.endpoints);
	const cables = useScene((state) => state.cables);
	const scale = useViewport((state) => state.scale);
	const selectedCableUid = useSelection(selectSelectedCableUid);
	const selectedItemUid = useSelection(selectSelectedItemUid);
	const hoveredItemUid = useSelection((state) => state.hoveredItemUid);
	const selectedEndpointUid = useSelection((state) =>
		state.selection?.kind === "endpoint" ? state.selection.uid : null,
	);
	const liftedUid = useDrag((state) => state.liftedUid);
	const liftedWorldCm = useDrag((state) => state.liftedWorldCm);
	const liftedRotationDeg = useDrag((state) => state.liftedRotationDeg);
	const boardDragUid = useBoardDrag((state) => state.uid);
	const boardDragX = useBoardDrag((state) => state.x);
	const boardDragY = useBoardDrag((state) => state.y);
	const boardDragRotation = useBoardDrag((state) => state.rotationDeg);
	const draggingEndpointUid = useEndpointDrag((state) => state.uid);
	const draggingEndpointCm = useEndpointDrag((state) => state.worldCm);
	const readOnly = useReadOnly((state) => state.readOnly);
	if (hidden.size === 0) return null;
	const index = anchorIndexFor({ boards, items, customPedals, endpoints });
	const dimFocus =
		selectedItemUid ?? hoveredItemUid ?? selectedEndpointUid ?? null;
	const rendered = renderCables({
		cables: cables.filter((cable) => hidden.has(cable.uid)),
		index,
		boards,
		items,
		customPedals,
		scale,
		selectedCableUid,
		dimFocus,
		liftedUid,
		liftedWorldCm,
		liftedRotationDeg,
		boardDragUid,
		boardDragX,
		boardDragY,
		boardDragRotation,
		draggingEndpointUid,
		draggingEndpointCm,
	});
	return (
		<CableShapes
			rendered={rendered}
			theme={theme}
			scale={scale}
			readOnly={readOnly}
		/>
	);
}

function CableShapes({
	rendered,
	theme,
	scale,
	readOnly,
}: {
	rendered: RenderedCable[];
	theme: CanvasTheme;
	scale: number;
	readOnly: boolean;
}) {
	const safeScale = Math.max(scale, 0.0001);
	const coarsePointer = useCoarsePointer();
	const colors = (selected: boolean) => ({
		halo: selected ? theme.selection : theme.cableHalo,
		haloWidth: (selected ? CABLE.selectedHaloPx : CABLE.haloPx) / safeScale,
		line: selected ? theme.selection : theme.cable,
		lineWidth: (selected ? CABLE.selectedStrokePx : CABLE.strokePx) / safeScale,
	});
	return (
		<>
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
						hitStrokeWidth={
							(coarsePointer ? 40 : CABLE.hitStrokePx) / safeScale
						}
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
		</>
	);
}

/**
 * The transient drag-connect preview. It is the only component that subscribes
 * to the live pointer, so a move re-renders one dashed path.
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
	const sourceAnchor = source
		? index.items.get(`item:${source.itemUid}:${source.jackIndex}`)
		: undefined;
	const targetAnchor: AnchorPoint | null = (() => {
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
	if (!sourceAnchor || !targetAnchor) return null;
	let from = sourceAnchor;
	let to = targetAnchor;
	// If the user drags backwards (IN→OUT, amp→pedal), show the final signal
	// direction in the preview too.
	if (source && target) {
		const sourceEnd = {
			itemUid: source.itemUid,
			jack: String(source.jackIndex),
		};
		const targetEnd =
			target.kind === "item"
				? { itemUid: target.uid, jack: String(target.jackIndex) }
				: { endpointUid: target.uid };
		const direction = normalizeCableDirection(sourceEnd, targetEnd, {
			items,
			endpoints,
			customPedals,
		});
		if (!direction.valid) return null;
		if (sameCableEnd(direction.from, targetEnd)) {
			from = targetAnchor;
			to = sourceAnchor;
		}
	}
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
