import {
	type KeyboardEvent,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { cmToPx } from "../lib/geometry";
import { useDrag } from "../state/drag";
import { usePanelMetrics } from "../state/panel";
import {
	containerItemsByZ,
	itemWorldCorners,
	type PlacedItem,
	resolveItem,
	useScene,
	type ZDirection,
} from "../state/scene";
import { selectSelectedItemUid, useSelection } from "../state/selection";
import { useViewport } from "../state/viewport";
import { nextEnabledIndex } from "./toolbarNav";

/** Degrees the action-bar rotate button advances per tap. */
export const ACTION_ROTATE_STEP = 45;
/** Gap between the selection's screen bounds and the bar (px). */
const GAP = 10;
/** Keep the bar this far inside the canvas edges (px). */
const MARGIN = 8;
/** Mobile keeps the picker bottom tab bar clear (P2-01) — bar height (px). */
const MOBILE_MEDIA = "(max-width: 1023px)";
const TAB_BAR_HEIGHT = 56;
/** Buttons in the leading z-order cluster (kept as one non-breaking group). */
const Z_ACTION_COUNT = 4;

interface ActionDef {
	key: string;
	label: string;
	icon?: React.ReactNode;
	text?: string;
	disabled?: boolean;
	danger?: boolean;
	onClick: () => void;
}

/** A z-order glyph: a single arrow for one step, a double chevron for
 * to-front/to-back (the industry convention). */
function ZOrderIcon({ direction }: { direction: ZDirection }) {
	const paths: Record<ZDirection, string[]> = {
		forward: ["M12 19V6", "M6 12l6-6 6 6"],
		back: ["M12 5v13", "M6 12l6 6 6-6"],
		front: ["M6 17l6-6 6 6", "M6 11l6-6 6 6"],
		bottom: ["M6 7l6 6 6-6", "M6 13l6 6 6-6"],
	};
	return (
		<svg
			width="18"
			height="18"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
			focusable="false"
		>
			{paths[direction].map((d) => (
				<path key={d} d={d} />
			))}
		</svg>
	);
}

/**
 * The HTML action bar under the selection (design.md §Canvas architecture;
 * F6). It is positioned from the item's **screen** coordinates, recomputed on
 * zoom/pan and whenever the item or its board moves — never a Konva shape. The
 * buttons are the touch-friendly counterpart to the Transformer's rotate handle:
 * z-order (forward/back/front/bottom, F5/P1-06), rotate, duplicate and delete.
 * Z-order buttons are disabled at their container's extremes.
 *
 * The bar is a sibling of the stage in `.app` (fills the viewport), so
 * viewport-px coordinates map straight onto `left`/`top` and its presses never
 * reach the canvas gesture handler.
 */
export function ItemActionBar({
	onEditCustom,
}: {
	/** Open the custom creator pre-filled for this custom part (P2-02 edit). */
	onEditCustom?: (refId: string) => void;
}) {
	const selectedItemUid = useSelection(selectSelectedItemUid);
	const items = useScene((state) => state.items);
	const boards = useScene((state) => state.boards);
	const customPedals = useScene((state) => state.customPedals);
	const rotateItem = useScene((state) => state.rotateItem);
	const duplicateItem = useScene((state) => state.duplicateItem);
	const removeItem = useScene((state) => state.removeItem);
	const reorder = useScene((state) => state.reorder);
	const selectItem = useSelection((state) => state.selectItem);
	const clearSelection = useSelection((state) => state.clearSelection);
	const liftedUid = useDrag((state) => state.liftedUid);
	const sheetHeight = usePanelMetrics((state) => state.sheetHeight);

	// Subscribed so React re-renders (and re-anchors) on any zoom/pan.
	const scale = useViewport((state) => state.scale);
	const vx = useViewport((state) => state.x);
	const vy = useViewport((state) => state.y);
	const viewportSize = useViewport((state) => state.size);

	const barRef = useRef<HTMLDivElement>(null);
	const [barWidth, setBarWidth] = useState(0);
	const [barHeight, setBarHeight] = useState(0);
	// Mobile shows the picker's persistent bottom tab bar; the bar must not
	// paint over it (P2-01).
	const [mobile, setMobile] = useState(false);
	useEffect(() => {
		const query = window.matchMedia(MOBILE_MEDIA);
		const update = () => setMobile(query.matches);
		update();
		query.addEventListener("change", update);
		return () => query.removeEventListener("change", update);
	}, []);
	// Roving tabindex: the toolbar is one tab stop; arrows move between the
	// enabled buttons (ARIA toolbar pattern). Disabled buttons are skipped.
	const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
	const [focusIndex, setFocusIndex] = useState(0);

	const item = selectedItemUid
		? items.find((candidate) => candidate.uid === selectedItemUid)
		: undefined;
	const visible = item && item.uid !== liftedUid;
	// Z-order buttons disable at their container's extremes (nothing to move
	// past). Memoised so a pan/zoom re-render doesn't re-sort every item.
	const peers = useMemo(
		() => (item ? containerItemsByZ(items, item) : []),
		[items, item],
	);
	const position = item
		? peers.findIndex((candidate) => candidate.uid === item.uid)
		: -1;
	// A user-defined part can be re-opened in the creator; catalog items can't.
	const isCustom = item
		? resolveItem(item, customPedals).custom !== null
		: false;
	const actions: ActionDef[] =
		item && visible
			? buildActions(item, position === peers.length - 1, position === 0, {
					isCustom,
					reorder,
					rotateItem,
					duplicateItem,
					removeItem,
					selectItem,
					clearSelection,
					onEditCustom,
				})
			: [];
	const enabledIndices = actions
		.map((_action, index) => index)
		.filter((index) => !actions[index].disabled);
	const activeIndex = enabledIndices.includes(focusIndex)
		? focusIndex
		: (enabledIndices[0] ?? 0);

	const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		const nextIndex = nextEnabledIndex(enabledIndices, activeIndex, event.key);
		if (nextIndex === null) return;
		event.preventDefault();
		setFocusIndex(nextIndex);
		buttonRefs.current[nextIndex]?.focus();
	};

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
	const corners = itemWorldCorners(item, boards, customPedals).map((point) => ({
		x: cmToPx(point.x) * scale + vx,
		y: cmToPx(point.y) * scale + vy,
	}));
	const minX = Math.min(...corners.map((corner) => corner.x));
	const maxX = Math.max(...corners.map((corner) => corner.x));
	const maxY = Math.max(...corners.map((corner) => corner.y));

	const half = barWidth / 2;
	const viewportMin = half + MARGIN;
	const viewportMax = Math.max(viewportMin, viewportSize.width - half - MARGIN);
	// Mobile reserves the picker tab bar AND the info sheet's measured height
	// (the sheet is always present while an item is selected, P2-03).
	const bottomReserve = mobile ? TAB_BAR_HEIGHT + sheetHeight : 0;
	const left = clamp((minX + maxX) / 2, viewportMin, viewportMax);
	const top = clamp(
		maxY + GAP,
		MARGIN,
		Math.max(MARGIN, viewportSize.height - bottomReserve - barHeight - MARGIN),
	);

	const button = (action: ActionDef, index: number) => (
		<button
			key={action.key}
			type="button"
			ref={(element) => {
				buttonRefs.current[index] = element;
			}}
			tabIndex={index === activeIndex ? 0 : -1}
			onFocus={() => setFocusIndex(index)}
			disabled={action.disabled}
			className={[
				"item-action-bar__button",
				action.icon ? "item-action-bar__button--icon" : "",
				action.danger ? "item-action-bar__button--danger" : "",
			]
				.join(" ")
				.trim()}
			data-testid={action.key}
			aria-label={action.label}
			title={action.label}
			onClick={action.onClick}
		>
			{action.icon ?? action.text}
		</button>
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
			<div className="item-action-bar__group">
				{actions.slice(0, Z_ACTION_COUNT).map(button)}
			</div>
			{actions
				.slice(Z_ACTION_COUNT)
				.map((action, index) => button(action, Z_ACTION_COUNT + index))}
		</div>
	);
}

/**
 * The bar's buttons for the given item: the z-order cluster (disabled at the
 * container's extremes) followed by rotate / duplicate / delete.
 */
function buildActions(
	item: PlacedItem,
	atTop: boolean,
	atBottom: boolean,
	handlers: {
		isCustom: boolean;
		reorder: (uid: string, direction: ZDirection) => void;
		rotateItem: (uid: string, rotationDeg: number) => void;
		duplicateItem: (uid: string) => string | null;
		removeItem: (uid: string) => void;
		selectItem: (uid: string | null) => void;
		clearSelection: () => void;
		onEditCustom?: (refId: string) => void;
	},
): ActionDef[] {
	const z = (direction: ZDirection) => () =>
		handlers.reorder(item.uid, direction);
	const edit: ActionDef[] =
		handlers.isCustom && handlers.onEditCustom
			? [
					{
						key: "edit-custom-part",
						label: "Edit custom part",
						text: "Edit",
						onClick: () => handlers.onEditCustom?.(item.refId),
					},
				]
			: [];
	return [
		{
			key: "bring-to-front",
			label: "Bring to front",
			icon: <ZOrderIcon direction="front" />,
			disabled: atTop,
			onClick: z("front"),
		},
		{
			key: "bring-forward",
			label: "Bring forward",
			icon: <ZOrderIcon direction="forward" />,
			disabled: atTop,
			onClick: z("forward"),
		},
		{
			key: "send-backward",
			label: "Send backward",
			icon: <ZOrderIcon direction="back" />,
			disabled: atBottom,
			onClick: z("back"),
		},
		{
			key: "send-to-back",
			label: "Send to back",
			icon: <ZOrderIcon direction="bottom" />,
			disabled: atBottom,
			onClick: z("bottom"),
		},
		...edit,
		{
			key: "rotate-item",
			label: `Rotate ${ACTION_ROTATE_STEP} degrees`,
			text: "Rotate",
			onClick: () =>
				handlers.rotateItem(item.uid, item.rotationDeg + ACTION_ROTATE_STEP),
		},
		{
			key: "duplicate-item",
			label: "Duplicate",
			text: "Duplicate",
			onClick: () => {
				const uid = handlers.duplicateItem(item.uid);
				if (uid) handlers.selectItem(uid);
			},
		},
		{
			key: "delete-item",
			label: "Delete",
			text: "Delete",
			danger: true,
			onClick: () => {
				handlers.removeItem(item.uid);
				handlers.clearSelection();
			},
		},
	];
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}
