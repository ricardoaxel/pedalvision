import { useIsMobile } from "../lib/useMobile";
import { usePanelMetrics } from "../state/panel";

/**
 * F-41: one persistent, low-chrome way into the docs/legal hub. It sits above
 * the Margin Rule (outside the strip) so it never covers the readout, scale bar
 * or the board-view dock. Mobile uses the measured strip height; the first-run
 * note keeps the same corner, so CSS hides the chip while that note is present.
 */
export function HelpChip() {
	const isMobile = useIsMobile();
	const stripHeight = usePanelMetrics((state) => state.scaleStripHeight);
	const style = isMobile
		? {
				bottom: `calc(56px + env(safe-area-inset-bottom) + var(--space-4) + ${stripHeight}px + 12px)`,
			}
		: undefined;

	return (
		<a
			className="help-chip"
			href="/docs"
			aria-label="Help — documentation and legal"
			title="Docs & help"
			style={style}
		>
			?
		</a>
	);
}
