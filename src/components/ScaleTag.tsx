import type { CSSProperties } from "react";
import { chooseScaleBar } from "../lib/measurementHud";
import { useIsMobile } from "../lib/useMobile";
import { useSettings } from "../state/settings";
import { useViewport } from "../state/viewport";

/** Compact mobile bar budget. */
const MOBILE_BAR_MAX_PX = 40;

/**
 * The tiny bottom-right scale annotation (F-03 "Pencil Margin"):
 * `[bar] 10 cm` on mobile. No unit pair, no zoom percentage, no grid line, no
 * rules, no fill or card. Units change in the info panel; read-only.
 *
 * On mobile the same one-line annotation sits above the dock and hides while
 * the info peek/action bar/trays are up.
 */
export function ScaleTag() {
	const isMobile = useIsMobile();
	if (!isMobile) return null;
	return <MobileScaleTag />;
}

function MobileScaleTag() {
	const scale = useViewport((state) => state.scale);
	const units = useSettings((state) => state.units);
	const bar = chooseScaleBar(scale, units, MOBILE_BAR_MAX_PX);
	const barStyle = { width: `${bar.barPx}px` } as CSSProperties;

	return (
		// biome-ignore lint/a11y/useSemanticElements: a measurement group is not a form
		<div
			className="scale-tag"
			data-testid="scale-tag"
			data-mobile="true"
			role="group"
			aria-label="Scale"
			data-units={units}
			data-length-label={bar.lengthLabel}
			data-length-cm={bar.lengthCm}
			data-bar-px={bar.barPx}
		>
			<span className="scale-tag__bar" aria-hidden="true" style={barStyle} />
			<span className="scale-tag__length">{bar.lengthLabel}</span>
			<span className="scale-tag__unit">{units}</span>
		</div>
	);
}
