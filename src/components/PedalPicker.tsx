import { catalog } from "../catalog/load";
import { boardFootprint, useScene } from "../state/scene";
import { useSelection } from "../state/selection";
import { useViewport, viewportCenterCm } from "../state/viewport";

/**
 * Temporary HTML pedal picker (P1-04): a plain list of catalog pedals that adds
 * the chosen pedal to the selected board's centre (or loose at the viewport
 * centre if no board exists), plus duplicate/delete for the selected pedal. The
 * real searchable/filterable picker modal is P2-01 — this exists only so pedals
 * can be placed, duplicated and deleted now.
 */
export function PedalPicker() {
	const boards = useScene((state) => state.boards);
	const addItem = useScene((state) => state.addItem);
	const duplicateItem = useScene((state) => state.duplicateItem);
	const removeItem = useScene((state) => state.removeItem);
	const selectedBoardUid = useSelection((state) => state.selectedBoardUid);
	const selectedItemUid = useSelection((state) => state.selectedItemUid);
	const selectItem = useSelection((state) => state.selectItem);

	const pedals = catalog.pedals.filter((pedal) => pedal.category === "pedal");
	const targetBoard =
		boards.find((board) => board.uid === selectedBoardUid) ?? boards[0] ?? null;

	const handleAdd = (refId: string) => {
		const pedal = catalog.pedals.find((candidate) => candidate.id === refId);
		if (!pedal) return;
		if (targetBoard) {
			const footprint = boardFootprint(targetBoard);
			const uid = addItem(refId, "pedal", targetBoard.uid, {
				x: footprint.widthCm / 2 - pedal.widthCm / 2,
				y: footprint.heightCm / 2 - pedal.heightCm / 2,
			});
			selectItem(uid);
			return;
		}
		const { scale, x, y, size } = useViewport.getState();
		const center = viewportCenterCm(size, { scale, x, y });
		const uid = addItem(refId, "pedal", null, {
			x: center.x - pedal.widthCm / 2,
			y: center.y - pedal.heightCm / 2,
		});
		selectItem(uid);
	};

	return (
		<aside
			className="pedal-picker"
			data-testid="pedal-picker"
			aria-label="Pedal picker"
		>
			<h2 className="pedal-picker__title">Pedals</h2>
			<p className="pedal-picker__hint">
				{targetBoard
					? `Add to ${targetBoard.boardRefId ?? "board"}`
					: "No board — added loose"}
			</p>
			<ul className="pedal-picker__list">
				{pedals.map((pedal) => (
					<li key={pedal.id}>
						<button
							type="button"
							className="pedal-picker__item"
							data-testid={`add-pedal-${pedal.id}`}
							onClick={() => handleAdd(pedal.id)}
						>
							{pedal.brand} {pedal.name}
						</button>
					</li>
				))}
			</ul>
			{/* Row is always rendered so selecting a pedal doesn't shift the panel;
			 * the buttons disable without a selection. */}
			<div className="pedal-picker__actions">
				<button
					type="button"
					className="pedal-picker__action"
					data-testid="duplicate-pedal"
					disabled={!selectedItemUid}
					onClick={() => {
						if (!selectedItemUid) return;
						const uid = duplicateItem(selectedItemUid);
						if (uid) selectItem(uid);
					}}
				>
					Duplicate
				</button>
				<button
					type="button"
					className="pedal-picker__action pedal-picker__action--danger"
					data-testid="delete-pedal"
					disabled={!selectedItemUid}
					onClick={() => {
						if (!selectedItemUid) return;
						removeItem(selectedItemUid);
						selectItem(null);
					}}
				>
					Delete
				</button>
			</div>
		</aside>
	);
}
