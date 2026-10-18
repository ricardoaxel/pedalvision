import { useLayoutEffect, useRef, useState } from "react";
import { resolveImageUrl } from "../lib/cdn";
import type { DisplayUnits } from "../lib/geometry";
import {
	buildPartInfo,
	formatDimensions,
	formatJack,
	formatPower,
} from "../lib/partInfo";
import { useDrag } from "../state/drag";
import { spaceWarning } from "../state/overlap";
import { usePanelMetrics } from "../state/panel";
import { resolveItem, useScene } from "../state/scene";
import { selectSelectedItemUid, useSelection } from "../state/selection";
import { ChevronIcon, PedalIcon, WarningIcon } from "./icons";
import { PartDrawing } from "./PartDrawing";
import { usePartImage } from "./partImage";
import { effectLabel } from "./pickerFilter";

/**
 * The pedal info panel (P2-03, owner-approved "Specimen Readout" direction,
 * 2026-10-18). It is the HTML mirror of the canvas selection (design.md
 * §Accessibility), and it carries the **specimen itself**: a lit plate at the
 * top (photo = identity) with the measuring readout beneath — identity,
 * category, effect tags, dimensions (display-only cm/in toggle), and power/jacks
 * **only when present** (the seed has no power/jacks for catalog pedals; that
 * backfill is P5-01). It is also the home of the non-blocking **space warning**
 * (its first band).
 *
 * Desktop (≥1024px) is a trailing **push** rail; mobile (<1024px) is a compact
 * bottom sheet — collapsed shows identity + dimensions + the warning with a 48px
 * specimen thumb inline, expanded reveals the full plate + details.
 */
export function InfoPanel() {
	const selectedItemUid = useSelection(selectSelectedItemUid);
	const items = useScene((state) => state.items);
	const boards = useScene((state) => state.boards);
	const customPedals = useScene((state) => state.customPedals);
	const clearSelection = useSelection((state) => state.clearSelection);
	const liftedUid = useDrag((state) => state.liftedUid);
	const liftedWorldCm = useDrag((state) => state.liftedWorldCm);
	const liftedRotationDeg = useDrag((state) => state.liftedRotationDeg);

	// The cm/in toggle is display-only and local until `Settings.units` lands
	// (P3-02); storage stays cm.
	const [units, setUnits] = useState<DisplayUnits>("cm");
	// Mobile expand state, scoped to the selected uid so a new selection opens
	// collapsed (no reset effect needed).
	const [expandedUid, setExpandedUid] = useState<string | null>(null);
	const expanded = selectedItemUid !== null && expandedUid === selectedItemUid;
	const toggleExpanded = () =>
		setExpandedUid(expanded ? null : selectedItemUid);

	const item = selectedItemUid
		? items.find((candidate) => candidate.uid === selectedItemUid)
		: undefined;
	const resolved = item ? resolveItem(item, customPedals) : null;
	const imageSrc = resolved?.definition
		? resolveImageUrl(
				resolved.definition.imageSource,
				resolved.definition.image,
				"pedal",
				800,
			)
		: null;
	// The CORS-first → cache-bust → no-CORS → failed ladder, shared with the
	// picker (so a hotlinked `url` never re-poisons the canvas image cache).
	const preview = usePartImage(imageSrc ?? "");

	// Report the sheet's real rendered height so the action bar always clears it.
	const asideRef = useRef<HTMLElement>(null);
	const setSheetHeight = usePanelMetrics((state) => state.setSheetHeight);
	useLayoutEffect(() => {
		const element = asideRef.current;
		if (!item || !element) {
			setSheetHeight(0);
			return;
		}
		const update = () => setSheetHeight(element.offsetHeight);
		update();
		const observer = new ResizeObserver(update);
		observer.observe(element);
		return () => observer.disconnect();
	}, [item, setSheetHeight]);

	if (!item || !resolved) return null;

	const info = buildPartInfo(resolved, item.kind);

	// While this item is lifted, evaluate the warning where it floats (live
	// world origin + visible rotation) so the cue follows the drag.
	const live =
		liftedUid === item.uid && liftedWorldCm
			? {
					originCm: liftedWorldCm,
					rotationDeg: liftedRotationDeg ?? item.rotationDeg,
				}
			: undefined;
	const warning = spaceWarning(item, { items, boards, customPedals, live });
	const warningLines: string[] = [];
	if (warning.overlaps.length === 1) {
		warningLines.push(`Overlaps ${warning.overlaps[0]}.`);
	} else if (warning.overlaps.length > 1) {
		warningLines.push(`Overlaps ${warning.overlaps.length} items.`);
	}
	if (warning.outOfBounds) warningLines.push("Extends beyond the board.");

	// The specimen plate: photo (catalog) / drawing (custom) / glyph (unknown or
	// a failed image). The category drives the caption.
	const showImage = info.image !== null && preview.phase !== "failed";
	const caption = info.isCustom
		? "Drawing"
		: info.unknown
			? "Part"
			: "Specimen";
	const previewKind = info.isCustom
		? "custom"
		: info.unknown
			? "unknown"
			: "image";

	const glyph = <PedalIcon size={28} strokeWidth={1.5} />;
	const plate = info.isCustom ? (
		<PartDrawing
			widthCm={info.widthCm}
			depthCm={info.heightCm}
			jacks={info.jacks}
			units={units}
		/>
	) : showImage ? (
		<img
			key={`${imageSrc}:${preview.phase}`}
			className="info-panel__preview-img"
			src={preview.url}
			alt=""
			loading="lazy"
			crossOrigin={preview.crossOrigin}
			onError={preview.onError}
		/>
	) : (
		<span
			className={`info-panel__plate-glyph${
				info.unknown ? " info-panel__plate-glyph--dashed" : ""
			}`}
			aria-hidden="true"
		>
			{glyph}
		</span>
	);

	// The 48px header thumb (mobile collapsed, where the plate is hidden): image
	// when available, otherwise the glyph (a drawing is illegible at this size).
	const thumb = showImage ? (
		<img
			key={`thumb:${imageSrc}:${preview.phase}`}
			className="info-panel__thumb-img"
			src={preview.url}
			alt=""
			loading="lazy"
			crossOrigin={preview.crossOrigin}
		/>
	) : (
		<PedalIcon size={22} strokeWidth={1.5} />
	);

	return (
		<aside
			ref={asideRef}
			className="info-panel"
			data-testid="info-panel"
			data-expanded={expanded ? "true" : "false"}
			aria-label="Selected part details"
		>
			<header className="info-panel__header">
				<span
					className="info-panel__thumb"
					data-testid="info-thumb"
					aria-hidden="true"
				>
					{thumb}
				</span>
				<div className="info-panel__heading">
					<span className="info-panel__eyebrow">
						{info.category === "supply" ? "Power supply" : "Pedal"}
						{info.isCustom ? (
							<span className="info-panel__tag">Custom</span>
						) : null}
					</span>
					<h2 className="info-panel__name" data-testid="info-name">
						{info.name}
					</h2>
					{info.brand ? (
						<span className="info-panel__brand" data-testid="info-brand">
							{info.brand}
						</span>
					) : null}
				</div>
				<div className="info-panel__header-actions">
					<button
						type="button"
						className="info-panel__icon-button info-panel__expand"
						data-testid="info-expand"
						aria-expanded={expanded}
						aria-controls="info-panel-detail"
						aria-label={expanded ? "Collapse details" : "Expand details"}
						onClick={toggleExpanded}
					>
						<ChevronIcon />
					</button>
					<button
						type="button"
						className="info-panel__icon-button"
						data-testid="info-close"
						aria-label="Clear selection"
						onClick={clearSelection}
					>
						<svg
							width="18"
							height="18"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							aria-hidden="true"
						>
							<path d="M6 6l12 12M18 6L6 18" />
						</svg>
					</button>
				</div>
			</header>

			<div className="info-panel__preview" data-testid="info-preview">
				<span className="info-panel__preview-caption">{caption}</span>
				<div className="info-panel__plate" data-preview={previewKind}>
					{plate}
				</div>
			</div>

			{warning.any ? (
				<div
					className="info-panel__warning"
					data-testid="info-warning"
					data-warning="true"
					role="status"
					aria-live="polite"
				>
					<WarningIcon className="info-panel__warning-icon" />
					<span className="info-panel__warning-body">
						<span className="info-panel__warning-label">Space</span>
						<span className="info-panel__warning-text">
							{warningLines.map((line) => (
								<span key={line}>{line}</span>
							))}
						</span>
					</span>
				</div>
			) : null}

			<section className="info-panel__section">
				<div className="info-panel__section-head">
					<h3 className="info-panel__eyebrow">Dimensions</h3>
					<fieldset
						className="segmented segmented--compact info-panel__units"
						data-testid="info-units"
					>
						<legend className="visually-hidden">Units</legend>
						{(["cm", "in"] as const).map((unit) => (
							<button
								key={unit}
								type="button"
								className="segmented__option"
								data-testid={`info-units-${unit}`}
								aria-pressed={units === unit}
								onClick={() => setUnits(unit)}
							>
								{unit}
							</button>
						))}
					</fieldset>
				</div>
				<dl className="info-panel__facts">
					<div className="info-panel__fact">
						<dt>Size</dt>
						<dd className="info-panel__mono" data-testid="info-dims">
							{formatDimensions(info.widthCm, info.heightCm, units)}
						</dd>
					</div>
				</dl>
			</section>

			<div className="info-panel__detail" id="info-panel-detail">
				{info.effectTypes.length > 0 ? (
					<section className="info-panel__section" data-testid="info-effects">
						<div className="info-panel__section-head">
							<h3 className="info-panel__eyebrow">Effects</h3>
						</div>
						<ul className="info-panel__tags">
							{info.effectTypes.map((type) => (
								<li key={type} className="info-panel__tag-pill">
									{effectLabel(type)}
								</li>
							))}
						</ul>
					</section>
				) : null}

				{info.jacks.length > 0 ? (
					<section className="info-panel__section" data-testid="info-jacks">
						<div className="info-panel__section-head">
							<h3 className="info-panel__eyebrow">Jacks</h3>
							<span className="info-panel__count">{info.jacks.length}</span>
						</div>
						<dl className="info-panel__facts">
							{info.jacks.map((jack, index) => (
								<div
									// biome-ignore lint/suspicious/noArrayIndexKey: jacks are read-only rows (no reorder)
									key={`${jack.kind}-${jack.edge}-${jack.pos}-${index}`}
									className="info-panel__fact"
								>
									<dt className="visually-hidden">Jack {index + 1}</dt>
									<dd className="info-panel__mono">{formatJack(jack)}</dd>
								</div>
							))}
						</dl>
					</section>
				) : null}

				{info.power ? (
					<section className="info-panel__section" data-testid="info-power">
						<div className="info-panel__section-head">
							<h3 className="info-panel__eyebrow">Power</h3>
						</div>
						<dl className="info-panel__facts">
							<div className="info-panel__fact">
								<dt>Supply</dt>
								<dd className="info-panel__mono" data-testid="info-power-value">
									{formatPower(info.power)}
								</dd>
							</div>
						</dl>
					</section>
				) : null}
			</div>
		</aside>
	);
}
