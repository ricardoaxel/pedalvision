import { catalog } from "../catalog/load";
import { useScene } from "../state/scene";
import { selectSelectedBoardUid, useSelection } from "../state/selection";
import { useViewport, viewportCenterCm } from "../state/viewport";

/**
 * Temporary HTML board picker (P1-03): a plain list of catalog boards that
 * drops the chosen board at the viewport centre. The real searchable/filterable
 * picker modal is P2-01 — this exists only so boards can be placed on the
 * canvas now.
 */
export function BoardPicker() {
	const addBoard = useScene((state) => state.addBoard);
	const removeBoard = useScene((state) => state.removeBoard);
	const selectedBoardUid = useSelection(selectSelectedBoardUid);
	const selectBoard = useSelection((state) => state.selectBoard);

	const handleAdd = (boardRefId: string) => {
		const { scale, x, y, size } = useViewport.getState();
		const uid = addBoard(boardRefId, viewportCenterCm(size, { scale, x, y }));
		// Select the new board so the pedal picker's target is unambiguous.
		selectBoard(uid);
	};

	return (
		<aside
			className="board-picker"
			data-testid="board-picker"
			aria-label="Board picker"
		>
			<h2 className="board-picker__title">Boards</h2>
			<ul className="board-picker__list">
				{catalog.boards.map((board) => (
					<li key={board.id}>
						<button
							type="button"
							className="board-picker__item"
							data-testid={`add-board-${board.id}`}
							onClick={() => handleAdd(board.id)}
						>
							<span className="board-picker__name">
								{board.brand} {board.name}
							</span>
							<span className="board-picker__dims">
								{board.widthCm} × {board.heightCm} cm
							</span>
						</button>
					</li>
				))}
			</ul>
			{selectedBoardUid ? (
				<button
					type="button"
					className="board-picker__remove"
					data-testid="remove-board"
					onClick={() => {
						removeBoard(selectedBoardUid);
						selectBoard(null);
					}}
				>
					Remove selected board
				</button>
			) : null}
		</aside>
	);
}
