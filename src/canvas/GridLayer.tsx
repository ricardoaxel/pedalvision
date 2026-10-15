import { Layer, Shape } from "react-konva";
import { GRID_DOT_RADIUS, GRID_PITCH } from "../styles/theme";

/**
 * The dominant (coarser) grid level is always at or above this on-screen pitch;
 * mid-crossfade the fading finer level dips to half this before it disappears.
 */
const MIN_GRID_SCREEN_PITCH = 16;

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
}

/**
 * The dot grid (design.md §Canvas architecture → first layer).
 *
 * A true-scale, world-anchored grid: the dot spacing is `GRID_PITCH × zoom`
 * screen px, so dots spread/tighten with zoom and stay aligned to the world
 * origin (screen `x`/`y`). When the spacing falls below
 * {@link MIN_GRID_SCREEN_PITCH}, the period doubles (level-of-detail) and the
 * two adjacent levels are **cross-faded** across the transition, so zooming
 * through a threshold ramps the finer level out instead of popping. Dot size
 * stays constant in screen px.
 *
 * Drawn imperatively — one `Shape`, one `fill()` per level, no node per dot. To
 * draw in screen coordinates while the stage carries the pan/zoom transform,
 * the layer counter-transforms it (`scale 1/scale`, offset `-x/scale`), making
 * the layer's coordinate system equal screen px. Dots are recomputed every
 * render from the transform.
 *
 * (A round-metric cell — 24 px = 6 cm at PX_PER_CM 4 — and a finer sub-level
 * when zoomed in are deferred to the snapping/measure task P1-06+.)
 */
export function GridLayer({
	color,
	width,
	height,
	scale,
	x,
	y,
}: GridLayerProps) {
	// Continuous LOD: the number of doublings needed to reach MIN_GRID_SCREEN_PITCH.
	const raw = GRID_PITCH * scale;
	const k = Math.max(0, Math.log2(MIN_GRID_SCREEN_PITCH / raw));
	const level = Math.floor(k);
	const frac = k - level;
	const fineStep = raw * 2 ** level;

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
