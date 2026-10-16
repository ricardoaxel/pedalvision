import { Layer } from "react-konva";
import { useDrag } from "../state/drag";
import { useScene } from "../state/scene";
import { selectSelectedItemUid, useSelection } from "../state/selection";
import type { CanvasTheme } from "../styles/theme";
import { ItemNodes } from "./ItemNodes";

interface DragLayerProps {
	theme: CanvasTheme;
}

/**
 * The transient world-space drag layer (design.md §Canvas architecture, N2).
 * While a pedal is lifted during a cross-board drag it renders here at its live
 * world-cm origin, unskewed (no board rotation inherited) and above the boards.
 * Its Transformer travels with it. On drop the item is re-parented and this
 * layer empties — the node reappears in its destination container.
 */
export function DragLayer({ theme }: DragLayerProps) {
	const liftedUid = useDrag((state) => state.liftedUid);
	const liftedWorldCm = useDrag((state) => state.liftedWorldCm);
	const items = useScene((state) => state.items);
	const selectedItemUid = useSelection(selectSelectedItemUid);

	const item = liftedUid
		? items.find((candidate) => candidate.uid === liftedUid)
		: undefined;

	return (
		<Layer>
			{item && liftedWorldCm ? (
				<ItemNodes
					items={[item]}
					theme={theme}
					selectedItemUid={selectedItemUid}
					worldPosition={liftedWorldCm}
					lifted
				/>
			) : null}
		</Layer>
	);
}
