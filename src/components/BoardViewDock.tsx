import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import {
	focusAfterLayout,
	toggleCameraLock,
	useCameraBoardUid,
	useFocus,
} from "../state/focus";
import { useScene } from "../state/scene";
import { useSelection } from "../state/selection";
import { BOARD_VIEW_HINT, BOARD_VIEW_HINT_ID } from "./boardView";
import { ChevronIcon, LockIcon } from "./icons";

/**
 * F-04 amendment — the **Scope Frame dock** (owner-approved 2026-10-28).
 * A quiet right-column instrument: `‹ n / total ›` frames the previous/next
 * board (selects it too) and wraps; the lock pins the camera to the focused
 * board. Both are view-only and work in read-only shares.
 *
 * The dock lives in the Margin Rule strip's empty third grid cell on desktop
 * and as a third row on mobile. It is always mounted, including 0/0.
 */
export function BoardViewDock() {
	const boards = useScene((state) => state.boards);
	const cameraUid = useCameraBoardUid();
	const lockedBoardUid = useFocus((state) => state.lockedBoardUid);

	const total = boards.length;
	const index = cameraUid
		? boards.findIndex((board) => board.uid === cameraUid)
		: -1;
	const locked =
		lockedBoardUid !== null &&
		boards.some((board) => board.uid === lockedBoardUid);
	const canPaginate = total > 1;
	const canLock = index >= 0 || lockedBoardUid !== null;
	const counter =
		total === 0
			? "0 / 0"
			: index >= 0
				? `${index + 1} / ${total}`
				: `all / ${total}`;

	const go = (direction: -1 | 1) => {
		if (!canPaginate) return;
		const next =
			index === -1
				? direction === 1
					? 0
					: total - 1
				: (index + direction + total) % total;
		const board = boards[next];
		if (!board) return;
		useSelection.getState().selectBoard(board.uid);
		focusAfterLayout({ target: "board", boardUid: board.uid, announce: true });
	};

	// Arrow keys act as prev/next only while a dock button owns focus.
	const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
		if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
		const target = event.target as HTMLElement;
		if (target.tagName !== "BUTTON") return;
		event.preventDefault();
		go(event.key === "ArrowLeft" ? -1 : 1);
	};

	return (
		// biome-ignore lint/a11y/useSemanticElements: a board-view instrument is not a form
		<div
			className="board-view-dock"
			data-testid="board-view-dock"
			data-index={index}
			data-total={total}
			data-locked={locked ? "true" : "false"}
			role="group"
			aria-label="Board view"
			aria-describedby={BOARD_VIEW_HINT_ID}
			onKeyDown={onKeyDown}
		>
			<button
				type="button"
				className="board-view-dock__button"
				data-testid="board-prev"
				aria-label="Previous board"
				title="Previous board"
				disabled={!canPaginate}
				onClick={() => go(-1)}
			>
				<ChevronIcon size={10} path="M15 6l-6 6 6 6" />
			</button>
			<span
				className="board-view-dock__counter"
				data-testid="board-counter"
				aria-live="polite"
				aria-atomic="true"
				title={BOARD_VIEW_HINT}
			>
				{counter}
			</span>
			<button
				type="button"
				className="board-view-dock__button"
				data-testid="board-next"
				aria-label="Next board"
				title="Next board"
				disabled={!canPaginate}
				onClick={() => go(1)}
			>
				<ChevronIcon size={10} path="M9 6l6 6-6 6" />
			</button>
			<span className="board-view-dock__sep" aria-hidden="true" />
			<button
				type="button"
				className="board-view-dock__lock"
				data-testid="board-lock"
				aria-label={locked ? "Unlock board view" : "Lock board view"}
				aria-pressed={locked}
				aria-keyshortcuts="L"
				aria-disabled={canLock ? undefined : true}
				title={
					locked
						? "Locked to board — L"
						: canLock
							? "Lock board view — L"
							: "Frame a board to lock the view"
				}
				onClick={() => {
					if (canLock) toggleCameraLock();
				}}
			>
				<LockIcon size={12} />
			</button>
			<span id={BOARD_VIEW_HINT_ID} className="visually-hidden">
				{BOARD_VIEW_HINT}
			</span>
		</div>
	);
}
