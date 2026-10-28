import { create } from "zustand";
import type { RectCm } from "../lib/geometry";
import { MOBILE_MEDIA } from "../lib/useMobile";
import {
	boardFocusBounds,
	FOCUS_LOAD_MAX_SCALE,
	fitBoundsToViewport,
	focusInsets,
	sceneFocusBounds,
} from "../lib/viewportFocus";
import { usePanelMetrics } from "./panel";
import {
	boardDefinition,
	type Cable,
	type Endpoint,
	type PlacedBoard,
	type PlacedItem,
	useScene,
} from "./scene";
import { selectSelectedBoardUid, useSelection } from "./selection";
import {
	type CanvasSize,
	DEFAULT_VIEWPORT,
	MAX_SCALE,
	useViewport,
	type Viewport,
} from "./viewport";

/**
 * Viewport focus (F-04). A view-only command: it computes the target's cm bounds
 * (reusing the export scope) and applies one stage transform. It never touches
 * the scene, selection, history, autosave or the share URL.
 *
 * The last focus is kept only so the Margin Rule trigger can show a "you are
 * here" tint while the viewport still matches it (no animation — F-05).
 */

export type FocusTarget = "board" | "scene";

export interface FocusSnapshot {
	target: FocusTarget;
	/** The board uid for a board target, else null. */
	targetUid: string | null;
	bounds: RectCm;
	viewport: Viewport;
	/** Scene array references at focus time (any edit clears the framed tint). */
	boards: PlacedBoard[];
	items: PlacedItem[];
	endpoints: Endpoint[];
	cables: Cable[];
	/** The stage + mobile sheet geometry used to compute the fit. */
	size: CanvasSize;
	sheetHeight: number;
}

interface FocusStore {
	last: FocusSnapshot | null;
	/** Polite status text for an explicit focus (never for automatic load frames). */
	announcement: string;
	announceSeq: number;
	mark: (snapshot: FocusSnapshot, announcement?: string) => void;
	reset: () => void;
}

export const useFocus = create<FocusStore>((set) => ({
	last: null,
	announcement: "",
	announceSeq: 0,
	mark: (last, announcement) =>
		set((state) =>
			announcement
				? { last, announcement, announceSeq: state.announceSeq + 1 }
				: { last },
		),
	reset: () => set({ last: null }),
}));

export interface FocusViewportOptions {
	/** `auto` = board when a board is selected, otherwise the used area. */
	target?: FocusTarget | "auto";
	/** Zoom ceiling; load framing passes {@link FOCUS_LOAD_MAX_SCALE}. */
	maxScale?: number;
	/** A document load with no content should reset the viewport, not stay lost. */
	resetOnEmpty?: boolean;
	/** Explicit commands announce politely; automatic load frames stay silent. */
	announce?: boolean;
}

function isMobileViewport(): boolean {
	if (typeof window === "undefined") return false;
	return typeof window.matchMedia === "function"
		? window.matchMedia(MOBILE_MEDIA).matches
		: false;
}

function boardLabel(board: PlacedBoard | undefined): string {
	if (!board) return "board";
	const name = boardDefinition(board)?.name ?? board.name?.trim();
	return name && name.length > 0 ? name : "board";
}

/**
 * Frame a board or the used area. Returns the applied snapshot, or null when
 * there is nothing to frame / the stage has no size yet.
 *
 * Call this only from a user command or a document-load effect; never per frame.
 */
export function focusViewport(
	options: FocusViewportOptions = {},
): FocusSnapshot | null {
	const scene = useScene.getState();
	const size = useViewport.getState().size;
	if (size.width <= 0 || size.height <= 0) return null;

	const selectedBoardUid = selectSelectedBoardUid(useSelection.getState());
	const requested = options.target ?? "auto";
	const target: FocusTarget =
		requested === "auto" ? (selectedBoardUid ? "board" : "scene") : requested;
	const targetUid = target === "board" ? selectedBoardUid : null;

	if (target === "board" && !targetUid) return null;
	const bounds =
		target === "board" && targetUid
			? boardFocusBounds(scene, targetUid)
			: sceneFocusBounds(scene);

	if (!bounds) {
		if (options.resetOnEmpty) {
			useViewport.getState().setViewport({ ...DEFAULT_VIEWPORT });
			useFocus.getState().reset();
		}
		return null;
	}

	const mobile = isMobileViewport();
	const sheetHeight = usePanelMetrics.getState().sheetHeight;
	const viewport = fitBoundsToViewport(bounds, size, {
		insets: focusInsets(size, { mobile, sheetHeight }),
		paddingPx: mobile ? 16 : 24,
		maxScale: options.maxScale ?? MAX_SCALE,
	});
	if (!viewport) return null;

	useViewport.getState().setViewport(viewport);
	const snapshot: FocusSnapshot = {
		target,
		targetUid,
		bounds,
		viewport,
		boards: scene.boards,
		items: scene.items,
		endpoints: scene.endpoints,
		cables: scene.cables,
		size: { width: size.width, height: size.height },
		sheetHeight,
	};
	const announcement =
		options.announce === true
			? target === "board"
				? `Framed board — ${boardLabel(
						scene.boards.find((board) => board.uid === targetUid),
					)}`
				: "Framed all content"
			: undefined;
	useFocus.getState().mark(snapshot, announcement);
	return snapshot;
}

function sameViewport(a: Viewport, b: Viewport): boolean {
	const epsilon = 1e-6;
	return (
		Math.abs(a.scale - b.scale) < epsilon &&
		Math.abs(a.x - b.x) < epsilon &&
		Math.abs(a.y - b.y) < epsilon
	);
}

/**
 * Is the viewport still exactly where the last focus put it, with the same
 * target and an unchanged scene? Used for the trigger's framed tint. Any pan,
 * zoom, edit, undo or selection change clears it.
 */
export function useIsFramed(): boolean {
	const last = useFocus((state) => state.last);
	const scale = useViewport((state) => state.scale);
	const x = useViewport((state) => state.x);
	const y = useViewport((state) => state.y);
	const boards = useScene((state) => state.boards);
	const items = useScene((state) => state.items);
	const endpoints = useScene((state) => state.endpoints);
	const cables = useScene((state) => state.cables);
	const size = useViewport((state) => state.size);
	const sheetHeight = usePanelMetrics((state) => state.sheetHeight);
	const selectedBoardUid = useSelection(selectSelectedBoardUid);

	if (!last) return false;
	const target: FocusTarget = selectedBoardUid ? "board" : "scene";
	if (target !== last.target) return false;
	if ((selectedBoardUid ?? null) !== last.targetUid) return false;
	if (
		last.boards !== boards ||
		last.items !== items ||
		last.endpoints !== endpoints ||
		last.cables !== cables
	) {
		return false;
	}
	// A resize / info-rail push / mobile peek changes the safe rect; the old
	// focus is no longer the fit the user asked for.
	if (last.size.width !== size.width || last.size.height !== size.height) {
		return false;
	}
	if (Math.abs(last.sheetHeight - sheetHeight) > 0.5) return false;
	return sameViewport(last.viewport, { scale, x, y });
}
