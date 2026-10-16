import { Layer, Rect } from "react-konva";
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

/** Hover ring stroke + dash in **screen** px (counter-scaled for zoom). */
const HOVER_STROKE = 1.5;
const HOVER_DASH = [4, 3];

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
		<Rect
			x={cmToPx(origin.x)}
			y={cmToPx(origin.y)}
			width={cmToPx(footprint.widthCm)}
			height={cmToPx(footprint.heightCm)}
			rotation={rotation}
			stroke={theme.selection}
			// Counter-scale so the ring keeps a constant screen-px weight at any
			// zoom (the node lives under the stage transform).
			strokeWidth={HOVER_STROKE / scale}
			dash={HOVER_DASH.map((value) => value / scale)}
			listening={false}
			perfectDrawEnabled={false}
		/>
	);
}
