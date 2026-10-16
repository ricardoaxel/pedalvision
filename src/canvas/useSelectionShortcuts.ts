import { useEffect } from "react";
import { useScene } from "../state/scene";
import { selectSelectedItemUid, useSelection } from "../state/selection";

/** True when the event target is a text field (never steal its keystrokes). */
function isTypingTarget(target: EventTarget | null): boolean {
	const element = target as HTMLElement | null;
	if (!element) return false;
	return (
		element.tagName === "INPUT" ||
		element.tagName === "TEXTAREA" ||
		element.isContentEditable
	);
}

/**
 * Keyboard shortcuts for the selected item (F6): Delete/Backspace deletes and
 * Cmd/Ctrl+D duplicates the selected pedal. Mounted once (App). Scoped to the
 * item selection so a selected board is never deleted by a stray keypress.
 */
export function useSelectionShortcuts(): void {
	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (isTypingTarget(event.target)) return;
			const selected = selectSelectedItemUid(useSelection.getState());
			if (!selected) return;
			if (event.key === "Delete" || event.key === "Backspace") {
				event.preventDefault();
				useScene.getState().removeItem(selected);
				useSelection.getState().clearSelection();
				return;
			}
			if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "d") {
				event.preventDefault();
				const uid = useScene.getState().duplicateItem(selected);
				if (uid) useSelection.getState().selectItem(uid);
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, []);
}
