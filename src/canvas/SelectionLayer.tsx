import { Group, Layer, Line } from "react-konva";
import { cmToPx } from "../lib/geometry";
import { useDrag } from "../state/drag";
import {
	itemFootprint,
	itemVisualRotationDeg,
	itemWorldOrigin,
	type PlacedBoard,
	type PlacedItem,
	useScene,
} from "../state/scene";
import { selectSelectedItemUid, useSelection } from "../state/selection";
import { useViewport } from "../state/viewport";
import type { CanvasTheme } from "../styles/theme";
import { ItemTransformer } from "./ItemTransformer";

/** Hover brackets in **screen** px (counter-scaled for zoom). */
const HOVER_ARM = 11;
const HOVER_GAP = 5;
/** Under-stroke / over-stroke weights (screen px) — the two-tone construction. */
const HOVER_UNDER = 4.5;
const HOVER_STROKE = 2;

/**
 * The desktop hover outline (design.md §Canvas architecture → SelectionLayer).
 *
 * It lives in **world coordinates**, unlike the selected item's halo (which is
 * a sibling inside the item's own container and inherits the board transform).
 * An attached item stores board-relative cm, so its world origin is recomputed
 * via `itemWorldOrigin` (N3) and the rotation is the board + item composition —
 * the outline never assumes it inherited the board transform.
 */
export function SelectionLayer({ theme }: { theme: CanvasTheme }) {
	const hoveredItemUid = useSelection((state) => state.hoveredItemUid);
	const selectedItemUid = useSelection(selectSelectedItemUid);
	const items = useScene((state) => state.items);
	const boards = useScene((state) => state.boards);
	const liftedUid = useDrag((state) => state.liftedUid);
	const scale = useViewport((state) => state.scale);

	// The selected item already shows its halo; hide the hover ring for it.
	const item =
		hoveredItemUid && hoveredItemUid !== selectedItemUid
			? items.find((candidate) => candidate.uid === hoveredItemUid)
			: undefined;
	// The Transformer stays mounted (so a rotation interrupted by a selection
	// change still commits); it just detaches while the item is lifted mid-drag
	// (the drag owns the position).
	const attachUid =
		selectedItemUid !== null && selectedItemUid !== liftedUid
			? selectedItemUid
			: null;

	// One layer (Konva warns above 5): the hover Rect is non-listening, the
	// Transformer listens for the rotate drag.
	return (
		<Layer>
			<HoverOutline item={item} boards={boards} theme={theme} scale={scale} />
			<ItemTransformer selectedUid={attachUid} theme={theme} />
		</Layer>
	);
}

function HoverOutline({
	item,
	boards,
	theme,
	scale,
}: {
	item: PlacedItem | undefined;
	boards: PlacedBoard[];
	theme: CanvasTheme;
	scale: number;
}) {
	if (!item) return null;
	const origin = itemWorldOrigin(item, boards);
	const rotation = itemVisualRotationDeg(item, boards);
	const footprint = itemFootprint(item);
	return (
		<Group
			x={cmToPx(origin.x)}
			y={cmToPx(origin.y)}
			rotation={rotation}
			listening={false}
		>
			<Brackets
				widthPx={cmToPx(footprint.widthCm)}
				heightPx={cmToPx(footprint.heightCm)}
				scale={scale}
				color={theme.hoverOutline}
				underColor={theme.canvasBackground}
			/>
		</Group>
	);
}

/**
 * Four L-shaped corner brackets — the hover affordance (P2-01 "Specimen
 * Bench"). They sit just **outside** the footprint (outside reads as
 * "targeting"; an inset ring read as odd padding) and are drawn two-tone (a
 * canvas-background under-stroke beneath the ink stroke) so the bracket stays
 * visible over any product photo. Neutral ink, so hover never competes with the
 * cyan selection halo; arms/thickness are counter-scaled to stay constant on
 * screen at any zoom.
 */
function Brackets({
	widthPx,
	heightPx,
	scale,
	color,
	underColor,
}: {
	widthPx: number;
	heightPx: number;
	scale: number;
	color: string;
	underColor: string;
}) {
	const gap = HOVER_GAP / scale;
	const arm = HOVER_ARM / scale;
	// Clamp on very small footprints so the two brackets can't collide.
	const screenMin = Math.min(widthPx, heightPx) * scale;
	const armClamped = Math.min(arm, (screenMin * 0.34) / scale);
	const gapClamped = Math.min(gap, (screenMin * 0.12) / scale);
	const left = -gapClamped;
	const top = -gapClamped;
	const right = widthPx + gapClamped;
	const bottom = heightPx + gapClamped;
	const paths = [
		[left, top + armClamped, left, top, left + armClamped, top],
		[right - armClamped, top, right, top, right, top + armClamped],
		[right, bottom - armClamped, right, bottom, right - armClamped, bottom],
		[left + armClamped, bottom, left, bottom, left, bottom - armClamped],
	];
	return (
		<>
			{paths.map((points, index) => (
				<Line
					// biome-ignore lint/suspicious/noArrayIndexKey: fixed 4-bracket geometry
					key={`under-${index}`}
					points={points}
					stroke={underColor}
					strokeWidth={HOVER_UNDER / scale}
					lineCap="round"
					lineJoin="round"
					listening={false}
					perfectDrawEnabled={false}
				/>
			))}
			{paths.map((points, index) => (
				<Line
					// biome-ignore lint/suspicious/noArrayIndexKey: fixed 4-bracket geometry
					key={`over-${index}`}
					points={points}
					stroke={color}
					strokeWidth={HOVER_STROKE / scale}
					lineCap="round"
					lineJoin="round"
					listening={false}
					perfectDrawEnabled={false}
				/>
			))}
		</>
	);
}
