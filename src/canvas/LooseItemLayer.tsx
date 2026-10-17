import { Layer } from "react-konva";
import { useDrag } from "../state/drag";
import { itemsByZ, useScene } from "../state/scene";
import { selectSelectedItemUid, useSelection } from "../state/selection";
import type { CanvasTheme } from "../styles/theme";
import { ItemNodes } from "./ItemNodes";

interface LooseItemLayerProps {
	theme: CanvasTheme;
}

/**
 * Items not attached to any board (design.md §Canvas architecture →
 * LooseItemLayer): power supplies and pedals dropped outside a board. Stored in
 * world cm, so they render straight from `item.x/y`. The lifted item is
 * excluded here — it lives in the DragLayer while dragging.
 */
export function LooseItemLayer({ theme }: LooseItemLayerProps) {
	const items = useScene((state) => state.items);
	const selectedItemUid = useSelection(selectSelectedItemUid);
	const liftedUid = useDrag((state) => state.liftedUid);
	const loose = itemsByZ(
		items.filter((item) => item.boardUid === null && item.uid !== liftedUid),
	);

	return (
		<Layer>
			<ItemNodes
				items={loose}
				theme={theme}
				selectedItemUid={selectedItemUid}
			/>
		</Layer>
	);
}
