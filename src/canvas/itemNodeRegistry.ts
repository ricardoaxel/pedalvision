import type Konva from "konva";

/**
 * A single registry of every placed item's Konva node, keyed by uid, so the
 * one top-level rotate Transformer (design.md → SelectionLayer) can attach to
 * a pedal regardless of which container renders it (a board group or the loose
 * layer). The transformer lives in its own world-space layer rather than inside
 * the board group: Konva positions a Transformer in absolute coordinates, and
 * nesting it inside a group makes its anchors unhittable under the group's own
 * event handling. `_fitNodesInto` still decomposes the parent transform, so a
 * pedal on a rotated board still stores its rotation relative to the pedal
 * (B2 requirement) with the board transform untouched.
 *
 * A tiny subscribe/notify keeps the transformer attached across the node
 * unmount/remount that a cross-board drop causes (same uid, new node).
 */
const nodes = new Map<string, Konva.Group>();
const listeners = new Set<() => void>();

/** Register an item node. Notifies subscribers on any change. */
export function registerItemNode(uid: string, node: Konva.Group): void {
	nodes.set(uid, node);
	for (const listener of listeners) listener();
}

/**
 * Remove an item node — but only if it is still the registered one. Guards the
 * cross-board-drop remount, where the old node's cleanup can run after the new
 * node (same uid) has already registered.
 */
export function unregisterItemNode(uid: string, node: Konva.Group): void {
	if (nodes.get(uid) !== node) return;
	nodes.delete(uid);
	for (const listener of listeners) listener();
}

/** The Konva node for an item, or null if it isn't mounted. */
export function getItemNode(uid: string): Konva.Group | null {
	return nodes.get(uid) ?? null;
}

/** Subscribe to node registration changes (returns an unsubscribe fn). */
export function subscribeItemNodes(listener: () => void): () => void {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}
