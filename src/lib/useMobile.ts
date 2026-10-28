import { useEffect, useState } from "react";

/** The app-wide desktop/mobile boundary (matches the CSS media queries). */
export const MOBILE_MEDIA = "(max-width: 1023px)";

/**
 * One shared viewport hook for the new desktop/mobile chrome. InfoPanel and
 * `actionBarLayout` keep their own pre-existing 1023 px literals; new
 * components should import this instead of adding another copy.
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
