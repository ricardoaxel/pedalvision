import { buildRulerTicks } from "../lib/ruler";
import { useIsMobile } from "../lib/useMobile";
import { useSettings } from "../state/settings";
import { useViewport } from "../state/viewport";
import { RULER_GUTTER } from "../styles/theme";

const MAJOR_TICK_PX = 5;
const MINOR_TICK_PX = 3;
const ORIGIN_TICK_PX = 7;
const UNIT_FONT_PX = 11;

/**
 * The left + bottom sheet-margin rulers (F-03 "Sheet Margin"). They live in the
 * 24 px left / 24 px bottom gutters **outside** the stage: same canvas colour,
 * one hairline L, short ticks and sparse world-coordinate labels. No fill, no
 * card, no top ruler, no chrome shift.
 *
 * DOM/SVG only, decorative to assistive tech (the Scale Tag carries the
 * readable scale). Desktop-only: mobile removes the margins entirely and uses
 * the compact bottom-right readout.
 */
export function EdgeRules() {
	const isMobile = useIsMobile();
	// No off-screen SVG work on mobile; the margins do not exist there.
	if (isMobile) return null;
	return <DesktopEdgeRules />;
}

function DesktopEdgeRules() {
	const scale = useViewport((state) => state.scale);
	const x = useViewport((state) => state.x);
	const y = useViewport((state) => state.y);
	const size = useViewport((state) => state.size);
	const units = useSettings((state) => state.units);

	if (size.width <= 0 || size.height <= 0) return null;

	const width = size.width + RULER_GUTTER.x;
	const height = size.height + RULER_GUTTER.y;
	const ticks = buildRulerTicks(scale, units, {
		stageWidth: size.width,
		stageHeight: size.height,
		offsetX: x,
		offsetY: y,
	});
	const frameY = height - RULER_GUTTER.y;

	return (
		<div
			className="edge-rules"
			data-testid="edge-rules"
			aria-hidden="true"
			data-scale={scale}
			data-units={units}
			data-gutter-x={RULER_GUTTER.x}
			data-gutter-y={RULER_GUTTER.y}
			data-major-label={ticks.majorLabel}
			data-minor-label={ticks.minorLabel}
			data-major-cm={ticks.majorCm}
			data-minor-cm={ticks.minorCm}
			data-left-labels={ticks.leftLabels.join(",")}
			data-bottom-labels={ticks.bottomLabels.join(",")}
		>
			<svg
				className="edge-rules__svg"
				width={width}
				height={height}
				aria-hidden="true"
				focusable="false"
			>
				{/* The L: vertical at the stage's left edge, horizontal at its bottom. */}
				<line
					className="edge-rules__edge"
					x1={RULER_GUTTER.x - 0.5}
					y1={0}
					x2={RULER_GUTTER.x - 0.5}
					y2={frameY}
				/>
				<line
					className="edge-rules__edge"
					x1={0}
					y1={frameY - 0.5}
					x2={width}
					y2={frameY - 0.5}
				/>

				{ticks.left.map((tick, index) => {
					const kind = tick.origin ? "origin" : tick.major ? "major" : "minor";
					const length = tick.origin
						? ORIGIN_TICK_PX
						: tick.major
							? MAJOR_TICK_PX
							: MINOR_TICK_PX;
					return (
						<line
							// biome-ignore lint/suspicious/noArrayIndexKey: ruler ticks are read-only rows
							key={`left-${index}`}
							className={`edge-rules__tick edge-rules__tick--${kind}`}
							x1={RULER_GUTTER.x - length}
							y1={Math.round(tick.px) + 0.5}
							x2={RULER_GUTTER.x}
							y2={Math.round(tick.px) + 0.5}
						/>
					);
				})}

				{ticks.left
					.filter((tick) => tick.showLabel)
					.map((tick, index) => (
						<text
							// biome-ignore lint/suspicious/noArrayIndexKey: ruler labels are read-only rows
							key={`left-label-${index}`}
							className="edge-rules__label"
							data-axis="left"
							x={11}
							y={Math.round(tick.px)}
							textAnchor="middle"
							transform={`rotate(-90 11 ${Math.round(tick.px)})`}
						>
							{tick.label}
						</text>
					))}

				{ticks.bottom.map((tick, index) => {
					const kind = tick.origin ? "origin" : tick.major ? "major" : "minor";
					const length = tick.origin
						? ORIGIN_TICK_PX
						: tick.major
							? MAJOR_TICK_PX
							: MINOR_TICK_PX;
					return (
						<line
							// biome-ignore lint/suspicious/noArrayIndexKey: ruler ticks are read-only rows
							key={`bottom-${index}`}
							className={`edge-rules__tick edge-rules__tick--${kind}`}
							x1={Math.round(tick.px) + 0.5}
							y1={frameY}
							x2={Math.round(tick.px) + 0.5}
							y2={frameY + length}
						/>
					);
				})}

				{ticks.bottom
					.filter((tick) => tick.showLabel)
					.map((tick, index) => (
						<text
							// biome-ignore lint/suspicious/noArrayIndexKey: ruler labels are read-only rows
							key={`bottom-label-${index}`}
							className="edge-rules__label"
							data-axis="bottom"
							x={Math.round(tick.px)}
							y={height - 7}
							textAnchor="middle"
						>
							{tick.label}
						</text>
					))}

				<text
					className="edge-rules__unit"
					x={RULER_GUTTER.x / 2 + 2}
					y={height - 7}
					textAnchor="middle"
					style={{ fontSize: `${UNIT_FONT_PX}px` }}
				>
					{units}
				</text>
			</svg>
		</div>
	);
}
