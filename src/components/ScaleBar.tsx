import type { CSSProperties } from "react";
import { chooseScaleBar } from "../lib/measurementHud";
import { useIsMobile } from "../lib/useMobile";
import { useSettings } from "../state/settings";
import { useViewport } from "../state/viewport";

/** Compact mobile bar budget; desktop has room for a 20 cm rule at 1×. */
const MOBILE_BAR_MAX_PX = 40;
const DESKTOP_BAR_MAX_PX = 96;

/**
 * The centered true-length reference (F-03 "Margin Rule"): one rule, two caps,
 * a round value and the honest qualifier `layout scale`. The rule is centred on
 * the drawing area; the caption hangs off its right edge without moving it.
 *
 * No axis, ticks, plate, card or unit control; units live in the readout.
 */
export function ScaleBar() {
	const scale = useViewport((state) => state.scale);
	const units = useSettings((state) => state.units);
	const isMobile = useIsMobile();
	const bar = chooseScaleBar(
		scale,
		units,
		isMobile ? MOBILE_BAR_MAX_PX : DESKTOP_BAR_MAX_PX,
	);
	const ruleStyle = { width: `${bar.barPx}px` } as CSSProperties;
	const label = `${bar.lengthLabel} ${bar.units}`;

	return (
		// biome-ignore lint/a11y/useSemanticElements: a measurement group is not a form
		<div
			className="scale-bar"
			data-testid="scale-bar"
			data-mobile={isMobile ? "true" : "false"}
			role="group"
			aria-label={`Scale reference: ${label}, layout scale at the current zoom`}
			data-units={units}
			data-length-label={bar.lengthLabel}
			data-length-cm={bar.lengthCm}
			data-bar-px={bar.barPx}
		>
			<span className="scale-bar__rule" aria-hidden="true" style={ruleStyle} />
			<span className="scale-bar__caption">
				<span className="scale-bar__label">{label}</span>
				<span className="scale-bar__dot" aria-hidden="true">
					·
				</span>
				<span className="scale-bar__legend">layout scale</span>
			</span>
		</div>
	);
}
