import type { CSSProperties } from "react";
import { cmToDisplay } from "../lib/geometry";
import { gridCellCm } from "../lib/grid";
import { chooseScaleBar, zoomPercent } from "../lib/measurementHud";
import { useIsMobile } from "../lib/useMobile";
import { selectSelectedItemUid, useSelection } from "../state/selection";
import { useSettings } from "../state/settings";
import { useViewport } from "../state/viewport";

/** Compact mobile bar budget; the desktop title block can afford more. */
const MOBILE_BAR_MAX_PX = 64;

/**
 * The flat bottom-right Scale Tag (F-03 "Sheet Margin"). On desktop it is a
 * title block flush inside the 24 px bottom margin: true-length bar → length →
 * quiet cm/in toggle → zoom → grid cell. No fill, radius or shadow; only the
 * unit toggle is interactive.
 *
 * On mobile it collapses to a tiny bottom-right readout above the dock (bar +
 * length + unit + zoom), with no card and no rulers.
 */
export function ScaleTag() {
	const scale = useViewport((state) => state.scale);
	const units = useSettings((state) => state.units);
	const setUnits = useSettings((state) => state.setUnits);
	const isMobile = useIsMobile();
	const selectedItemUid = useSelection(selectSelectedItemUid);
	// The info panel already carries the cm/in control; keep a static unit in the
	// block there instead of showing two identical toggles.
	const showStaticUnit = !isMobile && selectedItemUid !== null;

	const bar = chooseScaleBar(
		scale,
		units,
		isMobile ? MOBILE_BAR_MAX_PX : undefined,
	);
	const zoom = zoomPercent(scale);
	const cellLabel = String(cmToDisplay(gridCellCm(scale), units));
	const barStyle = { width: `${bar.barPx}px` } as CSSProperties;

	return (
		// biome-ignore lint/a11y/useSemanticElements: a measurement group is not a form
		<div
			className="scale-tag"
			data-testid="scale-tag"
			data-mobile={isMobile ? "true" : "false"}
			role="group"
			aria-label="Scale"
			data-scale={scale}
			data-zoom={zoom}
			data-units={units}
			data-length-label={bar.lengthLabel}
			data-length-cm={bar.lengthCm}
			data-bar-px={bar.barPx}
			data-grid-cm={gridCellCm(scale)}
		>
			<span className="scale-tag__bar" aria-hidden="true" style={barStyle} />
			<span className="scale-tag__length">{bar.lengthLabel}</span>
			{showStaticUnit ? (
				<span className="scale-tag__unit-label">{units}</span>
			) : (
				<span className="scale-tag__units">
					{(["cm", "in"] as const).map((unit, index) => (
						<span key={unit} className="scale-tag__unit-slot">
							{index > 0 ? (
								<span className="scale-tag__unit-sep" aria-hidden="true">
									·
								</span>
							) : null}
							<button
								type="button"
								className="scale-tag__unit"
								data-testid={`scale-tag-unit-${unit}`}
								aria-pressed={units === unit}
								aria-label={`${unit === "cm" ? "Centimetres" : "Inches"}${units === unit ? ", selected" : ""}`}
								onClick={() => setUnits(unit)}
							>
								{unit}
							</button>
						</span>
					))}
				</span>
			)}
			<span className="scale-tag__zoom">
				<span className="visually-hidden">Zoom </span>
				{zoom}%
			</span>
			{isMobile ? null : (
				<span className="scale-tag__grid" data-testid="scale-tag-grid">
					grid {cellLabel} {units}
				</span>
			)}
		</div>
	);
}
