import { Rect } from "react-konva";
import { cmToPx } from "../lib/geometry";
import type { CanvasTheme } from "../styles/theme";

interface SelectionOutlineProps {
	xCm: number;
	yCm: number;
	widthCm: number;
	heightCm: number;
	/** The item's own rotation (degrees); the board transform is inherited by
	 * the enclosing group. */
	rotationDeg?: number;
	theme: CanvasTheme;
}

/** Inset/outset and stroke of the halo ring, in render px (cm-derived). */
const INSET = 2;
const STROKE = 3;

/**
 * A two-tone selection halo: a canvas-coloured ring drawn just outside the
 * selected item, behind the Transformer's accent border. Photographic pedal art
 * has arbitrary luminance, so a lone accent border can drop below the 3:1
 * non-text contrast minimum; the halo inserts the canvas colour as a luminance
 * step so the accent always reads (designer review, P1-04).
 */
export function SelectionOutline({
	xCm,
	yCm,
	widthCm,
	heightCm,
	rotationDeg = 0,
	theme,
}: SelectionOutlineProps) {
	return (
		<Rect
			// The Transformer finds this node by name and mirrors the item node's
			// live transform onto it during a rotate gesture (Q-01), so the halo
			// follows the pedal without joining the item group (which would grow
			// the Transformer's bounding box by the ring outset).
			name="selection-halo"
			x={cmToPx(xCm)}
			y={cmToPx(yCm)}
			// Offset so the ring still sits just outside the footprint, while
			// rotation pivots about the item origin (not the inset corner).
			offsetX={INSET}
			offsetY={INSET}
			width={cmToPx(widthCm) + INSET * 2}
			height={cmToPx(heightCm) + INSET * 2}
			rotation={rotationDeg}
			stroke={theme.canvasBackground}
			strokeWidth={STROKE}
			cornerRadius={3}
			listening={false}
			perfectDrawEnabled={false}
		/>
	);
}
