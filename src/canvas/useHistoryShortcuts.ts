import { useEffect } from "react";
import { hasActiveDialog } from "../lib/dialog";
import { redo, undo } from "../state/history";
import { isReadOnly } from "../state/readOnly";

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
 * An open modal owns the keyboard, including any uncommitted custom-part
 * draft (the picker is the only `aria-modal` surface today). Undo/redo must not
 * pull the scene out from under a draft.
 */
function isModalOpen(): boolean {
	return hasActiveDialog('[aria-modal="true"]');
}

/**
 * Undo/redo shortcuts (F6/F8, N6): Cmd/Ctrl+Z undoes, Cmd/Ctrl+Shift+Z redoes.
 * Mounted once (App). Ignored inside text fields, while composing, and while a
 * modal is open; read-only shared previews have no history to move.
 */
export function useHistoryShortcuts(): void {
	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.defaultPrevented) return;
			if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
			if (event.key.toLowerCase() !== "z") return;
			if (event.isComposing || isTypingTarget(event.target)) return;
			if (isModalOpen()) return;
			if (isReadOnly()) return;
			event.preventDefault();
			if (event.shiftKey) redo();
			else undo();
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, []);
}
