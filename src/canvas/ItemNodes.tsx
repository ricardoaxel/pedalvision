import type Konva from "konva";
import { useCallback, useEffect, useRef } from "react";
import { Transformer } from "react-konva";
import type { Point } from "../lib/geometry";
import { itemFootprint, type PlacedItem } from "../state/scene";
import type { CanvasTheme } from "../styles/theme";
import { PedalNode } from "./PedalNode";
import { SelectionOutline } from "./SelectionOutline";

interface ItemNodesProps {
	items: PlacedItem[];
	theme: CanvasTheme;
	selectedItemUid: string | null;
	/**
	 * When set, every item renders at this world-cm origin instead of its stored
	 * position — used by the DragLayer for the single lifted item.
	 */
	worldPosition?: Point;
	/** Lift shadow + unskewed rendering cue (DragLayer only). */
	lifted?: boolean;
}

/**
 * A set of pedal/supply nodes plus a selection halo + Transformer for whichever
 * is selected. Shared by the loose-items layer and the transient DragLayer
 * (board-attached pedals render through BoardNode instead). The Outline and
 * Transformer are siblings in the same container, so they share the item's
 * coordinate frame.
 */
export function ItemNodes({
	items,
	theme,
	selectedItemUid,
	worldPosition,
	lifted = false,
}: ItemNodesProps) {
	const nodesRef = useRef(new Map<string, Konva.Group>());
	const registerNode = useCallback((uid: string, node: Konva.Group | null) => {
		if (node) nodesRef.current.set(uid, node);
		else nodesRef.current.delete(uid);
	}, []);

	const selected = selectedItemUid
		? items.find((item) => item.uid === selectedItemUid)
		: undefined;
	const selectedHere = selected?.uid ?? null;
	const transformerRef = useRef<Konva.Transformer>(null);
	useEffect(() => {
		const transformer = transformerRef.current;
		if (!transformer) return;
		const node = selectedHere ? nodesRef.current.get(selectedHere) : undefined;
		transformer.nodes(node ? [node] : []);
	}, [selectedHere]);

	return (
		<>
			{items.map((item) => (
				<PedalNode
					key={item.uid}
					item={item}
					theme={theme}
					xCm={worldPosition ? worldPosition.x : item.x}
					yCm={worldPosition ? worldPosition.y : item.y}
					lifted={lifted}
					registerNode={registerNode}
				/>
			))}
			{selected ? (
				<SelectionOutline
					xCm={worldPosition ? worldPosition.x : selected.x}
					yCm={worldPosition ? worldPosition.y : selected.y}
					widthCm={itemFootprint(selected).widthCm}
					heightCm={itemFootprint(selected).heightCm}
					theme={theme}
				/>
			) : null}
			{selectedHere ? (
				<Transformer
					ref={transformerRef}
					enabledAnchors={[]}
					rotateEnabled={false}
					resizeEnabled={false}
					listening={false}
					borderStroke={theme.selectionStrong}
					borderStrokeWidth={1.5}
					ignoreStroke
				/>
			) : null}
		</>
	);
}
