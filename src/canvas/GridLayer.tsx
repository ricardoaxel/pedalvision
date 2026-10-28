import { Layer, Shape } from "react-konva";
import { type GridStepCm, gridLevels } from "../lib/grid";
import { GRID_DOT_RADIUS } from "../styles/theme";

interface GridDotsProps {
	step: number;
	opacity: number;
	color: string;
	width: number;
	height: number;
	x: number;
	y: number;
}

/** One dot field at a given screen-space pitch, world-anchored to `x`/`y`. */
function GridDots({
	step,
	opacity,
	color,
	width,
	height,
	x,
	y,
}: GridDotsProps) {
	const phaseX = ((x % step) + step) % step;
	const phaseY = ((y % step) + step) % step;

	return (
		<Shape
			listening={false}
			perfectDrawEnabled={false}
			opacity={opacity}
			sceneFunc={(context) => {
				context.beginPath();
				for (let dotX = phaseX; dotX <= width; dotX += step) {
					for (let dotY = phaseY; dotY <= height; dotY += step) {
						context.moveTo(dotX + GRID_DOT_RADIUS, dotY);
						context.arc(dotX, dotY, GRID_DOT_RADIUS, 0, Math.PI * 2, false);
					}
				}
				context.fillStyle = color;
				context.fill();
			}}
		/>
	);
}

interface GridLayerProps {
	color: string;
	width: number;
	height: number;
	scale: number;
	x: number;
	y: number;
	/** Fixed grid step in cm; the visible pitch coarsens to the 16 px floor. */
	stepCm: GridStepCm;
}

/**
 * The dot grid (design.md §Canvas architecture → first layer).
 *
 * A true-scale, world-anchored grid: the dot spacing is `GRID_PITCH × zoom`
 * screen px, so dots spread/tighten with zoom and stay aligned to the world
 * origin (screen `x`/`y`). When the spacing falls below the 16 px floor
 * (`lib/grid.ts`), the period doubles (level-of-detail) and the two adjacent
 * levels are **cross-faded** across the transition, so zooming through a
 * threshold ramps the finer level out instead of popping. Dot size stays
 * constant in screen px.
 *
 * Drawn imperatively — one `Shape`, one `fill()` per level, no node per dot. To
 * draw in screen coordinates while the stage carries the pan/zoom transform,
 * the layer counter-transforms it (`scale 1/scale`, offset `-x/scale`), making
 * the layer's coordinate system equal screen px. Dots are recomputed every
 * render from the transform.
 *
 * The level math lives in `lib/grid.ts` so the grid stays the single consumer
 * of its own LOD.
 */
export function GridLayer({
	color,
	width,
	height,
	scale,
	x,
	y,
	stepCm,
}: GridLayerProps) {
	// Continuous LOD from the shared pure helper (lib/grid.ts).
	const { fineStepPx: fineStep, frac } = gridLevels(scale, stepCm);

	return (
		<Layer
			listening={false}
			x={-x / scale}
			y={-y / scale}
			scaleX={1 / scale}
			scaleY={1 / scale}
		>
			<GridDots
				step={fineStep}
				opacity={1 - frac}
				color={color}
				width={width}
				height={height}
				x={x}
				y={y}
			/>
			{frac > 0.001 ? (
				<GridDots
					step={fineStep * 2}
					opacity={frac}
					color={color}
					width={width}
					height={height}
					x={x}
					y={y}
				/>
			) : null}
		</Layer>
	);
}
