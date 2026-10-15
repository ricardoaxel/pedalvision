import type Konva from "konva";
import type { RefObject } from "react";
import { useCallback, useEffect, useRef } from "react";
import type { PlacedItem } from "../state/scene";

interface ItemSelection {
	/** Register a pedal node so the selected item's Transformer can attach. */
	registerNode: (uid: string, node: Konva.Group | null) => void;
	/** The selected item when it belongs to this container (else undefined). */
	selectedItem: PlacedItem | undefined;
	/** Attach to the `Transformer` node. */
	transformerRef: RefObject<Konva.Transformer | null>;
}

/**
 * The shared selectable-item machinery for a container of pedals: a node
 * registry + a Transformer ref that stays attached to whichever of the
 * container's items is selected. Used by both BoardNode (board-attached pedals)
 * and ItemNodes (loose / DragLayer), so the two can't drift (P1-04 code review).
 *
 * The node is registered by the child PedalNode effect, which runs before this
 * hook's effect, so a selection that already exists when the container mounts
 * still attaches.
 */
export function useItemSelection(
	selectedItemUid: string | null,
	items: PlacedItem[],
): ItemSelection {
	const nodesRef = useRef(new Map<string, Konva.Group>());
	const registerNode = useCallback((uid: string, node: Konva.Group | null) => {
		if (node) nodesRef.current.set(uid, node);
		else nodesRef.current.delete(uid);
	}, []);

	const selectedItem = selectedItemUid
		? items.find((item) => item.uid === selectedItemUid)
		: undefined;
	const selectedHere = selectedItem?.uid ?? null;

	const transformerRef = useRef<Konva.Transformer>(null);
	useEffect(() => {
		const transformer = transformerRef.current;
		if (!transformer) return;
		const node = selectedHere ? nodesRef.current.get(selectedHere) : undefined;
		transformer.nodes(node ? [node] : []);
	}, [selectedHere]);

	return { registerNode, selectedItem, transformerRef };
}
