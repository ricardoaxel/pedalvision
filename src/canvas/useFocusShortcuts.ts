import { useEffect } from "react";
import { focusViewport } from "../state/focus";

/** Ignore shortcuts while typing in a field or composing (same guard as M). */
function isTypingTarget(target: EventTarget | null): boolean {
	const element = target as HTMLElement | null;
	if (!element) return false;
	return (
		element.tagName === "INPUT" ||
		element.tagName === "TEXTAREA" ||
		element.tagName === "SELECT" ||
		element.isContentEditable
	);
}

/**
 * `F` frames the selected board, or the used area when no board is selected
 * (F-04). Text fields, modified keys, composing and open dialogs are ignored;
 * a hidden Shift+F is deliberately not supported (the control states its
 * target, so there is no second mode to memorise).
 */
export function useFocusShortcuts(): void {
	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.defaultPrevented) return;
			if (event.isComposing || isTypingTarget(event.target)) return;
			if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
				return;
			}
			if (document.querySelector('[role="dialog"]')) return;
			if (event.key.toLowerCase() !== "f") return;
			event.preventDefault();
			focusViewport({ target: "auto", announce: true });
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, []);
}
