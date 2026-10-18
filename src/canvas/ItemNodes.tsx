import type { Point } from "../lib/geometry";
import { itemFootprint, type PlacedItem, useScene } from "../state/scene";
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
	/**
	 * Overrides the rendered rotation (degrees). Used by the DragLayer to render
	 * the lifted item with its composed board+own rotation, so picking a pedal
	 * off a rotated board doesn't snap it back to the canvas frame.
	 */
	rotationDeg?: number;
	/** Lift shadow + unskewed rendering cue (DragLayer only). */
	lifted?: boolean;
}

/**
 * A set of pedal/supply nodes plus the selected item's halo, shared by the
 * loose-items layer and the transient DragLayer (board-attached pedals render
 * through BoardNode instead). The halo is a sibling in the same container, so
 * it shares the item's coordinate frame; the rotate Transformer is top-level
 * (SelectionLayer) and attaches to the node via the global registry.
 */
export function ItemNodes({
	items,
	theme,
	selectedItemUid,
	worldPosition,
	rotationDeg,
	lifted = false,
}: ItemNodesProps) {
	const customPedals = useScene((state) => state.customPedals);
	const selectedItem = selectedItemUid
		? items.find((item) => item.uid === selectedItemUid)
		: undefined;

	return (
		<>
			{items.map((item) => (
				<PedalNode
					key={item.uid}
					item={item}
					theme={theme}
					xCm={worldPosition ? worldPosition.x : item.x}
					yCm={worldPosition ? worldPosition.y : item.y}
					rotationDeg={rotationDeg}
					lifted={lifted}
				/>
			))}
			{selectedItem ? (
				<SelectionOutline
					xCm={worldPosition ? worldPosition.x : selectedItem.x}
					yCm={worldPosition ? worldPosition.y : selectedItem.y}
					widthCm={itemFootprint(selectedItem, customPedals).widthCm}
					heightCm={itemFootprint(selectedItem, customPedals).heightCm}
					rotationDeg={rotationDeg ?? selectedItem.rotationDeg}
					theme={theme}
				/>
			) : null}
		</>
	);
}
