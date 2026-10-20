import { create } from "zustand";
import { isReadOnly } from "./readOnly";
import { useScene } from "./scene";
import type { SceneSnapshot } from "./sceneDocument";

/**
 * Undo/redo (P3-04, design.md §Persistence → S5/F8).
 *
 * A snapshot stack over the **persisted scene slice** — never selection,
 * viewport, drag, picker or panel state. Snapshots are captured lazily from the
 * scene store's previous state, so unchanged boards/items are shared between
 * entries (mutators copy on write); 50 entries stay cheap.
 *
 * One user action = one step: changes made synchronously (a whole drag/rotate
 * commit, a custom-pedal definition + its placement, a board rotate + origin
 * shift) are coalesced into a single microtask, so only one entry is pushed.
 * Undo/redo restore a snapshot without recording anything.
 *
 * P4 extension point: adding `endpoints`/`cables` to `SceneSnapshot` makes the
 * exhaustive `satisfies Record<keyof SceneSnapshot, true>` below fail to
 * compile until they are added there — capture and restore then pick them up.
 */
const HISTORY_SCENE_KEY_MAP = {
	boards: true,
	items: true,
	customPedals: true,
} satisfies Record<keyof SceneSnapshot, true>;

export const HISTORY_SCENE_KEYS = Object.keys(
	HISTORY_SCENE_KEY_MAP,
) as (keyof SceneSnapshot)[];

/** The maximum number of undo (and redo) entries kept. */
export const HISTORY_LIMIT = 50;

interface HistoryStore {
	/** Past states, oldest first; the last entry is the next undo target. */
	past: SceneSnapshot[];
	/** Undone states, oldest first; the last entry is the next redo target. */
	future: SceneSnapshot[];
}

export const useHistory = create<HistoryStore>(() => ({
	past: [],
	future: [],
}));

/** Copy the editable scene fields out of any scene-shaped object. */
function pickScene(source: SceneSnapshot): SceneSnapshot {
	const snapshot = {} as SceneSnapshot;
	const writable = snapshot as unknown as Record<string, unknown>;
	for (const key of HISTORY_SCENE_KEYS) writable[key] = source[key];
	return snapshot;
}

/** The scene fields as they are right now. */
export function captureScene(): SceneSnapshot {
	return pickScene(useScene.getState());
}

function keysChanged(next: SceneSnapshot, previous: SceneSnapshot): boolean {
	return HISTORY_SCENE_KEYS.some((key) => next[key] !== previous[key]);
}

function sameContent(a: SceneSnapshot, b: SceneSnapshot): boolean {
	if (!keysChanged(a, b)) return true;
	return HISTORY_SCENE_KEYS.every(
		(key) => JSON.stringify(a[key]) === JSON.stringify(b[key]),
	);
}

/** Set while a snapshot is being restored so it is never recorded. */
let restoring = false;
/** The state before the current synchronous burst of edits. */
let pendingBefore: SceneSnapshot | null = null;
let finalizeScheduled = false;

function finalize(): void {
	const before = pendingBefore;
	pendingBefore = null;
	if (!before) return;
	const after = captureScene();
	if (sameContent(before, after)) return;
	useHistory.setState((state) => ({
		past: [...state.past, before].slice(-HISTORY_LIMIT),
		future: [],
	}));
}

function scheduleFinalize(): void {
	if (finalizeScheduled) return;
	finalizeScheduled = true;
	queueMicrotask(() => {
		finalizeScheduled = false;
		finalize();
	});
}

/** Record committed scene edits; undo/redo restoration is ignored. */
useScene.subscribe((state, previous) => {
	if (restoring) return;
	if (!keysChanged(state, previous)) return;
	if (!pendingBefore) pendingBefore = pickScene(previous);
	scheduleFinalize();
});

/** Apply a snapshot without letting the subscription record it. */
function applySnapshot(snapshot: SceneSnapshot): void {
	restoring = true;
	try {
		useScene.setState(pickScene(snapshot));
	} finally {
		restoring = false;
	}
}

/**
 * Capture any queued edit immediately.
 * @internal Deterministic-test helper; production entry points call `undo`/`redo`,
 * which finalise the pending burst first.
 */
export function flushHistory(): void {
	finalize();
}

/** Undo the last committed action. Returns false when there is nothing to undo. */
export function undo(): boolean {
	if (isReadOnly()) return false;
	finalize();
	const { past, future } = useHistory.getState();
	const previous = past[past.length - 1];
	if (!previous) return false;
	const current = captureScene();
	useHistory.setState({
		past: past.slice(0, -1),
		future: [...future, current].slice(-HISTORY_LIMIT),
	});
	applySnapshot(previous);
	return true;
}

/** Redo the last undone action. Returns false when there is nothing to redo. */
export function redo(): boolean {
	if (isReadOnly()) return false;
	finalize();
	const { past, future } = useHistory.getState();
	const next = future[future.length - 1];
	if (!next) return false;
	const current = captureScene();
	useHistory.setState({
		past: [...past, current].slice(-HISTORY_LIMIT),
		future: future.slice(0, -1),
	});
	applySnapshot(next);
	return true;
}

/**
 * Drop all history. Called when the scene document changes (boot, new, switch,
 * share preview enter/exit, save copy) so history can never span two scenes.
 * Any queued edit from the outgoing scene is discarded too.
 */
export function clearHistory(): void {
	pendingBefore = null;
	useHistory.setState({ past: [], future: [] });
}
