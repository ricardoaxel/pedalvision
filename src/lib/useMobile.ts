import { useEffect, useState } from "react";

/** The app-wide desktop/mobile boundary (matches the CSS media queries). */
export const MOBILE_MEDIA = "(max-width: 1023px)";

/**
 * One shared viewport hook for components that branch at the 1023 px boundary.
 * The breakpoint literal previously lived in InfoPanel, ScaleTag and the
 * action-bar layout; this keeps new chrome on the same rule.
 */
export function useIsMobile(): boolean {
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
