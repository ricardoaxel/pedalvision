import type { CSSProperties } from "react";
import { chooseScaleBar, zoomPercent } from "../lib/measurementHud";
import { formatDimensions } from "../lib/partInfo";
import { usePanelMetrics } from "../state/panel";
import { itemFootprint, useScene } from "../state/scene";
import { selectSelectedItemUid, useSelection } from "../state/selection";
import { useSettings } from "../state/settings";
import { useViewport } from "../state/viewport";

/**
 * The measurement HUD (F-03, direction: **"Scale Rule"**, owner-approved
 * 2026-10-27). A quiet drafting instrument pinned to the canvas's bottom-left:
 * a true-length scale rule with the live zoom, plus the selected part's real
 * W × H. It extends the "Blueprint" language — one opaque chip surface, mono
 * instrumentation, no accent.
 *
 * Derived and view-only: cm stays the source of truth, `Settings.units` drives
 * the labels, and nothing is persisted or exported. It is intentionally
 * non-interactive and silent to screen readers on every zoom tick (no
 * `role="status"`); the info panel remains the detailed readout.
 */
export function MeasurementHud() {
	const scale = useViewport((state) => state.scale);
	const units = useSettings((state) => state.units);
	const selectedItemUid = useSelection(selectSelectedItemUid);
	const items = useScene((state) => state.items);
	const customPedals = useScene((state) => state.customPedals);
	// The collapsed mobile info peek reports its rendered height; the HUD rides
	// just above it instead of being buried (the desktop rail never overlaps).
	const sheetHeight = usePanelMetrics((state) => state.sheetHeight);

	const item = selectedItemUid
		? items.find((candidate) => candidate.uid === selectedItemUid)
		: undefined;
	const footprint = item ? itemFootprint(item, customPedals) : null;
	const hasSize =
		footprint !== null &&
		Number.isFinite(footprint.widthCm) &&
		Number.isFinite(footprint.heightCm);
	const dimensions = hasSize
		? formatDimensions(footprint.widthCm, footprint.heightCm, units)
		: null;

	const zoom = zoomPercent(scale);
	const bar = chooseScaleBar(scale, units);
	const style = { "--hud-peek-lift": `${sheetHeight}px` } as CSSProperties;

	return (
		<fieldset
			className="measurement-hud"
			data-testid="measurement-hud"
			aria-label="Measurement"
			data-zoom={zoom}
			data-unit={units}
			data-bar-cm={bar.lengthCm}
			data-bar-px={bar.barPx}
			style={style}
		>
			<div className="measurement-hud__scale">
				<span
					className="measurement-hud__bar"
					aria-hidden="true"
					style={{ width: `${bar.barPx}px` }}
				/>
				<span className="measurement-hud__length" aria-hidden="true">
					{bar.lengthLabel} {bar.units}
				</span>
				<span className="measurement-hud__zoom">
					<span className="visually-hidden">Zoom </span>
					{zoom}%
				</span>
			</div>
			{dimensions ? (
				<div className="measurement-hud__size" data-testid="measurement-size">
					<span className="visually-hidden">Selected size </span>
					{dimensions}
				</div>
			) : null}
		</fieldset>
	);
}
