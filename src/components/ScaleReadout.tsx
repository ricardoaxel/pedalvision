import type { CSSProperties } from "react";
import { cmToDisplay, PX_PER_CM } from "../lib/geometry";
import { gridCellCm } from "../lib/grid";
import { useIsMobile } from "../lib/useMobile";
import { usePanelMetrics } from "../state/panel";
import { useSettings } from "../state/settings";
import { useViewport } from "../state/viewport";
import { BoardViewDock } from "./BoardViewDock";
import { FrameControl } from "./FrameControl";
import { GridStepMenu } from "./GridStepMenu";
import { ScaleBar } from "./ScaleBar";

/**
 * The bottom "Margin Rule" (F-03): one drafting-sheet line with the visible
 * viewport + grid readout on the left and a centered true-length reference on
 * the drawing area. The grid value opens the fixed-step control; the selected
 * step is a ceiling and the readout always shows the pitch actually drawn.
 *
 * Desktop: readout left, rule centered, right empty. Mobile: two centered rows
 * (rule above readout) lifted above the info peek. Always visible, including
 * an empty sheet; never persisted/exported.
 */
export function ScaleReadout() {
	const scale = useViewport((state) => state.scale);
	const size = useViewport((state) => state.size);
	const units = useSettings((state) => state.units);
	const setUnits = useSettings((state) => state.setUnits);
	const gridStepCm = useSettings((state) => state.gridStepCm);
	const isMobile = useIsMobile();
	const sheetHeight = usePanelMetrics((state) => state.sheetHeight);

	if (size.width <= 0 || size.height <= 0) return null;

	const viewWidthCm = size.width / (PX_PER_CM * scale);
	const visibleHeightPx = isMobile
		? Math.max(0, size.height - 56 - sheetHeight)
		: size.height;
	const viewHeightCm = visibleHeightPx / (PX_PER_CM * scale);
	const gridCm = gridCellCm(scale, gridStepCm);
	const liftStyle = {
		"--scale-peek-lift": `${sheetHeight}px`,
	} as CSSProperties;

	return (
		<div
			className="scale-strip"
			data-mobile={isMobile ? "true" : "false"}
			style={liftStyle}
		>
			{/* biome-ignore lint/a11y/useSemanticElements: a measurement group is not a form */}
			<div
				className="scale-readout"
				data-testid="scale-readout"
				data-mobile={isMobile ? "true" : "false"}
				role="group"
				aria-label="Scale"
				data-units={units}
				data-view-width-cm={viewWidthCm}
				data-view-height-cm={viewHeightCm}
				data-grid-cm={gridCm}
				data-grid-step-cm={gridStepCm}
			>
				<span className="scale-readout__view">
					view {Math.round(cmToDisplay(viewWidthCm, units))} ×{" "}
					{Math.round(cmToDisplay(viewHeightCm, units))} {units}
				</span>
				<FrameControl />
				<span className="scale-readout__sep" aria-hidden="true">
					·
				</span>
				<GridStepMenu visibleCm={gridCm} units={units} />
				<span className="scale-readout__units">
					{(["cm", "in"] as const).map((unit, index) => (
						<span key={unit} className="scale-readout__unit-slot">
							{index > 0 ? (
								<span className="scale-readout__unit-sep" aria-hidden="true">
									·
								</span>
							) : null}
							<button
								type="button"
								className="scale-readout__unit"
								data-testid={`scale-readout-unit-${unit}`}
								aria-pressed={units === unit}
								aria-label={`${unit === "cm" ? "Centimetres" : "Inches"}${units === unit ? ", selected" : ""}`}
								onClick={() => setUnits(unit)}
							>
								{unit}
							</button>
						</span>
					))}
				</span>
			</div>
			<ScaleBar />
			<BoardViewDock />
		</div>
	);
}
