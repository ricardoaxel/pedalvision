import { useIsMobile } from "../lib/useMobile";
import {
	type FocusTarget,
	focusViewport,
	useFocus,
	useIsFramed,
} from "../state/focus";
import { useScene } from "../state/scene";
import { selectSelectedBoardUid, useSelection } from "../state/selection";
import { useViewport } from "../state/viewport";
import { BOARD_VIEW_HINT_ID } from "./boardView";
import { FrameIcon } from "./icons";

/**
 * The F-04 **Scope Frame** control (owner-approved 2026-10-28): one contextual
 * instrument in the Margin Rule strip. It frames the selected board, or the
 * whole used area when no board is selected. The label always names its target,
 * so the scope is never ambiguous; the framed tint is the witness for an
 * instant (non-animated) jump.
 */
export function FrameControl() {
	const isMobile = useIsMobile();
	const target: FocusTarget = useSelection(selectSelectedBoardUid)
		? "board"
		: "scene";
	const hasContent = useScene(
		(state) =>
			state.boards.length + state.items.length + state.endpoints.length > 0,
	);
	const sizeReady = useViewport(
		(state) => state.size.width > 0 && state.size.height > 0,
	);
	const framed = useIsFramed();
	const announcement = useFocus((state) => state.announcement);
	const announceSeq = useFocus((state) => state.announceSeq);
	const disabled = !hasContent || !sizeReady;

	const targetLabel = target === "board" ? "board" : "all";
	const label = isMobile
		? targetLabel
		: target === "board"
			? "frame board"
			: "frame all";
	const title = disabled
		? "Nothing to frame yet"
		: target === "board"
			? "Frame board — F"
			: "Frame all content — F";
	const ariaLabel = disabled
		? "Frame — nothing to frame yet"
		: target === "board"
			? "Frame selected board"
			: "Frame all content";

	return (
		<>
			<button
				type="button"
				className="scale-readout__frame"
				data-testid="frame-trigger"
				data-target={target}
				data-framed={framed ? "true" : "false"}
				aria-label={ariaLabel}
				aria-keyshortcuts="F"
				aria-describedby={BOARD_VIEW_HINT_ID}
				aria-disabled={disabled || undefined}
				title={title}
				onClick={() => {
					if (disabled) return;
					focusViewport({ target, announce: true });
				}}
			>
				<FrameIcon size={12} />
				<span className="scale-readout__frame-label">{label}</span>
			</button>
			{/* Polite status: the instant jump gets a spoken witness. */}
			<span
				key={announceSeq}
				className="visually-hidden"
				role="status"
				aria-live="polite"
			>
				{announcement}
			</span>
		</>
	);
}
