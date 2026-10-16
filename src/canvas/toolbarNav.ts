/**
 * Roving-tabindex math for the item action bar (ARIA toolbar pattern). Pure so
 * the skip-disabled wrap-around is unit-testable (P1-06).
 */

/** The arrow/nav keys the toolbar understands. */
export type ToolbarNavKey =
	| "ArrowRight"
	| "ArrowDown"
	| "ArrowLeft"
	| "ArrowUp"
	| "Home"
	| "End";

/**
 * The next button index to focus given the enabled button indices (ascending),
 * the currently active one, and the pressed key. Moves ±1 with wrap-around and
 * skips disabled buttons (which are absent from `enabled`); `Home`/`End` jump to
 * the first/last enabled. Returns null for unknown keys or an empty set.
 */
export function nextEnabledIndex(
	enabled: number[],
	active: number,
	key: string,
): number | null {
	const position = enabled.indexOf(active);
	if (position === -1 || enabled.length === 0) return null;
	switch (key as ToolbarNavKey) {
		case "ArrowRight":
		case "ArrowDown":
			return enabled[(position + 1) % enabled.length];
		case "ArrowLeft":
		case "ArrowUp":
			return enabled[(position - 1 + enabled.length) % enabled.length];
		case "Home":
			return enabled[0];
		case "End":
			return enabled[enabled.length - 1];
		default:
			return null;
	}
}
