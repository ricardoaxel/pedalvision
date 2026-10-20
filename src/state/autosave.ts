/**
 * Debounced autosave (~500 ms) with an explicit flush. Injectable timers keep
 * the debounce unit-testable with fake timers. A save failure is swallowed
 * here: the scene stays in memory and P3-05 owns the user-facing warning.
 */
export interface AutosaveTimers {
	set: (callback: () => void, delayMs: number) => unknown;
	clear: (handle: unknown) => void;
}

const DEFAULT_TIMERS: AutosaveTimers = {
	set: (callback, delayMs) => setTimeout(callback, delayMs),
	clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export interface Autosave {
	/** Mark the scene dirty and (re)start the debounce timer. */
	schedule: () => void;
	/** Write immediately (no-op when clean); awaits an in-flight write. */
	flush: () => Promise<void>;
	/** Drop pending work without writing. */
	cancel: () => void;
	pending: () => boolean;
}

export const AUTOSAVE_DELAY_MS = 500;

/**
 * Create a debounced saver. `save` is called at most once per quiet window and
 * again when changes land while a write is in flight.
 */
export function createAutosave(
	save: () => void | Promise<void>,
	options: { delayMs?: number; timers?: AutosaveTimers } = {},
): Autosave {
	const delayMs = options.delayMs ?? AUTOSAVE_DELAY_MS;
	const timers = options.timers ?? DEFAULT_TIMERS;
	let handle: unknown = null;
	let dirty = false;
	let running: Promise<void> | null = null;

	const drain = async (): Promise<void> => {
		if (running) await running;
		while (dirty) {
			dirty = false;
			const write = Promise.resolve()
				.then(save)
				.catch(() => {
					// Keep the scene in memory; storage recovery is P3-05.
				});
			running = write;
			await write;
			running = null;
		}
	};

	const clearTimer = () => {
		if (handle !== null) {
			timers.clear(handle);
			handle = null;
		}
	};

	return {
		schedule: () => {
			dirty = true;
			clearTimer();
			handle = timers.set(() => {
				handle = null;
				void drain();
			}, delayMs);
		},
		flush: async () => {
			clearTimer();
			await drain();
		},
		cancel: () => {
			clearTimer();
			dirty = false;
		},
		pending: () => dirty || handle !== null || running !== null,
	};
}
