import { useLayoutEffect } from "react";
import { create } from "zustand";
import type { RectCm } from "../lib/geometry";
import { MOBILE_MEDIA } from "../lib/useMobile";
import {
	boardFocusBounds,
	fitBoundsToViewport,
	focusInsets,
	sceneFocusBounds,
} from "../lib/viewportFocus";
import { usePanelMetrics } from "./panel";
import {
	boardDefinition,
	type Cable,
	type CustomPedal,
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
 * The last focus is kept so the Margin Rule trigger can show a "you are here"
 * tint while the viewport still matches it, and so the Scope Frame dock can
 * report the board under the camera (no animation — F-05).
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
	customPedals: CustomPedal[];
	endpoints: Endpoint[];
	cables: Cable[];
	/** The stage + mobile strip/sheet geometry used to compute the fit. */
	size: CanvasSize;
	scaleStripHeight: number;
	sheetHeight: number;
}

interface FocusStore {
	last: FocusSnapshot | null;
	/** Board the camera is pinned to while the lock is on (ephemeral). */
	lockedBoardUid: string | null;
	/** Polite status text for an explicit focus (never for automatic load frames). */
	announcement: string;
	announceSeq: number;
	/** Every applied focus increments; used by E2E to prove load dedup. */
	epoch: number;
	mark: (snapshot: FocusSnapshot, announcement?: string) => void;
	lockCamera: (boardUid: string) => void;
	unlockCamera: () => void;
	reset: () => void;
}

export const useFocus = create<FocusStore>((set) => ({
	last: null,
	lockedBoardUid: null,
	announcement: "",
	announceSeq: 0,
	epoch: 0,
	mark: (last, announcement) =>
		set((state) => ({
			last,
			epoch: state.epoch + 1,
			...(announcement
				? { announcement, announceSeq: state.announceSeq + 1 }
				: null),
		})),
	lockCamera: (lockedBoardUid) => set({ lockedBoardUid }),
	unlockCamera: () => set({ lockedBoardUid: null }),
	reset: () => set({ last: null, lockedBoardUid: null }),
}));

export interface FocusViewportOptions {
	/** `auto` = board when a board is selected, otherwise the used area. */
	target?: FocusTarget | "auto";
	/** An explicit board target (paginator / locked refit); no selection change. */
	boardUid?: string;
	/** Zoom ceiling; load framing passes 1. */
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

/** The rendered stage size, so an info-rail push is seen before the observer. */
function currentStageSize(): CanvasSize {
	if (typeof document !== "undefined") {
		const rect = document
			.querySelector<HTMLElement>(".stage")
			?.getBoundingClientRect();
		if (rect && rect.width > 0 && rect.height > 0) {
			return {
				width: Math.round(rect.width),
				height: Math.round(rect.height),
			};
		}
	}
	return useViewport.getState().size;
}

/** The rendered Margin Rule strip height (mobile bottom reserve). */
function currentScaleStripHeight(): number {
	if (typeof document === "undefined") return 0;
	return (
		document.querySelector<HTMLElement>(".scale-strip")?.getBoundingClientRect()
			.height ?? 0
	);
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
	const size = currentStageSize();
	if (size.width <= 0 || size.height <= 0) return null;

	const selectedBoardUid = selectSelectedBoardUid(useSelection.getState());
	const requested = options.target ?? "auto";
	const explicitBoardUid = options.boardUid ?? null;
	const target: FocusTarget =
		requested === "auto"
			? explicitBoardUid || selectedBoardUid
				? "board"
				: "scene"
			: requested;
	const targetUid =
		target === "board" ? (explicitBoardUid ?? selectedBoardUid) : null;

	if (target === "board" && !targetUid) return null;

	// A scene target unlocks; a board target re-pins a held lock to that board.
	const focusStore = useFocus.getState();
	if (target === "scene") focusStore.unlockCamera();
	else if (targetUid && focusStore.lockedBoardUid) {
		focusStore.lockCamera(targetUid);
	}

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
	const measuredStripHeight = currentScaleStripHeight();
	const scaleStripHeight =
		measuredStripHeight > 0 ? measuredStripHeight : mobile ? 114 : 0;
	const viewport = fitBoundsToViewport(bounds, size, {
		insets: focusInsets(size, {
			mobile,
			sheetHeight,
			scaleStripHeight,
		}),
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
		customPedals: scene.customPedals,
		endpoints: scene.endpoints,
		cables: scene.cables,
		size: { width: size.width, height: size.height },
		scaleStripHeight,
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

/**
 * Run a focus after the next layout commits (two frames). Selection changes can
 * close the desktop info rail / mobile sheet; focusing synchronously would use
 * the stale stage width. Used by the double-click and paginator, which change
 * the selection; the chip (selection unchanged) focuses immediately.
 */
export function focusAfterLayout(options: FocusViewportOptions = {}): void {
	if (typeof requestAnimationFrame !== "function") {
		focusViewport(options);
		return;
	}
	requestAnimationFrame(() => {
		requestAnimationFrame(() => focusViewport(options));
	});
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
 * zoom, board-selection change, resize/info-sheet change, scene edit or undo
 * clears it.
 */
export function useIsFramed(): boolean {
	const last = useFocus((state) => state.last);
	const scale = useViewport((state) => state.scale);
	const x = useViewport((state) => state.x);
	const y = useViewport((state) => state.y);
	const boards = useScene((state) => state.boards);
	const items = useScene((state) => state.items);
	const customPedals = useScene((state) => state.customPedals);
	const endpoints = useScene((state) => state.endpoints);
	const cables = useScene((state) => state.cables);
	// Subscribe to the stage size so a rail push re-evaluates the tint.
	useViewport((state) => state.size);
	const sheetHeight = usePanelMetrics((state) => state.sheetHeight);
	const selectedBoardUid = useSelection(selectSelectedBoardUid);

	if (!last) return false;
	const target: FocusTarget = selectedBoardUid ? "board" : "scene";
	if (target !== last.target) return false;
	if ((selectedBoardUid ?? null) !== last.targetUid) return false;
	if (
		last.boards !== boards ||
		last.items !== items ||
		last.customPedals !== customPedals ||
		last.endpoints !== endpoints ||
		last.cables !== cables
	) {
		return false;
	}
	// A resize / info-rail push / strip or mobile peek change moves the safe
	// rect; the old focus is no longer the fit the user asked for.
	const size = currentStageSize();
	if (last.size.width !== size.width || last.size.height !== size.height) {
		return false;
	}
	if (Math.abs(last.scaleStripHeight - currentScaleStripHeight()) > 0.5) {
		return false;
	}
	if (Math.abs(last.sheetHeight - sheetHeight) > 0.5) return false;
	return sameViewport(last.viewport, { scale, x, y });
}

export interface CameraScene {
	boards: PlacedBoard[];
	items: PlacedItem[];
	customPedals: CustomPedal[];
	endpoints: Endpoint[];
	cables: Cable[];
}

export interface CameraState {
	last: FocusSnapshot | null;
	lockedBoardUid: string | null;
	viewport: Viewport;
	size: CanvasSize;
	scaleStripHeight: number;
	sheetHeight: number;
	scene: CameraScene;
}

/**
 * The board currently under the camera: the pinned lock board, or the last
 * explicit board focus while the camera still matches it. Selection changes do
 * NOT clear it (editing a pedal on the framed board keeps the board view); pan,
 * zoom, scene edits, resize or sheet/strip changes do.
 */
export function resolveCameraBoardUid(state: CameraState): string | null {
	const exists = (uid: string) =>
		state.scene.boards.some((board) => board.uid === uid);
	if (state.lockedBoardUid) {
		return exists(state.lockedBoardUid) ? state.lockedBoardUid : null;
	}
	const last = state.last;
	if (!last) return null;
	if (last.target !== "board" || !last.targetUid) return null;
	if (!exists(last.targetUid)) return null;
	if (
		last.boards !== state.scene.boards ||
		last.items !== state.scene.items ||
		last.customPedals !== state.scene.customPedals ||
		last.endpoints !== state.scene.endpoints ||
		last.cables !== state.scene.cables
	) {
		return null;
	}
	if (
		last.size.width !== state.size.width ||
		last.size.height !== state.size.height
	) {
		return null;
	}
	if (Math.abs(last.scaleStripHeight - state.scaleStripHeight) > 0.5) {
		return null;
	}
	if (Math.abs(last.sheetHeight - state.sheetHeight) > 0.5) return null;
	return sameViewport(last.viewport, state.viewport) ? last.targetUid : null;
}

/** Non-reactive board-under-camera read for event handlers. */
export function cameraBoardUid(): string | null {
	const viewport = useViewport.getState();
	return resolveCameraBoardUid({
		last: useFocus.getState().last,
		lockedBoardUid: useFocus.getState().lockedBoardUid,
		viewport: { scale: viewport.scale, x: viewport.x, y: viewport.y },
		size: currentStageSize(),
		scaleStripHeight: (() => {
			const strip = currentScaleStripHeight();
			return strip > 0 ? strip : isMobileViewport() ? 114 : 0;
		})(),
		sheetHeight: usePanelMetrics.getState().sheetHeight,
		scene: useScene.getState(),
	});
}

/** Reactive board-under-camera read for the Scope Frame dock. */
export function useCameraBoardUid(): string | null {
	const last = useFocus((state) => state.last);
	const lockedBoardUid = useFocus((state) => state.lockedBoardUid);
	const scale = useViewport((state) => state.scale);
	const x = useViewport((state) => state.x);
	const y = useViewport((state) => state.y);
	useViewport((state) => state.size);
	const sheetHeight = usePanelMetrics((state) => state.sheetHeight);
	const boards = useScene((state) => state.boards);
	const items = useScene((state) => state.items);
	const customPedals = useScene((state) => state.customPedals);
	const endpoints = useScene((state) => state.endpoints);
	const cables = useScene((state) => state.cables);
	const strip = currentScaleStripHeight();
	const mobile = isMobileViewport();

	return resolveCameraBoardUid({
		last,
		lockedBoardUid,
		viewport: { scale, x, y },
		size: currentStageSize(),
		scaleStripHeight: strip > 0 ? strip : mobile ? 114 : 0,
		sheetHeight,
		scene: { boards, items, customPedals, endpoints, cables },
	});
}

/** Is the camera currently pinned to an existing board? */
export function isCameraLocked(): boolean {
	const uid = useFocus.getState().lockedBoardUid;
	return (
		uid !== null &&
		useScene.getState().boards.some((board) => board.uid === uid)
	);
}

/** Toggle the camera lock for the board currently under the camera. */
export function toggleCameraLock(): void {
	const state = useFocus.getState();
	if (state.lockedBoardUid) {
		state.unlockCamera();
		return;
	}
	const uid = cameraBoardUid();
	if (uid) state.lockCamera(uid);
}

/**
 * Keep the pinned board framed when the usable rect changes (info rail push,
 * mobile peek, window resize). It deliberately does NOT re-fit on board moves:
 * the lock is a camera lock, not a follow mode.
 */
export function useCameraLockRefit(): void {
	const lockedBoardUid = useFocus((state) => state.lockedBoardUid);
	const lockedBoardExists = useScene((state) =>
		lockedBoardUid
			? state.boards.some((board) => board.uid === lockedBoardUid)
			: false,
	);
	const size = useViewport((state) => state.size);
	const sheetHeight = usePanelMetrics((state) => state.sheetHeight);

	// The sheet height changes the safe rect; focusViewport reads it from the
	// store, so the linter cannot see the dependency.
	// biome-ignore lint/correctness/useExhaustiveDependencies: re-fit on a mobile peek/rail layout change
	useLayoutEffect(() => {
		if (!lockedBoardUid) return;
		if (!lockedBoardExists) {
			useFocus.getState().unlockCamera();
			return;
		}
		if (size.width <= 0 || size.height <= 0) return;
		focusViewport({ target: "board", boardUid: lockedBoardUid });
	}, [lockedBoardUid, lockedBoardExists, sheetHeight, size.height, size.width]);
}
