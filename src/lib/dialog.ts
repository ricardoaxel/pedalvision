/**
 * Is an interactive dialog currently owning the keyboard? Panels kept mounted
 * for their F-05 exit motion are marked `inert`; they are visually present but
 * must not block shortcuts (undo, focus, measure) during the ~120 ms close.
 */
export function hasActiveDialog(selector = '[role="dialog"]'): boolean {
	if (typeof document === "undefined") return false;
	return [...document.querySelectorAll<HTMLElement>(selector)].some(
		(element) => element.closest("[inert]") === null,
	);
}
