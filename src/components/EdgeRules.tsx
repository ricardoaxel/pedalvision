import { buildRulerTicks } from "../lib/ruler";
import { useIsMobile } from "../lib/useMobile";
import { useSettings } from "../state/settings";
import { useViewport } from "../state/viewport";

/** Band thickness in px; mirrored by `--ruler-size` in tokens.css. */
const BAND = 22;

/**
 * The canvas-edge rulers (F-03 "Edge Rule"). Two true-scale coordinate rules
 * (top + left) with a shared cm/in corner block. They are pure screen chrome:
 * DOM/SVG, not Konva, never exported, and decorative to assistive tech (the
 * Scale Tag carries the readable scale; zoom must not spam a live region).
 *
 * Labels are world coordinates in the active display unit, so they pan with the
 * content and stay meaningful for off-origin boards, loose pedals and rotated
 * boards (the rules never rotate).
 */
export function EdgeRules() {
	const isMobile = useIsMobile();
	// The rules are CSS-hidden on mobile; return before mounting the viewport
	// subscribers so a pan/pinch never rebuilds tens of SVG nodes off-screen.
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

	const ticks = buildRulerTicks(scale, units, size, { x, y });
	const top = ticks.top;
	const left = ticks.left;

	return (
		<div
			className="edge-rules"
			data-testid="edge-rules"
			aria-hidden="true"
			data-scale={scale}
			data-units={units}
			data-major-label={ticks.majorLabel}
			data-minor-label={ticks.minorLabel}
			data-major-cm={ticks.majorCm}
			data-minor-cm={ticks.minorCm}
			data-top-labels={ticks.topLabels.join(",")}
			data-left-labels={ticks.leftLabels.join(",")}
		>
			<svg
				className="edge-rules__svg"
				width={size.width}
				height={size.height}
				aria-hidden="true"
				focusable="false"
			>
				<rect
					className="edge-rules__band"
					x={0}
					y={0}
					width={size.width}
					height={BAND}
				/>
				<rect
					className="edge-rules__band"
					x={0}
					y={BAND}
					width={BAND}
					height={Math.max(0, size.height - BAND)}
				/>
				<line
					className="edge-rules__edge"
					x1={0}
					y1={BAND - 0.5}
					x2={size.width}
					y2={BAND - 0.5}
				/>
				<line
					className="edge-rules__edge"
					x1={BAND - 0.5}
					y1={BAND}
					x2={BAND - 0.5}
					y2={size.height}
				/>

				{top.map((tick, index) => {
					const kind = tick.origin ? "origin" : tick.major ? "major" : "minor";
					const length = tick.origin ? 11 : tick.major ? 8 : 4;
					return (
						<line
							// biome-ignore lint/suspicious/noArrayIndexKey: ruler ticks are read-only rows
							key={`top-${index}`}
							className={`edge-rules__tick edge-rules__tick--${kind}`}
							x1={Math.round(tick.px) + 0.5}
							y1={BAND - length}
							x2={Math.round(tick.px) + 0.5}
							y2={BAND}
						/>
					);
				})}

				{top
					.filter((tick) => tick.showLabel)
					.map((tick, index) => (
						<text
							// biome-ignore lint/suspicious/noArrayIndexKey: ruler labels are read-only rows
							key={`top-label-${index}`}
							className="edge-rules__label"
							x={Math.round(tick.px)}
							y={BAND - 9}
							textAnchor="middle"
						>
							{tick.label}
						</text>
					))}

				{left.map((tick, index) => {
					const kind = tick.origin ? "origin" : tick.major ? "major" : "minor";
					const length = tick.origin ? 11 : tick.major ? 8 : 4;
					return (
						<line
							// biome-ignore lint/suspicious/noArrayIndexKey: ruler ticks are read-only rows
							key={`left-${index}`}
							className={`edge-rules__tick edge-rules__tick--${kind}`}
							x1={BAND - length}
							y1={Math.round(tick.px) + 0.5}
							x2={BAND}
							y2={Math.round(tick.px) + 0.5}
						/>
					);
				})}

				{left
					.filter((tick) => tick.showLabel)
					.map((tick, index) => (
						<text
							// biome-ignore lint/suspicious/noArrayIndexKey: ruler labels are read-only rows
							key={`left-label-${index}`}
							className="edge-rules__label"
							x={BAND - 10}
							y={Math.round(tick.px)}
							textAnchor="middle"
							transform={`rotate(-90 ${BAND - 10} ${Math.round(tick.px)})`}
						>
							{tick.label}
						</text>
					))}

				<rect
					className="edge-rules__corner"
					x={0}
					y={0}
					width={BAND}
					height={BAND}
				/>
				<text
					className="edge-rules__unit"
					x={BAND / 2}
					y={BAND / 2 + 3}
					textAnchor="middle"
				>
					{units}
				</text>
			</svg>
		</div>
	);
}
