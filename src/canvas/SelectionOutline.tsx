import { Rect } from "react-konva";
import { cmToPx } from "../lib/geometry";
import type { CanvasTheme } from "../styles/theme";

interface SelectionOutlineProps {
	xCm: number;
	yCm: number;
	widthCm: number;
	heightCm: number;
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
	theme,
}: SelectionOutlineProps) {
	return (
		<Rect
			x={cmToPx(xCm) - INSET}
			y={cmToPx(yCm) - INSET}
			width={cmToPx(widthCm) + INSET * 2}
			height={cmToPx(heightCm) + INSET * 2}
			stroke={theme.canvasBackground}
			strokeWidth={STROKE}
			cornerRadius={3}
			listening={false}
			perfectDrawEnabled={false}
		/>
	);
}
