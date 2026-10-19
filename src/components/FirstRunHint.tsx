import { useState } from "react";
import {
	dismissFirstRun,
	isFirstRunDismissed,
	shouldShowFirstRunHint,
} from "../lib/firstRun";
import { focusAddBoardTrigger } from "../lib/focus";
import { useScene } from "../state/scene";

interface FirstRunHintProps {
	/** Open the board picker — the note's single primary action. */
	onAddBoard: () => void;
}

/**
 * "Bench Note" (P2-08, owner-approved direction): a small drafting annotation
 * pinned to existing chrome that tells a first-time user where to start. It is
 * non-modal, never covers the canvas centre, and retires itself once the first
 * board or pedal exists or the user dismisses it.
 */
export function FirstRunHint({ onAddBoard }: FirstRunHintProps) {
	const boardCount = useScene((state) => state.boards.length);
	const itemCount = useScene((state) => state.items.length);
	const [dismissed, setDismissed] = useState(isFirstRunDismissed);

	if (!shouldShowFirstRunHint({ boardCount, itemCount, dismissed })) {
		return null;
	}

	const handleDismiss = () => {
		dismissFirstRun();
		setDismissed(true);
		// Removing a focused control would drop keyboard users to <body>. The Add
		// board trigger is the next logical stop — desktop toolbar or mobile tab
		// bar, whichever layout is showing.
		focusAddBoardTrigger();
	};

	return (
		<aside
			className="first-run"
			role="note"
			aria-labelledby="first-run-title"
			data-testid="first-run-hint"
		>
			<p className="first-run__eyebrow">Start here</p>
			<div className="first-run__main">
				<p className="first-run__title" id="first-run-title">
					Start with a board.
				</p>
				<p className="first-run__support">
					Then place pedals on it — true to scale.
				</p>
				<button
					type="button"
					className="first-run__cta"
					data-testid="first-run-cta"
					onClick={onAddBoard}
				>
					Add a board
				</button>
			</div>
			<button
				type="button"
				className="first-run__dismiss"
				data-testid="first-run-dismiss"
				aria-label="Dismiss first-run hint"
				onClick={handleDismiss}
			>
				<span aria-hidden="true">×</span>
			</button>
		</aside>
	);
}
