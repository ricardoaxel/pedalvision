import type { CSSProperties } from "react";
import { cmToDisplay, PX_PER_CM } from "../lib/geometry";
import { gridCellCm } from "../lib/grid";
import { useIsMobile } from "../lib/useMobile";
import { usePanelMetrics } from "../state/panel";
import { useSettings } from "../state/settings";
import { useViewport } from "../state/viewport";

/**
 * The viewport + grid readout (F-03): how much real-world canvas is visible and
 * how large one dot cell is. Explicit — no bar length to mistake for the dot
 * pitch. Units are a segmented cm|in control; the measure tool handles local
 * distances.
 *
 * Desktop bottom-left in the caption strip; mobile bottom-right above the info
 * peek. Always visible (including an empty sheet); never persisted/exported.
 */
export function ScaleReadout() {
	const scale = useViewport((state) => state.scale);
	const size = useViewport((state) => state.size);
	const units = useSettings((state) => state.units);
	const setUnits = useSettings((state) => state.setUnits);
	const isMobile = useIsMobile();
	const sheetHeight = usePanelMetrics((state) => state.sheetHeight);

	if (size.width <= 0 || size.height <= 0) return null;

	const viewWidthCm = size.width / (PX_PER_CM * scale);
	const visibleHeightPx = isMobile
		? Math.max(0, size.height - 56 - sheetHeight)
		: size.height;
	const viewHeightCm = visibleHeightPx / (PX_PER_CM * scale);
	const gridCm = gridCellCm(scale);
	const gridDisplay =
		units === "in" ? Math.round(gridCm / 2.54) : Math.round(gridCm);
	const liftStyle = {
		"--scale-peek-lift": `${sheetHeight}px`,
	} as CSSProperties;

	return (
		// biome-ignore lint/a11y/useSemanticElements: a measurement group is not a form
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
			style={liftStyle}
		>
			<span className="scale-readout__view">
				view {Math.round(cmToDisplay(viewWidthCm, units))} ×{" "}
				{Math.round(cmToDisplay(viewHeightCm, units))} {units}
			</span>
			<span className="scale-readout__sep" aria-hidden="true">
				·
			</span>
			<span className="scale-readout__dots">
				grid {gridDisplay} {units}
			</span>
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
	);
}
