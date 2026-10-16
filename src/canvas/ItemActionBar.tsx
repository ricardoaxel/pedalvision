import {
	type KeyboardEvent,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { cmToPx } from "../lib/geometry";
import { useDrag } from "../state/drag";
import { itemWorldCorners, useScene } from "../state/scene";
import { selectSelectedItemUid, useSelection } from "../state/selection";
import { useViewport } from "../state/viewport";

/** Degrees the action-bar rotate button advances per tap. */
export const ACTION_ROTATE_STEP = 45;
/** Gap between the selection's screen bounds and the bar (px). */
const GAP = 10;
/** Keep the bar this far inside the canvas edges (px). */
const MARGIN = 8;
/** The temp picker rail (rents the left edge on short screens) — keep clear. */
const RAIL_MEDIA = "(max-height: 620px) and (orientation: landscape)";
const RAIL_LEFT = 16; // matches --space-4
const RAIL_MAX_WIDTH = 220;
const RAIL_WIDTH_FRACTION = 0.45;
const RAIL_CLEARANCE = 16;

/**
 * The HTML action bar under the selection (design.md §Canvas architecture;
 * F6). It is positioned from the item's **screen** coordinates, recomputed on
 * zoom/pan and whenever the item or its board moves — never a Konva shape. The
 * buttons (rotate / duplicate / delete) are the touch-friendly counterpart to
 * the Transformer's rotate handle.
 *
 * The bar is a sibling of the stage in `.app` (fills the viewport), so
 * viewport-px coordinates map straight onto `left`/`top` and its presses never
 * reach the canvas gesture handler.
 */
export function ItemActionBar() {
	const selectedItemUid = useSelection(selectSelectedItemUid);
	const items = useScene((state) => state.items);
	const boards = useScene((state) => state.boards);
	const rotateItem = useScene((state) => state.rotateItem);
	const duplicateItem = useScene((state) => state.duplicateItem);
	const removeItem = useScene((state) => state.removeItem);
	const selectItem = useSelection((state) => state.selectItem);
	const clearSelection = useSelection((state) => state.clearSelection);
	const liftedUid = useDrag((state) => state.liftedUid);

	// Subscribed so React re-renders (and re-anchors) on any zoom/pan.
	const scale = useViewport((state) => state.scale);
	const vx = useViewport((state) => state.x);
	const vy = useViewport((state) => state.y);
	const viewportSize = useViewport((state) => state.size);

	const barRef = useRef<HTMLDivElement>(null);
	const [barWidth, setBarWidth] = useState(0);
	const [barHeight, setBarHeight] = useState(0);
	// On short screens the temp pickers stack in a left rail; the bar must not
	// paint over it.
	const [railPresent, setRailPresent] = useState(false);
	useEffect(() => {
		const query = window.matchMedia(RAIL_MEDIA);
		const update = () => setRailPresent(query.matches);
		update();
		query.addEventListener("change", update);
		return () => query.removeEventListener("change", update);
	}, []);
	// Roving tabindex: the toolbar is one tab stop; arrows move between buttons
	// (ARIA toolbar pattern).
	const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
	const [focusIndex, setFocusIndex] = useState(0);
	const actionCount = 3;
	const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		let next = focusIndex;
		if (event.key === "ArrowRight" || event.key === "ArrowDown") {
			next = (focusIndex + 1) % actionCount;
		} else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
			next = (focusIndex - 1 + actionCount) % actionCount;
		} else if (event.key === "Home") {
			next = 0;
		} else if (event.key === "End") {
			next = actionCount - 1;
		} else {
			return;
		}
		event.preventDefault();
		setFocusIndex(next);
		buttonRefs.current[next]?.focus();
	};

	const item = selectedItemUid
		? items.find((candidate) => candidate.uid === selectedItemUid)
		: undefined;
	const visible = item && item.uid !== liftedUid;

	useLayoutEffect(() => {
		if (!visible) return;
		const bar = barRef.current;
		if (!bar) return;
		setBarWidth(bar.offsetWidth);
		setBarHeight(bar.offsetHeight);
	}, [visible]);

	if (!item || !visible) return null;

	// The selection's screen-space bounding box (rotation-correct), so the bar
	// sits below the lowest corner for any item/board rotation.
	const corners = itemWorldCorners(item, boards).map((point) => ({
		x: cmToPx(point.x) * scale + vx,
		y: cmToPx(point.y) * scale + vy,
	}));
	const minX = Math.min(...corners.map((corner) => corner.x));
	const maxX = Math.max(...corners.map((corner) => corner.x));
	const maxY = Math.max(...corners.map((corner) => corner.y));

	const half = barWidth / 2;
	const railRight = railPresent
		? RAIL_LEFT +
			Math.min(RAIL_MAX_WIDTH, viewportSize.width * RAIL_WIDTH_FRACTION)
		: 0;
	const viewportMin = half + MARGIN;
	const viewportMax = Math.max(viewportMin, viewportSize.width - half - MARGIN);
	const railBound = railPresent
		? railRight + RAIL_CLEARANCE + half
		: viewportMin;
	// Only enforce the rail clearance when the bar still fits on-screen to the
	// right of the rail; when the screen is too narrow for both, keep the whole
	// bar inside the viewport instead of pushing Delete off the right edge.
	const minLeft =
		railBound + half <= viewportSize.width - MARGIN
			? Math.max(viewportMin, railBound)
			: viewportMin;
	const left = clamp((minX + maxX) / 2, minLeft, viewportMax);
	const top = clamp(
		maxY + GAP,
		MARGIN,
		Math.max(MARGIN, viewportSize.height - barHeight - MARGIN),
	);

	return (
		<div
			ref={barRef}
			className="item-action-bar"
			data-testid="item-action-bar"
			role="toolbar"
			aria-label="Selected pedal actions"
			onKeyDown={handleKeyDown}
			style={{ left: `${left}px`, top: `${top}px` }}
		>
			<button
				type="button"
				ref={(element) => {
					buttonRefs.current[0] = element;
				}}
				tabIndex={focusIndex === 0 ? 0 : -1}
				onFocus={() => setFocusIndex(0)}
				className="item-action-bar__button"
				data-testid="rotate-item"
				aria-label={`Rotate ${ACTION_ROTATE_STEP} degrees`}
				onClick={() =>
					rotateItem(item.uid, item.rotationDeg + ACTION_ROTATE_STEP)
				}
			>
				Rotate
			</button>
			<button
				type="button"
				ref={(element) => {
					buttonRefs.current[1] = element;
				}}
				tabIndex={focusIndex === 1 ? 0 : -1}
				onFocus={() => setFocusIndex(1)}
				className="item-action-bar__button"
				data-testid="duplicate-item"
				onClick={() => {
					const uid = duplicateItem(item.uid);
					if (uid) selectItem(uid);
				}}
			>
				Duplicate
			</button>
			<button
				type="button"
				ref={(element) => {
					buttonRefs.current[2] = element;
				}}
				tabIndex={focusIndex === 2 ? 0 : -1}
				onFocus={() => setFocusIndex(2)}
				className="item-action-bar__button item-action-bar__button--danger"
				data-testid="delete-item"
				onClick={() => {
					removeItem(item.uid);
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
