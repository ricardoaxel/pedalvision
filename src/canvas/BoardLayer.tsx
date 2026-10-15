import type Konva from "konva";
import { useCallback, useRef } from "react";
import { Layer, Transformer } from "react-konva";
import { pxToCm } from "../lib/geometry";
import { useScene } from "../state/scene";
import { useSelection } from "../state/selection";
import type { CanvasTheme } from "../styles/theme";
import { BoardNode } from "./BoardNode";

interface BoardLayerProps {
	theme: CanvasTheme;
}

/**
 * The board layer (design.md §Canvas architecture): one Group per board, plus a
 * Transformer attached to the selected board. Boards stack by array order —
 * later-placed boards render on top (S6; user reordering is v2).
 *
 * The Transformer only exposes the rotate handle for now (no resize anchors):
 * board footprints come from the catalog and aren't resizable. Any-angle
 * rotation is the point (design.md → free rotation); polished touch anchors +
 * on-selection action buttons are P1-05.
 */
export function BoardLayer({ theme }: BoardLayerProps) {
	const boards = useScene((state) => state.boards);
	const selectedUid = useSelection((state) => state.selectedBoardUid);
	const moveBoard = useScene((state) => state.moveBoard);
	const rotateBoard = useScene((state) => state.rotateBoard);

	const transformerRef = useRef<Konva.Transformer>(null);
	const nodesRef = useRef(new Map<string, Konva.Group>());

	const registerNode = useCallback((uid: string, node: Konva.Group | null) => {
		if (node) nodesRef.current.set(uid, node);
		else nodesRef.current.delete(uid);
	}, []);

	// Attach the Transformer declaratively to the selected board's node. No
	// imperative `nodes()` call per render: only the selected uid + the boards
	// list (for removal) drive it, so dragging doesn't re-bind anchors per frame.
	const selectedBoard = boards.find((board) => board.uid === selectedUid);
	const selectedNode = selectedBoard
		? nodesRef.current.get(selectedBoard.uid)
		: undefined;

	// A single transform gesture writes both rotation and any origin shift
	// (rotating about the node centre moves the top-left origin).
	const handleTransformEnd = useCallback(() => {
		const node = transformerRef.current?.nodes()[0];
		if (!node || !selectedUid) return;
		rotateBoard(selectedUid, node.rotation());
		moveBoard(selectedUid, pxToCm(node.x()), pxToCm(node.y()));
	}, [selectedUid, moveBoard, rotateBoard]);

	return (
		<Layer>
			{boards.map((board) => (
				<BoardNode
					key={board.uid}
					board={board}
					theme={theme}
					registerNode={registerNode}
				/>
			))}
			<Transformer
				ref={transformerRef}
				nodes={selectedNode ? [selectedNode] : []}
				enabledAnchors={[]}
				rotateEnabled
				onTransformEnd={handleTransformEnd}
				borderStroke={theme.selectionStrong}
				borderStrokeWidth={1.5}
				anchorStroke={theme.selectionStrong}
				anchorFill={theme.canvasBackground}
				anchorSize={9}
				rotateAnchorOffset={28}
				ignoreStroke
			/>
		</Layer>
	);
}
