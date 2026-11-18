import { buildBoardReadout } from "../lib/boardInfo";
import { resolveMasterImageUrl } from "../lib/cdn";
import { formatDimensions } from "../lib/partInfo";
import { useIsMobile } from "../lib/useMobile";
import { boardDefinition, boardFootprint, useScene } from "../state/scene";
import { selectSelectedBoardUid, useSelection } from "../state/selection";
import { useSettings } from "../state/settings";
import { BoardCartoucheContent } from "./BoardCartouche";
import { BoardIcon, CloseIcon } from "./icons";
import { usePartImage } from "./partImage";

/**
 * F-06 "Title Block" — the selected board's readout. Desktop reuses the pedal
 * info rail's push slot so selection kinds swap content in place. Mobile renders
 * a one-row identity strip from `BoardCartouche` (inside the board action bar)
 * instead; this component returns null there.
 */
export function BoardInfoPanel({ boardUid }: { boardUid?: string | null }) {
	const selectedBoardUid = useSelection(selectSelectedBoardUid);
	const activeUid = boardUid ?? selectedBoardUid;
	const boards = useScene((state) => state.boards);
	const clearSelection = useSelection((state) => state.clearSelection);
	const units = useSettings((state) => state.units);
	const setUnits = useSettings((state) => state.setUnits);
	const isMobile = useIsMobile();

	const board = activeUid
		? boards.find((candidate) => candidate.uid === activeUid)
		: undefined;
	const definition = board ? boardDefinition(board) : null;
	const readout = board
		? buildBoardReadout(board, definition, boardFootprint(board))
		: null;
	const masterSrc =
		!isMobile && readout?.image != null
			? resolveMasterImageUrl(
					readout.image.source,
					readout.image.value,
					"board",
				)
			: "";
	const preview = usePartImage(masterSrc);

	if (!board || !readout) return null;

	const dimensions = formatDimensions(readout.widthCm, readout.heightCm, units);

	// Mobile (edit and read-only) docks the same passive strip in the bottom
	// chrome, independent of the floating board action bar. A read-only share
	// has no action bar at all; the scale strip is shifted up to make room.
	if (isMobile) {
		return (
			<div
				className="board-cartouche"
				data-testid="board-info-strip"
				data-board-kind={readout.kind}
				role="status"
				aria-live="polite"
			>
				<BoardCartoucheContent readout={readout} dimensions={dimensions} />
			</div>
		);
	}
	const showImage = readout.image !== null && preview.phase !== "failed";
	const kindShort = readout.kind === "catalog" ? "Catalog" : "Custom";
	const subline = [readout.brand, kindShort, readout.finish]
		.filter(Boolean)
		.join(" · ");

	return (
		<aside
			className="info-panel board-info"
			data-testid="board-info-panel"
			data-board-kind={readout.kind}
			aria-label="Selected board details"
			aria-labelledby="board-info-name"
		>
			<span className="visually-hidden" role="status" aria-live="polite">
				{`Board, ${[readout.brand, readout.name].filter(Boolean).join(" ")}, ${dimensions}`}
			</span>
			<header className="info-panel__header">
				<div className="info-panel__heading">
					<span className="info-panel__eyebrow">
						Board
						<span className="info-panel__tag" data-testid="board-info-kind">
							{kindShort}
						</span>
					</span>
					<h2 className="info-panel__name" id="board-info-name">
						{readout.name}
					</h2>
					{readout.brand ? (
						<span className="info-panel__brand" data-testid="board-info-brand">
							{readout.brand}
						</span>
					) : null}
					<span className="info-panel__subline">{subline}</span>
				</div>
				<div className="info-panel__header-actions">
					<button
						type="button"
						className="info-panel__icon-button"
						data-testid="board-info-close"
						aria-label="Clear selection"
						onClick={clearSelection}
					>
						<CloseIcon size={18} />
					</button>
				</div>
			</header>

			<div
				className="info-panel__banner board-info__plate"
				data-testid="board-info-plate"
			>
				{readout.texture ? (
					<span
						className={`board-info__finish finish-swatch__tile finish-swatch__tile--${readout.texture}`}
						aria-hidden="true"
						style={{ aspectRatio: `${readout.widthCm} / ${readout.heightCm}` }}
					/>
				) : showImage ? (
					<img
						key={`${masterSrc}:${preview.phase}`}
						className="info-panel__cover-img board-info__image"
						src={preview.url}
						alt=""
						loading="lazy"
						crossOrigin={preview.crossOrigin}
						onError={preview.onError}
					/>
				) : (
					<span className="info-panel__cover-glyph" aria-hidden="true">
						<BoardIcon size={40} strokeWidth={1.2} />
					</span>
				)}
				<span className="info-panel__banner-caption">
					{readout.texture ? "Finish" : "Plan"}
				</span>
			</div>

			<div className="info-panel__measure">
				<span className="info-panel__dims" data-testid="board-info-dims">
					{dimensions}
				</span>
				<fieldset
					className="segmented segmented--compact info-panel__units"
					data-testid="board-info-units"
				>
					<legend className="visually-hidden">Units</legend>
					{(["cm", "in"] as const).map((unit) => (
						<button
							key={unit}
							type="button"
							className="segmented__option"
							data-testid={`board-info-units-${unit}`}
							aria-pressed={units === unit}
							onClick={() => setUnits(unit)}
						>
							{unit}
						</button>
					))}
				</fieldset>
			</div>

			{readout.finish ? (
				<div className="info-panel__detail">
					<section className="info-panel__section">
						<dl className="info-panel__facts">
							<div className="info-panel__fact">
								<dt>Finish</dt>
								<dd data-testid="board-info-finish">{readout.finish}</dd>
							</div>
						</dl>
					</section>
				</div>
			) : null}

			<p className="info-panel__legal board-info__legal">
				{readout.brand
					? `Pedalvision is an independent planner and is not affiliated with or endorsed by ${readout.brand}. `
					: "Pedalvision is an independent planner. "}
				<a href="/docs" target="_blank" rel="noreferrer">
					Docs &amp; help
				</a>
			</p>
		</aside>
	);
}
