/**
 * Input types that do not accept text. Shortcuts may still fire while one of
 * these owns focus (e.g. Cmd/Ctrl+Z after picking a cable ink radio).
 */
const NON_TEXT_INPUT_TYPES = new Set([
	"button",
	"checkbox",
	"color",
	"file",
	"image",
	"radio",
	"range",
	"reset",
	"submit",
]);

/**
 * True when the event target is a text field (never steal its keystrokes).
 * `includeSelect` adds `<select>` for shortcuts that previously treated it as a
 * field (focus/measure); undo/selection deliberately leave it out, because a
 * jack-kind change is a normal scene mutation that Cmd/Ctrl+Z should undo.
 */
export function isTypingTarget(
	target: EventTarget | null,
	includeSelect = false,
): boolean {
	const element = target as HTMLElement | null;
	if (!element) return false;
	if (element.tagName === "INPUT") {
		return !NON_TEXT_INPUT_TYPES.has((element as HTMLInputElement).type);
	}
	return (
		element.tagName === "TEXTAREA" ||
		(includeSelect && element.tagName === "SELECT") ||
		element.isContentEditable
	);
}
