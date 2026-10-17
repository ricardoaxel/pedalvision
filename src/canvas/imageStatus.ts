/**
 * A tiny non-React registry of canvas image load statuses (P2-01 self-heal).
 *
 * `useImage` reports each canvas `<img>` load's status here; `Stage` subscribes
 * and mirrors a summary onto its DOM node for Playwright (without re-rendering
 * the stage — the same pattern as the `data-hovered-item` debug hook). Keeping
 * this out of React state avoids re-rendering every layer when an image loads.
 */
export type ImageLoadStatus = "loading" | "loaded" | "failed";

const statuses = new Map<string, ImageLoadStatus>();
const listeners = new Set<() => void>();

/** Record the load status for a canvas image `src`. */
export function reportImageStatus(src: string, status: ImageLoadStatus): void {
	if (statuses.get(src) === status) return;
	statuses.set(src, status);
	for (const listener of listeners) listener();
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
