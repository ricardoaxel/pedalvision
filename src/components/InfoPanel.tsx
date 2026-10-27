import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { resolveMasterImageUrl, resolveThumbImageUrl } from "../lib/cdn";
import {
	buildPartInfo,
	formatDimensions,
	formatJack,
	formatPower,
} from "../lib/partInfo";
import { useDrag } from "../state/drag";
import { spaceWarning } from "../state/overlap";
import { usePanelMetrics } from "../state/panel";
import {
	resolveItem,
	resolveItemJacks,
	useScene,
	usesFallbackJacks,
} from "../state/scene";
import { selectSelectedItemUid, useSelection } from "../state/selection";
import { useSettings } from "../state/settings";
import { ChevronIcon, PedalIcon, WarningIcon } from "./icons";
import { PartDrawing } from "./PartDrawing";
import { usePartImage } from "./partImage";
import { effectLabel } from "./pickerFilter";

// Mirrors the `max-width: 1023px` mobile block in index.css.
const MOBILE_MEDIA = "(max-width: 1023px)";

/**
 * Mobile only reveals the banner when the sheet is expanded; desktop always
 * shows it. Knowing which surface is visible lets us render only that
 * rendition's `<img>` — a hidden image would still be fetched and would defeat
 * the 350 sleeve / 800 banner split.
 */
function useIsMobile(): boolean {
	const [isMobile, setIsMobile] = useState(
		() =>
			typeof window === "undefined" || window.matchMedia(MOBILE_MEDIA).matches,
	);
	useEffect(() => {
		const query = window.matchMedia(MOBILE_MEDIA);
		const update = () => setIsMobile(query.matches);
		update();
		query.addEventListener("change", update);
		return () => query.removeEventListener("change", update);
	}, []);
	return isMobile;
}

/**
 * The pedal info panel (P2-03). Direction: **"Specimen Readout"** (owner-approved
 * 2026-10-18), extended by **"Specimen Cover"** — the specimen is the anchor: a
 * sleeve in the mobile peek, a full-bleed banner when open, with the measurement
 * riding it as a museum label. It is the HTML mirror of the canvas selection
 * (design.md §Accessibility).
 *
 * Desktop (≥1024px) = a trailing **push** rail; mobile (<1024px) = a compact
 * bottom sheet — a constant-height **cover row** peek (64px sleeve + identity +
 * actions + a dimensions/warning status row) that expands to a **hero banner** +
 * measure row + readout sections. Power/jacks render **only when present** (the
 * seed has no power/jacks for catalog pedals; that backfill is P5-01).
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

	// App-wide display units (P3-02) — persisted with the scene index; storage
	// is always cm.
	const units = useSettings((state) => state.units);
	const setUnits = useSettings((state) => state.setUnits);
	// Mobile expand state, scoped to the selected uid so a new selection opens
	// collapsed (no reset effect needed).
	const [expandedUid, setExpandedUid] = useState<string | null>(null);
	const expanded = selectedItemUid !== null && expandedUid === selectedItemUid;
	const isMobile = useIsMobile();
	const toggleExpanded = () =>
		setExpandedUid(expanded ? null : selectedItemUid);

	const item = selectedItemUid
		? items.find((candidate) => candidate.uid === selectedItemUid)
		: undefined;
	const resolved = item ? resolveItem(item, customPedals) : null;
	// Two renditions, two elements: the mobile 64px sleeve is a true thumbnail
	// (350), while the expanded banner / desktop plate uses the 800 master. A
	// `url` source resolves to the same absolute URL for both (no derived
	// rendition exists), and both run the shared CORS-first ladder.
	const imageSrc = resolved?.definition
		? resolveMasterImageUrl(
				resolved.definition.imageSource,
				resolved.definition.image,
				"pedal",
			)
		: null;
	const sleeveSrc = resolved?.definition
		? resolveThumbImageUrl(
				resolved.definition.imageSource,
				resolved.definition.image,
				"pedal",
				"infoSleeve",
			)
		: null;
	// The CORS-first → cache-bust → no-CORS → failed ladder, shared with the
	// picker (so a hotlinked `url` never re-poisons the canvas image cache).
	const preview = usePartImage(imageSrc ?? "");
	const sleevePreview = usePartImage(sleeveSrc ?? "");
	// A `url` source has no derived rendition, so both resolve to the same URL:
	// drive the sleeve from the master state so it shares ONE ladder (no second
	// CORS probe on expand). If a static/mock 350 is missing, fall back to the
	// master instead of dropping the image.
	const thumbPreview = sleeveSrc === imageSrc ? preview : sleevePreview;
	const sleeveState = thumbPreview.phase === "failed" ? preview : thumbPreview;

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

	const jacks = resolveItemJacks(item, customPedals);
	const info = buildPartInfo(
		resolved,
		item.kind,
		jacks,
		usesFallbackJacks(item, customPedals),
		jacks.some((jack) => jack.approximate === true),
	);

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
	if (warning.tight.length === 1) {
		warningLines.push(`Tight for a patch cable near ${warning.tight[0]}.`);
	} else if (warning.tight.length > 1) {
		warningLines.push(
			`Tight for a patch cable near ${warning.tight.length} items.`,
		);
	}
	if (warning.outOfBounds) warningLines.push("Extends beyond the board.");
	// The peek shows a compact chip; the expanded band shows the full sentence.
	const warningChip =
		warning.overlaps.length > 0
			? "Overlap"
			: warning.tight.length > 0
				? "Cable gap"
				: "Off board";

	const dimensions = formatDimensions(info.widthCm, info.heightCm, units);
	// The peek identity collapses to one name line + a `brand · category` subline.
	const subline = [
		info.brand,
		info.category === "supply" ? "Supply" : "Pedal",
		...(info.isCustom ? ["Custom"] : []),
	]
		.filter(Boolean)
		.join(" · ");

	// The cover: photo (catalog) / drawing (custom) / glyph (unknown or a failed
	// image). The category drives the caption. Only the visible surface mounts
	// its `<img>`: desktop (banner) or mobile-expanded gets the 800 master;
	// the mobile peek gets the 350 sleeve.
	const hasImage = info.image !== null;
	const showMasterImage = hasImage && preview.phase !== "failed";
	const showBannerImage = !isMobile || expanded;
	const showSleeveImage = isMobile && !expanded;
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
	const cover = info.isCustom ? (
		<PartDrawing
			widthCm={info.widthCm}
			depthCm={info.heightCm}
			jacks={info.jacks}
			units={units}
		/>
	) : showMasterImage ? (
		showBannerImage ? (
			<img
				key={`${imageSrc}:${preview.phase}`}
				className="info-panel__cover-img"
				src={preview.url}
				alt=""
				loading="lazy"
				crossOrigin={preview.crossOrigin}
				onError={preview.onError}
			/>
		) : null
	) : (
		<span
			className={`info-panel__cover-glyph${
				info.unknown ? " info-panel__cover-glyph--dashed" : ""
			}`}
			aria-hidden="true"
		>
			{glyph}
		</span>
	);

	// The mobile-collapsed sleeve: image when available, else the glyph (a
	// drawing is illegible at 64px). Only the visible surface mounts its img
	// (the collapsed banner is not rendered), so the sleeve's ladder is the
	// only one active in the peek — it still advances on failure.
	const sleeve =
		showSleeveImage && hasImage && sleeveState.phase !== "failed" ? (
			<img
				key={`sleeve:${sleeveState.url}:${sleeveState.phase}`}
				className="info-panel__sleeve-img"
				src={sleeveState.url}
				alt=""
				loading="lazy"
				crossOrigin={sleeveState.crossOrigin}
				onError={sleeveState.onError}
			/>
		) : (
			<PedalIcon size={24} strokeWidth={1.5} />
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
					className="info-panel__sleeve"
					data-testid="info-cover"
					aria-hidden="true"
				>
					{sleeve}
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
					<span className="info-panel__subline">{subline}</span>
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

			{/* Mobile peek status row: dimensions + the compact warning chip. */}
			<div className="info-panel__status">
				<span className="info-panel__dims" data-testid="info-peek-dims">
					{dimensions}
				</span>
				{warning.any ? (
					<span
						className="info-panel__warning-chip"
						data-testid="info-warning-chip"
						role="status"
						aria-live="polite"
						aria-label={warningLines.join(" ")}
					>
						{warningChip}
					</span>
				) : null}
			</div>

			{/* The hero cover banner. */}
			<div
				className="info-panel__banner"
				data-testid="info-preview"
				data-preview={previewKind}
			>
				{cover}
				<span className="info-panel__banner-caption">{caption}</span>
			</div>

			{/* Measure row: dimensions + the cm/in toggle (desktop always; mobile
			 * when the sheet is expanded). */}
			<div className="info-panel__measure">
				<span className="info-panel__dims" data-testid="info-dims">
					{dimensions}
				</span>
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
						{info.jacksAssumed ? (
							<p className="info-panel__assumed">Jack positions assumed.</p>
						) : info.jacksApproximate ? (
							<p className="info-panel__assumed">
								Some jack positions are approximate.
							</p>
						) : null}
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

				<p className="info-panel__legal" data-testid="info-legal">
					{info.brand.trim()
						? `Pedalvision is an independent planner and is not affiliated with or endorsed by ${info.brand}. `
						: "Pedalvision is an independent planner. "}
					<a href="/attribution.html" target="_blank" rel="noreferrer">
						Image credits &amp; removal
					</a>
				</p>
			</div>
		</aside>
	);
}
