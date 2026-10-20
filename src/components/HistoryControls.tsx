import { redo, undo, useHistory } from "../state/history";
import { RedoIcon, UndoIcon } from "./icons";

/**
 * Undo/redo controls ("Proof Marks", P3-04; owner-approved 2026-10-20).
 *
 * One component, two placements: a quiet joined capsule at the leading edge of
 * the desktop toolbar, and a flat pair pinned to the trailing edge of the
 * existing mobile bottom dock. Icon-only by design; the shortcut lives in the
 * accessible name/title. `aria-disabled` (not native `disabled`) keeps focus on
 * the button through the final undo instead of dropping it to `<body>`.
 */
export function HistoryControls({ variant }: { variant: "toolbar" | "dock" }) {
	const canUndo = useHistory((state) => state.past.length > 0);
	const canRedo = useHistory((state) => state.future.length > 0);
	const suffix = variant === "dock" ? "-mobile" : "";

	return (
		<fieldset
			className={`history-bar history-bar--${variant}`}
			aria-label="History"
		>
			<button
				type="button"
				className="history-button"
				data-testid={`history-undo${suffix}`}
				aria-label="Undo"
				aria-keyshortcuts="Control+Z Meta+Z"
				aria-disabled={canUndo ? undefined : "true"}
				title="Undo — Ctrl/⌘ Z"
				onClick={() => {
					if (canUndo) undo();
				}}
			>
				<UndoIcon />
			</button>
			<button
				type="button"
				className="history-button"
				data-testid={`history-redo${suffix}`}
				aria-label="Redo"
				aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z"
				aria-disabled={canRedo ? undefined : "true"}
				title="Redo — Ctrl/⌘ Shift Z"
				onClick={() => {
					if (canRedo) redo();
				}}
			>
				<RedoIcon />
			</button>
		</fieldset>
	);
}
