import { Layer, Shape } from "react-konva";

/** Dot pitch in screen px — mirrors `--grid-dot-size` (tokens.css). */
export const GRID_PITCH = 24;
/** Dot radius in screen px — mirrors `--grid-dot-radius` (tokens.css). */
export const GRID_DOT_RADIUS = 1;

interface GridLayerProps {
	color: string;
	width: number;
	height: number;
	scale: number;
	x: number;
	y: number;
}

/**
 * The dot grid (design.md §Canvas architecture → first layer).
 *
 * Rendered imperatively — one `Shape`, one `fill()` — in **screen space**:
 * dots keep a constant screen pitch (they never scale with zoom) and slide
 * with pan, so the pattern stays anchored to the world origin. To draw in
 * screen coordinates while the stage carries the pan/zoom transform, the layer
 * counter-transforms it (`scale 1/scale`, offset `-x/scale`), making the
 * layer's coordinate system equal screen px. Dots are recomputed every render
 * from the transform — there is no Konva node per dot.
 */
export function GridLayer({
	color,
	width,
	height,
	scale,
	x,
	y,
}: GridLayerProps) {
	// Anchor the pattern to the world origin (screen `x`/`y`), wrapped to one pitch.
	const phaseX = ((x % GRID_PITCH) + GRID_PITCH) % GRID_PITCH;
	const phaseY = ((y % GRID_PITCH) + GRID_PITCH) % GRID_PITCH;

	return (
		<Layer
			listening={false}
			x={-x / scale}
			y={-y / scale}
			scaleX={1 / scale}
			scaleY={1 / scale}
		>
			<Shape
				listening={false}
				perfectDrawEnabled={false}
				sceneFunc={(context) => {
					context.beginPath();
					for (let dotX = phaseX; dotX <= width; dotX += GRID_PITCH) {
						for (let dotY = phaseY; dotY <= height; dotY += GRID_PITCH) {
							context.moveTo(dotX + GRID_DOT_RADIUS, dotY);
							context.arc(dotX, dotY, GRID_DOT_RADIUS, 0, Math.PI * 2, false);
						}
					}
					context.fillStyle = color;
					context.fill();
				}}
			/>
		</Layer>
	);
}
