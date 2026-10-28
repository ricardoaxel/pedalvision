import { useEffect } from "react";
import { useMeasure } from "../state/measure";

/** Ignore shortcuts while typing in a field or composing. */
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
 * `M` arms/disarms the measure tool; `Esc` exits the mode and clears the line.
 * Text fields, modified keys, composing and open dialogs are ignored.
 */
export function useMeasureShortcuts(): void {
	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.defaultPrevented) return;
			if (event.isComposing || isTypingTarget(event.target)) return;
			if (event.metaKey || event.ctrlKey || event.altKey) return;
			// A modal owns its keys; the measure mode is disarmed by App anyway.
			if (document.querySelector('[role="dialog"]')) return;
			if (event.key.toLowerCase() === "m") {
				event.preventDefault();
				useMeasure.getState().toggle();
				return;
			}
			if (event.key === "Escape" && useMeasure.getState().active) {
				event.preventDefault();
				useMeasure.getState().setActive(false);
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, []);
}
