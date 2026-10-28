import type { CSSProperties } from "react";
import { chooseScaleBar } from "../lib/measurementHud";
import { useIsMobile } from "../lib/useMobile";
import { usePanelMetrics } from "../state/panel";
import { useScene } from "../state/scene";
import { useSettings } from "../state/settings";
import { useViewport } from "../state/viewport";

/** Compact mobile bar budget. */
const MOBILE_BAR_MAX_PX = 40;

/**
 * The single “Drafting Scale” bar (F-03): the same true-length artifact as the
 * PNG/PDF export — one line, two end caps, one label — in a caption strip.
 *
 * Desktop sits bottom-left in the 22 px margin; mobile sits bottom-right above
 * the dock. No axis, ticks, world labels, grid line, zoom % or unit control.
 * Units live in the info panel; the bar follows them.
 */
export function ScaleBar() {
	const scale = useViewport((state) => state.scale);
	const units = useSettings((state) => state.units);
	const isMobile = useIsMobile();
	const content = useScene((state) => state.boards.length + state.items.length);
	const sheetHeight = usePanelMetrics((state) => state.sheetHeight);
	const bar = chooseScaleBar(
		scale,
		units,
		isMobile ? MOBILE_BAR_MAX_PX : undefined,
	);
	const barStyle = { width: `${bar.barPx}px` } as CSSProperties;
	const liftStyle = {
		"--scale-peek-lift": `${sheetHeight}px`,
	} as CSSProperties;

	// An empty sheet has nothing to measure; don't add a first-run ornament.
	if (content === 0) return null;

	return (
		// biome-ignore lint/a11y/useSemanticElements: a measurement group is not a form
		<div
			className="scale-bar"
			data-testid="scale-bar"
			data-mobile={isMobile ? "true" : "false"}
			role="group"
			aria-label="Scale"
			data-units={units}
			data-length-label={bar.lengthLabel}
			data-length-cm={bar.lengthCm}
			data-bar-px={bar.barPx}
			style={liftStyle}
		>
			<span className="scale-bar__track" aria-hidden="true" style={barStyle} />
			<span className="scale-bar__label">
				= {bar.lengthLabel} {bar.units}
			</span>
		</div>
	);
}
