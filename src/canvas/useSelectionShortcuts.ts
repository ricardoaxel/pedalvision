import { useEffect } from "react";
import { isReadOnly, useReadOnly } from "../state/readOnly";
import { useScene } from "../state/scene";
import {
	selectSelectedCableUid,
	selectSelectedEndpointUid,
	selectSelectedItemUid,
	useSelection,
} from "../state/selection";

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
			if (isReadOnly()) {
				// Read-only: explain the blocked keyboard edit instead of failing
				// silently (the pointer path shows the same cue).
				if (
					selected &&
					(event.key === "Delete" ||
						event.key === "Backspace" ||
						((event.metaKey || event.ctrlKey) &&
							event.key.toLowerCase() === "d"))
				) {
					event.preventDefault();
					useReadOnly.getState().showCueFor(selected, "item");
				}
				return;
			}
			const selection = useSelection.getState();
			const selectedEndpoint = selectSelectedEndpointUid(selection);
			const selectedCable = selectSelectedCableUid(selection);
			const deletable = selected ?? selectedEndpoint ?? selectedCable;
			if (!deletable) return;
			if (event.key === "Delete" || event.key === "Backspace") {
				event.preventDefault();
				if (selected) useScene.getState().removeItem(selected);
				else if (selectedEndpoint)
					useScene.getState().removeEndpoint(selectedEndpoint);
				else if (selectedCable) useScene.getState().removeCable(selectedCable);
				selection.clearSelection();
				return;
			}
			// Duplicate is item-only (a cable/endpoint has no meaningful clone).
			if (
				selected &&
				(event.metaKey || event.ctrlKey) &&
				event.key.toLowerCase() === "d"
			) {
				event.preventDefault();
				const uid = useScene.getState().duplicateItem(selected);
				if (uid) useSelection.getState().selectItem(uid);
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, []);
}
