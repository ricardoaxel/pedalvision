/**
 * First-run empty-state guidance (P2-08 "Bench Note").
 *
 * Visibility is derived, not stored: the note shows while the scene is empty
 * and the user has not dismissed it. The only persisted bit is the one-way
 * dismissal, kept in localStorage alongside the temporary scene mirror
 * (`state/persist.ts`). Storage access is best-effort: a blocked/full store
 * must never break boot (site data off, private mode, extensions).
 */
import { resolveStorage } from "./storage";

export const FIRST_RUN_STORAGE_KEY = "pedalvision.firstRun.v1";

const DISMISSED = "dismissed";

/** True when the user has dismissed the note in this browser. */
export function isFirstRunDismissed(storage?: Storage | null): boolean {
	const target = resolveStorage(storage);
	if (!target) return false;
	try {
		return target.getItem(FIRST_RUN_STORAGE_KEY) === DISMISSED;
	} catch {
		return false;
	}
}

/** Remember the dismissal; failures are non-fatal (the note just returns). */
export function dismissFirstRun(storage?: Storage | null): void {
	const target = resolveStorage(storage);
	if (!target) return;
	try {
		target.setItem(FIRST_RUN_STORAGE_KEY, DISMISSED);
	} catch {
		// Ignore: first-run guidance is non-essential chrome.
	}
}

/**
 * The note is shown only while the canvas is genuinely empty. Placing the
 * first board or pedal retires it for that scene automatically; it returns
 * only if the user empties the scene again and has never dismissed it.
 */
export function shouldShowFirstRunHint(input: {
	boardCount: number;
	itemCount: number;
	dismissed: boolean;
}): boolean {
	return input.boardCount === 0 && input.itemCount === 0 && !input.dismissed;
}
