import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { cmToPx } from "../lib/geometry";
import { boardWorldCorners, isCustomBoard, useScene } from "../state/scene";
import { selectSelectedBoardUid, useSelection } from "../state/selection";
import { useViewport } from "../state/viewport";

/** Gap between the board's screen bounds and the bar (px). */
const GAP = 10;
/** Keep the bar this far inside the canvas edges (px). */
const MARGIN = 8;
/** Mobile keeps the picker bottom tab bar clear (px). */
const MOBILE_MEDIA = "(max-width: 1023px)";
const TAB_BAR_HEIGHT = 56;

/**
 * The HTML action bar under a selected **custom** board (P2-05). Catalog boards
 * keep their existing chrome (rotate Transformer + the picker's "Remove selected
 * board"); a user-made board additionally gets Edit (reopen the creator
 * pre-filled) and Delete here. Positioned from the board's screen coordinates —
 * a sibling of the stage, so its presses never reach the canvas gesture handler
 * — and clamped inside the canvas pane (reserving the mobile tab bar).
 */
export function BoardActionBar({
	onEditBoard,
}: {
	/** Open the custom-board creator pre-filled for this board uid (P2-05). */
	onEditBoard?: (uid: string) => void;
}) {
	const selectedBoardUid = useSelection(selectSelectedBoardUid);
	const boards = useScene((state) => state.boards);
	const removeBoard = useScene((state) => state.removeBoard);
	const clearSelection = useSelection((state) => state.clearSelection);

	// Subscribed so React re-renders (and re-anchors) on any zoom/pan.
	const scale = useViewport((state) => state.scale);
	const vx = useViewport((state) => state.x);
	const vy = useViewport((state) => state.y);
	const viewportSize = useViewport((state) => state.size);

	const barRef = useRef<HTMLDivElement>(null);
	const [barWidth, setBarWidth] = useState(0);
	const [barHeight, setBarHeight] = useState(0);
	const [mobile, setMobile] = useState(false);
	useEffect(() => {
		const query = window.matchMedia(MOBILE_MEDIA);
		const update = () => setMobile(query.matches);
		update();
		query.addEventListener("change", update);
		return () => query.removeEventListener("change", update);
	}, []);

	const board = selectedBoardUid
		? boards.find((candidate) => candidate.uid === selectedBoardUid)
		: undefined;
	const visible = board !== undefined && isCustomBoard(board);

	useLayoutEffect(() => {
		if (!visible) return;
		const bar = barRef.current;
		if (!bar) return;
		setBarWidth(bar.offsetWidth);
		setBarHeight(bar.offsetHeight);
	}, [visible]);

	if (!board || !visible) return null;

	// The board's screen-space bounding box (rotation-correct), so the bar sits
	// below the lowest corner for any board rotation.
	const corners = boardWorldCorners(board).map((point) => ({
		x: cmToPx(point.x) * scale + vx,
		y: cmToPx(point.y) * scale + vy,
	}));
	const minX = Math.min(...corners.map((corner) => corner.x));
	const maxX = Math.max(...corners.map((corner) => corner.x));
	const maxY = Math.max(...corners.map((corner) => corner.y));

	const half = barWidth / 2;
	const viewportMin = half + MARGIN;
	const viewportMax = Math.max(viewportMin, viewportSize.width - half - MARGIN);
	const bottomReserve = mobile ? TAB_BAR_HEIGHT : 0;
	const left = clamp((minX + maxX) / 2, viewportMin, viewportMax);
	const top = clamp(
		maxY + GAP,
		MARGIN,
		Math.max(MARGIN, viewportSize.height - bottomReserve - barHeight - MARGIN),
	);

	return (
		<div
			ref={barRef}
			className="item-action-bar"
			data-testid="board-action-bar"
			role="toolbar"
			aria-label="Selected board actions"
			style={{ left: `${left}px`, top: `${top}px` }}
		>
			<button
				type="button"
				className="item-action-bar__button"
				data-testid="edit-custom-board"
				onClick={() => onEditBoard?.(board.uid)}
			>
				Edit
			</button>
			<button
				type="button"
				className="item-action-bar__button item-action-bar__button--danger"
				data-testid="delete-custom-board"
				onClick={() => {
					removeBoard(board.uid);
					clearSelection();
				}}
			>
				Delete
			</button>
		</div>
	);
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}
