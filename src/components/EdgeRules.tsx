import { chooseScaleBar } from "../lib/measurementHud";
import { buildRulerTicks } from "../lib/ruler";
import { useIsMobile } from "../lib/useMobile";
import { useSettings } from "../state/settings";
import { useViewport } from "../state/viewport";
import { RULER_GUTTER } from "../styles/theme";

const MAJOR_TICK_PX = 4;
const ORIGIN_TICK_PX = 5;

/**
 * The pencil sheet edge (F-03 "Pencil Margin"): one faint bottom axis with
 * sparse world labels and a single unit at its end. No left hairline, no tick
 * ladder, no card, no desktop scale bar. A visually-hidden line carries the
 * readable scale for assistive tech; the SVG itself is decorative.
 */
export function EdgeRules() {
	const isMobile = useIsMobile();
	if (isMobile) return null;
	return <DesktopEdgeRules />;
}

function DesktopEdgeRules() {
	const scale = useViewport((state) => state.scale);
	const x = useViewport((state) => state.x);
	const size = useViewport((state) => state.size);
	const units = useSettings((state) => state.units);

	if (size.width <= 0 || size.height <= 0) return null;

	const width = size.width + RULER_GUTTER.x;
	const height = size.height + RULER_GUTTER.y;
	const ticks = buildRulerTicks(scale, units, {
		stageWidth: size.width,
		offsetX: x,
	});
	const bar = chooseScaleBar(scale, units);
	const originX =
		ticks.bottom.find((tick) => tick.origin)?.px ?? RULER_GUTTER.x;
	const frameY = height - RULER_GUTTER.y;

	return (
		<>
			<span className="visually-hidden" data-testid="scale-a11y">
				Scale: {bar.lengthLabel} {units}
			</span>
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
				data-bottom-labels={ticks.bottomLabels.join(",")}
				data-origin-x={originX}
			>
				<svg
					className="edge-rules__svg"
					width={width}
					height={height}
					aria-hidden="true"
					focusable="false"
				>
					{/* A single bottom axis, full width, with the unit at its end. */}
					<line
						className="edge-rules__edge"
						x1={0}
						y1={frameY - 0.5}
						x2={width}
						y2={frameY - 0.5}
					/>

					{ticks.bottom
						.filter((tick) => tick.major || tick.origin)
						.map((tick, index) => {
							const kind = tick.origin ? "origin" : "major";
							const length = tick.origin ? ORIGIN_TICK_PX : MAJOR_TICK_PX;
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
								x={
									tick.origin
										? Math.max(2, Math.round(tick.px))
										: Math.round(tick.px)
								}
								y={height - 4}
								textAnchor={tick.origin ? "start" : "middle"}
							>
								{tick.origin ? "0" : tick.label}
							</text>
						))}

					<text
						className="edge-rules__unit"
						data-testid="edge-rules-unit"
						x={width - 8}
						y={height - 4}
						textAnchor="end"
					>
						{units}
					</text>
				</svg>
			</div>
		</>
	);
}
