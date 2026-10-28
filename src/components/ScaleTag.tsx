import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { cmToDisplay } from "../lib/geometry";
import { gridCellCm } from "../lib/grid";
import { chooseScaleBar, zoomPercent } from "../lib/measurementHud";
import { useSettings } from "../state/settings";
import { useViewport } from "../state/viewport";

// Mirrors the `max-width: 1023px` mobile block in index.css.
const MOBILE_MEDIA = "(max-width: 1023px)";

/** The compact mobile bar budget (the desktop tag can afford more). */
const MOBILE_BAR_MAX_PX = 44;

function useIsMobile(): boolean {
	const [isMobile, setIsMobile] = useState(
		() =>
			typeof window === "undefined" || window.matchMedia(MOBILE_MEDIA).matches,
	);
	useEffect(() => {
		const query = window.matchMedia(MOBILE_MEDIA);
		const update = () => setIsMobile(query.matches);
		update();
		query.addEventListener("change", update);
		return () => query.removeEventListener("change", update);
	}, []);
	return isMobile;
}

function formatGrid(value: number): string {
	return Number.isInteger(value) ? String(value) : String(value);
}

/**
 * The bottom-right Scale Tag (F-03 "Edge Rule") — a flush title-block
 * instrument, not a floating chip: true-length rule → round length → quiet
 * cm/in toggle → live zoom, with the current grid-cell size underneath.
 *
 * Derived only: `cm` stays canonical, the tag follows `Settings.units`, and it
 * never touches scene data, share or export. The unit toggle is a secondary
 * action (quiet text, enlarged hit area) so it never interrupts the instrument.
 */
export function ScaleTag() {
	const scale = useViewport((state) => state.scale);
	const units = useSettings((state) => state.units);
	const setUnits = useSettings((state) => state.setUnits);
	const isMobile = useIsMobile();

	const bar = chooseScaleBar(
		scale,
		units,
		isMobile ? MOBILE_BAR_MAX_PX : undefined,
	);
	const zoom = zoomPercent(scale);
	const cellCm = gridCellCm(scale);
	const cellLabel = formatGrid(cmToDisplay(cellCm, units));
	const otherUnit = units === "cm" ? "inches" : "centimetres";
	const barStyle = { width: `${bar.barPx}px` } as CSSProperties;

	return (
		// biome-ignore lint/a11y/useSemanticElements: a measurement group is not a form
		<div
			className="scale-tag"
			data-testid="scale-tag"
			role="group"
			aria-label="Scale"
			data-scale={scale}
			data-zoom={zoom}
			data-units={units}
			data-length-label={bar.lengthLabel}
			data-length-cm={bar.lengthCm}
			data-bar-px={bar.barPx}
			data-grid-cm={cellCm}
		>
			<div className="scale-tag__main">
				<span className="scale-tag__bar" aria-hidden="true" style={barStyle} />
				<span className="scale-tag__length">{bar.lengthLabel}</span>
				<button
					type="button"
					className="scale-tag__unit"
					data-testid="scale-tag-units"
					aria-label={`Unit ${units}. Switch to ${otherUnit}.`}
					title={`Switch to ${otherUnit}`}
					onClick={() => setUnits(units === "cm" ? "in" : "cm")}
				>
					{units}
				</button>
				<span className="scale-tag__zoom">
					<span className="visually-hidden">Zoom </span>
					{zoom}%
				</span>
			</div>
			<div className="scale-tag__grid" data-testid="scale-tag-grid">
				Grid {cellLabel} {units}
			</div>
		</div>
	);
}
