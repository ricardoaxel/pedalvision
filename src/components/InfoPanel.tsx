import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { catalog } from "../catalog/load";
import type { EffectType } from "../catalog/schema";
import { resolveMasterImageUrl, resolveThumbImageUrl } from "../lib/cdn";
import { buildPartInfo, formatDimensions, formatPower } from "../lib/partInfo";
import { similarPedals } from "../lib/similarPedals";
import { useIsMobile } from "../lib/useMobile";
import { useDrag } from "../state/drag";
import {
	beginHistoryHold,
	endHistoryHold,
	isHistoryHoldActive,
} from "../state/history";
import { useJackProof } from "../state/jackProof";
import { spaceWarning } from "../state/overlap";
import { usePanelMetrics } from "../state/panel";
import { usePlannerCatalog } from "../state/plannerCatalog";
import { useReadOnly } from "../state/readOnly";
import {
	baseItemJacks,
	ITEM_LABEL_MAX_LENGTH,
	resolveItem,
	resolveItemJacks,
	useScene,
} from "../state/scene";
import { selectSelectedItemUid, useSelection } from "../state/selection";
import { useSettings } from "../state/settings";
import { ChevronIcon, PedalIcon, WarningIcon } from "./icons";
import { JackCorrections } from "./JackCorrections";
import { PartDrawing } from "./PartDrawing";
import { usePartImage } from "./partImage";
import { effectLabel } from "./pickerFilter";

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
export function InfoPanel({
	itemUid,
	onOpenSimilar,
}: {
	itemUid?: string | null;
	/** F-14: open the Pedals picker filtered to the selected pedal's types. */
	onOpenSimilar?: (effectTypes: EffectType[]) => void;
} = {}) {
	const selectedItemUid = useSelection(selectSelectedItemUid);
	// While the presence wrapper is exiting it passes the last selected uid, so
	// the panel can keep rendering the item after selection is cleared.
	const activeUid = itemUid ?? selectedItemUid;
	const items = useScene((state) => state.items);
	const boards = useScene((state) => state.boards);
	const plannerVersion = usePlannerCatalog((state) => state.version);
	const customPedals = useScene((state) => state.customPedals);
	const clearSelection = useSelection((state) => state.clearSelection);
	const liftedUid = useDrag((state) => state.liftedUid);
	const liftedWorldCm = useDrag((state) => state.liftedWorldCm);
	const liftedRotationDeg = useDrag((state) => state.liftedRotationDeg);
	const readOnly = useReadOnly((state) => state.readOnly);
	const setItemLabel = useScene((state) => state.setItemLabel);

	// App-wide display units (P3-02) — persisted with the scene index; storage
	// is always cm.
	const units = useSettings((state) => state.units);
	const setUnits = useSettings((state) => state.setUnits);
	// Mobile expand state, scoped to the selected uid so a new selection opens
	// collapsed (no reset effect needed).
	const [expandedUid, setExpandedUid] = useState<string | null>(null);
	const expanded = activeUid !== null && expandedUid === activeUid;
	const isCurrentSelection =
		activeUid !== null && activeUid === selectedItemUid;
	const isMobile = useIsMobile();
	const proofActive = useJackProof((state) => state.activeUid !== null);
	const toggleExpanded = () => setExpandedUid(expanded ? null : activeUid);

	const item = activeUid
		? items.find((candidate) => candidate.uid === activeUid)
		: undefined;
	const resolved = item ? resolveItem(item, customPedals) : null;

	// F-12 "Bench Notation": the label field streams into the store live, but a
	// history hold coalesces the whole edit into one undo step. The draft keeps
	// the raw text (so a trailing space is typeable) while the store keeps the
	// normalised value.
	const [labelEditing, setLabelEditing] = useState(false);
	const [labelDraft, setLabelDraft] = useState<string | null>(null);
	const labelHold = useRef(false);
	// A new selection never carries the previous item's draft/hold.
	// biome-ignore lint/correctness/useExhaustiveDependencies: reset on uid only
	useEffect(() => {
		setLabelEditing(false);
		setLabelDraft(null);
		if (labelHold.current) {
			endHistoryHold();
			labelHold.current = false;
		}
	}, [item?.uid]);
	// Reflect an external change (undo/redo, share load) unless the field is
	// actively being edited.
	useEffect(() => {
		if (!labelEditing) setLabelDraft(item?.label ?? "");
	}, [item?.label, labelEditing]);
	// Never leak an open history hold if the panel unmounts mid-edit.
	useEffect(
		() => () => {
			if (labelHold.current) endHistoryHold();
		},
		[],
	);

	const labelValue = labelDraft ?? item?.label ?? "";
	// undo/redo/clearHistory can drain the global hold mid-edit; start a fresh
	// one so the remaining stream still coalesces into one step (F-16 lesson).
	const ensureLabelHold = () => {
		if (labelHold.current && !isHistoryHoldActive()) {
			labelHold.current = false;
		}
		if (!labelHold.current) {
			beginHistoryHold();
			labelHold.current = true;
		}
	};
	const beginLabelEdit = () => {
		if (readOnly || !item) return;
		setLabelEditing(true);
		setLabelDraft(item.label ?? "");
		ensureLabelHold();
	};
	const commitLabelEdit = () => {
		if (!item) return;
		// A hold drained by undo must not re-apply the streamed draft against the
		// reverted store.
		const hadHold = labelHold.current;
		const drained = hadHold && !isHistoryHoldActive();
		labelHold.current = false;
		if (!drained) {
			setItemLabel(item.uid, labelDraft ?? "");
			if (hadHold) endHistoryHold();
		}
		setLabelEditing(false);
		setLabelDraft(null);
	};
	const clearLabel = () => {
		if (!item) return;
		setLabelDraft("");
		setItemLabel(item.uid, null);
	};
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
		// During the exit the cached item is still rendered for the motion, but the
		// F-04 safe rect must consider the sheet gone immediately (the visual exit
		// is an overlay on mobile); otherwise a focus mid-exit is centred for the
		// old inset and jumps when the panel unmounts.
		if (!item || !isCurrentSelection || !element || (isMobile && proofActive)) {
			setSheetHeight(0);
			return;
		}
		const update = () => setSheetHeight(element.offsetHeight);
		update();
		const observer = new ResizeObserver(update);
		observer.observe(element);
		return () => observer.disconnect();
	}, [item, isCurrentSelection, isMobile, proofActive, setSheetHeight]);

	// F-14 "Cross-Reference": catalogue alternatives for a placed catalog pedal.
	// Read-only shares never offer this (it opens the picker, an edit surface).
	// Hooks must run before the early returns below.
	const targetPedal =
		!readOnly && resolved?.definition?.category === "pedal"
			? resolved.definition
			: null;
	// The catalogue overlay mutates `catalog.pedals` in place, so invalidate on
	// its version, not on the array identity. The target definition object is
	// stable per refId, so this recomputes on selection/overlay only — not on
	// every pointermove or label keystroke.
	// biome-ignore lint/correctness/useExhaustiveDependencies: plannerVersion is an intentional cache-buster
	const similarCatalog = useMemo(
		() => (targetPedal ? similarPedals(targetPedal, catalog.pedals) : []),
		[targetPedal, plannerVersion],
	);
	const similar = onOpenSimilar ? similarCatalog : [];
	const similarLabels =
		targetPedal?.effectTypes.map((type) => effectLabel(type)) ?? [];
	const similarFilterLabel =
		similarLabels.length <= 1
			? (similarLabels[0] ?? "the catalogue")
			: similarLabels.length === 2
				? `${similarLabels[0]} and ${similarLabels[1]}`
				: `${similarLabels.slice(0, -1).join(", ")} and ${similarLabels.at(-1)}`;

	if (isMobile && proofActive) return null;
	if (!item || !resolved) return null;

	const jacks = resolveItemJacks(item, customPedals);
	const info = buildPartInfo(resolved, item.kind, jacks);

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
				loading="eager"
				decoding="sync"
				fetchPriority="high"
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
			data-proofing={proofActive ? "true" : "false"}
			aria-label="Selected part details"
		>
			<header className="info-panel__header">
				<span
					className="info-panel__sleeve"
					data-testid="info-cover"
					aria-hidden="true"
					/* The already-decoded 800 canvas image paints immediately; the
					 * 350 sleeve replaces it when it decodes (F-01 still uses 350). */
					style={
						showSleeveImage && imageSrc
							? { backgroundImage: `url("${imageSrc}")` }
							: undefined
					}
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
				{readOnly ? (
					item.label ? (
						<section className="info-panel__section" data-testid="info-label">
							<dl className="info-panel__facts">
								<div className="info-panel__fact">
									<dt>Label</dt>
									<dd data-testid="info-label-value">{item.label}</dd>
								</div>
							</dl>
						</section>
					) : null
				) : (
					<section className="info-panel__section" data-testid="info-label">
						<div className="info-panel__section-head">
							<h3 className="info-panel__eyebrow">Label</h3>
							{labelEditing || labelValue ? (
								<span
									className="info-panel__count"
									data-testid="info-label-count"
								>
									{labelValue.length}/{ITEM_LABEL_MAX_LENGTH}
								</span>
							) : null}
						</div>
						<div className="custom__control info-panel__label-control">
							<input
								className="custom__input"
								data-testid="info-label-input"
								type="text"
								value={labelValue}
								maxLength={ITEM_LABEL_MAX_LENGTH}
								autoComplete="off"
								spellCheck={false}
								placeholder="e.g. always on"
								aria-label="Label"
								onFocus={beginLabelEdit}
								onBlur={commitLabelEdit}
								onChange={(event) => {
									const next = event.target.value;
									setLabelDraft(next);
									if (item) {
										ensureLabelHold();
										setItemLabel(item.uid, next);
									}
								}}
								onKeyDown={(event) => {
									if (event.key === "Enter" || event.key === "Escape") {
										event.preventDefault();
										event.currentTarget.blur();
									}
								}}
							/>
							{labelValue ? (
								<button
									type="button"
									className="info-panel__label-clear"
									data-testid="info-label-clear"
									aria-label="Clear label"
									onMouseDown={(event) => event.preventDefault()}
									onClick={clearLabel}
								>
									×
								</button>
							) : null}
						</div>
					</section>
				)}

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

				{similar.length > 0 && targetPedal && onOpenSimilar ? (
					<section className="info-panel__section" data-testid="info-similar">
						<div className="info-panel__section-head">
							<h3 className="info-panel__eyebrow">Similar</h3>
						</div>
						<div className="info-similar__body">
							<p className="info-similar__hint">
								{similarLabels.length > 1
									? "Same effect types"
									: "Same effect type"}{" "}
								· browse {similarFilterLabel} pedals
							</p>
							<ul className="info-similar__list">
								{similar.map((entry) => {
									const shared = entry.sharedEffectTypes
										.map((type) => effectLabel(type))
										.join(" · ");
									const dims = formatDimensions(
										entry.widthCm,
										entry.heightCm,
										units,
									);
									return (
										<li key={entry.id}>
											<button
												type="button"
												className="info-similar__row"
												data-testid={`info-similar-${entry.id}`}
												aria-haspopup="dialog"
												aria-label={`${entry.brand} ${entry.name}, shares ${entry.sharedEffectTypes
													.map((type) => effectLabel(type))
													.join(" and ")}, ${dims} — open in the catalogue`}
												onClick={() => onOpenSimilar(targetPedal.effectTypes)}
											>
												<span className="info-similar__line">
													<span className="info-similar__name">
														{entry.name}
													</span>
													<span className="info-similar__dims">{dims}</span>
												</span>
												<span className="info-similar__subline">
													{entry.brand} · {shared}
												</span>
											</button>
										</li>
									);
								})}
							</ul>
						</div>
					</section>
				) : null}

				<JackCorrections
					itemUid={item.uid}
					jacks={jacks}
					baseJacks={baseItemJacks(item, customPedals)}
					widthCm={info.widthCm}
					heightCm={info.heightCm}
					units={units}
					editable={!readOnly}
					isCustom={info.isCustom}
				/>

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
					<a href="/docs" target="_blank" rel="noreferrer">
						Docs &amp; help
					</a>{" "}
					·{" "}
					<a href="/takedown" target="_blank" rel="noreferrer">
						Image credits &amp; removal
					</a>
				</p>
			</div>
		</aside>
	);
}
