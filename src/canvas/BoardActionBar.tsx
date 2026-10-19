import {
	type KeyboardEvent,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { cmToPx } from "../lib/geometry";
import { boardWorldCorners, isCustomBoard, useScene } from "../state/scene";
import { selectSelectedBoardUid, useSelection } from "../state/selection";
import { useViewport } from "../state/viewport";
import {
	ACTION_BAR_GAP,
	ACTION_BAR_MARGIN,
	ACTION_BAR_MOBILE_MEDIA,
	ACTION_BAR_TAB_BAR_HEIGHT,
} from "./actionBarLayout";
import { nextEnabledIndex } from "./toolbarNav";

/**
 * The HTML action bar under a selected **custom** board (P2-05). Catalog boards
 * keep their existing chrome (rotate Transformer + the picker's "Remove selected
 * board"); a user-made board additionally gets Edit (reopen the creator
 * pre-filled) and Delete here. Positioned from the board's screen coordinates —
 * a sibling of the stage, so its presses never reach the canvas gesture handler
 * — and clamped inside the canvas pane, reserving the mobile tab bar. The
 * info sheet's height is NOT reserved: selecting a board clears the item
 * selection, so the P2-03 panel is never open alongside this bar.
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
	const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
	const [barWidth, setBarWidth] = useState(0);
	const [barHeight, setBarHeight] = useState(0);
	const [focusIndex, setFocusIndex] = useState(0);
	const [mobile, setMobile] = useState(false);
	useEffect(() => {
		const query = window.matchMedia(ACTION_BAR_MOBILE_MEDIA);
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

	const actions = [
		{
			key: "edit-custom-board",
			label: "Edit custom board",
			text: "Edit",
			danger: false,
			onClick: () => onEditBoard?.(board.uid),
		},
		{
			key: "delete-custom-board",
			label: "Delete custom board",
			text: "Delete",
			danger: true,
			onClick: () => {
				removeBoard(board.uid);
				clearSelection();
				// The bar unmounts with the selection — move focus to a stable,
				// visible control so keyboard users aren't dropped onto <body>.
				const target =
					document.querySelector<HTMLElement>(
						'[data-testid="picker-open-board"]',
					) ??
					document.querySelector<HTMLElement>(
						'[data-testid="picker-bar-boards"]',
					);
				if (target && target.offsetParent !== null) target.focus();
			},
		},
	];

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
	const viewportMin = half + ACTION_BAR_MARGIN;
	const viewportMax = Math.max(
		viewportMin,
		viewportSize.width - half - ACTION_BAR_MARGIN,
	);
	const bottomReserve = mobile ? ACTION_BAR_TAB_BAR_HEIGHT : 0;
	const left = clamp((minX + maxX) / 2, viewportMin, viewportMax);
	const top = clamp(
		maxY + ACTION_BAR_GAP,
		ACTION_BAR_MARGIN,
		Math.max(
			ACTION_BAR_MARGIN,
			viewportSize.height - bottomReserve - barHeight - ACTION_BAR_MARGIN,
		),
	);

	// Roving tabindex: the toolbar is one tab stop; arrows move between buttons
	// (the same ARIA toolbar contract as the item action bar).
	const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		const enabled = actions.map((_action, index) => index);
		const nextIndex = nextEnabledIndex(enabled, focusIndex, event.key);
		if (nextIndex === null) return;
		event.preventDefault();
		setFocusIndex(nextIndex);
		buttonRefs.current[nextIndex]?.focus();
	};

	return (
		<div
			ref={barRef}
			className="item-action-bar"
			data-testid="board-action-bar"
			role="toolbar"
			aria-label="Selected board actions"
			onKeyDown={handleKeyDown}
			style={{ left: `${left}px`, top: `${top}px` }}
		>
			{actions.map((action, index) => (
				<button
					key={action.key}
					type="button"
					ref={(element) => {
						buttonRefs.current[index] = element;
					}}
					tabIndex={index === (focusIndex === 1 ? 1 : 0) ? 0 : -1}
					onFocus={() => setFocusIndex(index)}
					className={[
						"item-action-bar__button",
						action.danger ? "item-action-bar__button--danger" : "",
					]
						.join(" ")
						.trim()}
					data-testid={action.key}
					onClick={action.onClick}
				>
					{action.text}
				</button>
			))}
		</div>
	);
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}
