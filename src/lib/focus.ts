/**
 * Move focus to whichever "Add board" trigger is actually laid out (desktop
 * toolbar or mobile tab bar). Used when the element that opened a dialog has
 * unmounted before focus could be restored to it — dropping focus to <body>
 * would restart keyboard/AT navigation at the top of the page.
 */
export function focusAddBoardTrigger(): void {
	const candidates = [
		document.getElementById("toolbar-add-board"),
		document.getElementById("tab-bar-boards"),
	];
	const target = candidates.find(
		(element) => element != null && element.getClientRects().length > 0,
	);
	target?.focus({ preventScroll: true });
}
