/**
 * A tiny non-React registry of canvas image load statuses (P2-01 self-heal).
 *
 * `useImage` reports each canvas image's status here, keyed by a **stable
 * identity** (the item/board uid — not the `src`, so duplicates and removals are
 * counted correctly), and clears it on unmount. `Stage` subscribes and mirrors a
 * summary onto its DOM node for Playwright — without re-rendering the stage (the
 * same pattern as the `data-hovered-item` debug hook). Keeping this out of React
 * state avoids re-rendering every layer when an image loads.
 */
export type ImageLoadStatus = "loading" | "loaded" | "failed";

const statuses = new Map<string, ImageLoadStatus>();
const listeners = new Set<() => void>();

function notify(): void {
	for (const listener of listeners) listener();
}

/** Record the load status for an image identified by `key`. */
export function reportImageStatus(key: string, status: ImageLoadStatus): void {
	if (statuses.get(key) === status) return;
	statuses.set(key, status);
	notify();
}

/** Drop an identity (its node unmounted) so it stops counting. */
export function clearImageStatus(key: string): void {
	if (statuses.delete(key)) notify();
}

/** Subscribe to status changes; returns an unsubscribe function. */
export function subscribeImageStatus(listener: () => void): () => void {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

/** A compact `"loaded:N failed:N"` summary for the `data-item-images` hook. */
export function imageStatusSummary(): string {
	let loaded = 0;
	let failed = 0;
	for (const status of statuses.values()) {
		if (status === "loaded") loaded++;
		else if (status === "failed") failed++;
	}
	return `loaded:${loaded} failed:${failed}`;
}
