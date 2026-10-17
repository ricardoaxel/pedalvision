import { useEffect, useMemo, useRef, useState } from "react";
import { catalog } from "../catalog/load";
import { EFFECT_TYPES, type EffectType } from "../catalog/schema";
import { resolveImageUrl } from "../lib/cdn";
import { centerOffset, placeItem } from "../lib/geometry";
import {
	boardDefinition,
	boardFootprint,
	itemFootprint,
	useScene,
} from "../state/scene";
import { selectSelectedBoardUid, useSelection } from "../state/selection";
import { useViewport, viewportCenterCm } from "../state/viewport";
import {
	brandsOf,
	effectLabel,
	filterBoards,
	filterPedals,
	pedalBrands,
	toggleEffectType,
} from "./pickerFilter";

export type PickerTab = "pedals" | "boards";

/** Effect chips shown before the "More" reveal (keeps the filter row compact). */
const EFFECT_CHIP_PREVIEW = 8;

interface PickerProps {
	open: boolean;
	tab: PickerTab;
	/** Open the picker on `tab` (mobile tab bar + desktop trigger). */
	onOpen: (tab: PickerTab) => void;
	/** Switch tab while open (desktop modal tabs). */
	onTab: (tab: PickerTab) => void;
	onClose: () => void;
}

/**
 * A catalog entry flattened into the shape both the ledger rows and the
 * specimen pane need, so pedals and boards render through one uniform path.
 */
interface PickerEntry {
	id: string;
	brand: string;
	name: string;
	widthCm: number;
	heightCm: number;
	/** 800px image for the specimen plate. */
	imageSrc: string;
	/** "Fuzz · Distortion" (pedals) or "" (boards). */
	meta: string;
}

/**
 * The catalog picker (P2-01) — "Specimen Bench". Desktop: a top-anchored
 * two-pane instrument — a dense, keyboard-first **ledger** of parts on the left
 * and a **specimen** pane on the right (the item on a lit photographic plate
 * over the canvas's own dot grid, with an honest scale bar). Mobile (<1024px):
 * a persistent bottom tab bar that raises a compact sheet. Placing an item
 * reuses the scene actions and dismisses the picker (no toast — the canvas
 * selection halo is the feedback).
 *
 * See `docs/tasks/P2-01-picker-modal.md` (owner-approved "Specimen Bench"
 * direction, 2026-10-17, extending "Parts Bin").
 */
export function Picker({ open, tab, onOpen, onTab, onClose }: PickerProps) {
	const boards = useScene((state) => state.boards);
	const items = useScene((state) => state.items);
	const addBoard = useScene((state) => state.addBoard);
	const removeBoard = useScene((state) => state.removeBoard);
	const addItem = useScene((state) => state.addItem);
	const selectedBoardUid = useSelection(selectSelectedBoardUid);
	const selectBoard = useSelection((state) => state.selectBoard);
	const selectItem = useSelection((state) => state.selectItem);

	const [query, setQuery] = useState("");
	const [brand, setBrand] = useState<string | null>(null);
	const [effectTypes, setEffectTypes] = useState<EffectType[]>([]);
	const [showAllEffects, setShowAllEffects] = useState(false);
	/** The item shown in the specimen pane (hover/keyboard-active). */
	const [activeId, setActiveId] = useState<string | null>(null);

	const panelRef = useRef<HTMLDivElement>(null);
	const searchRef = useRef<HTMLInputElement>(null);
	const returnFocusRef = useRef<HTMLElement | null>(null);
	const rowRefs = useRef(new Map<string, HTMLButtonElement>());

	// Reset filters when switching tabs: the brand menu and the effect chips
	// differ per tab, so a stale selection would silently hide every result.
	const resetFilters = () => {
		setQuery("");
		setBrand(null);
		setEffectTypes([]);
		setShowAllEffects(false);
		setActiveId(null);
	};

	const changeTab = (next: PickerTab) => {
		if (next === tab) return;
		resetFilters();
		onTab(next);
	};

	const openTab = (next: PickerTab) => {
		if (!open || next !== tab) resetFilters();
		onOpen(next);
	};

	// Focus management: move focus into the picker on open, restore on close.
	useEffect(() => {
		if (open) {
			returnFocusRef.current = document.activeElement as HTMLElement | null;
			searchRef.current?.focus();
			return;
		}
		returnFocusRef.current?.focus?.();
		returnFocusRef.current = null;
	}, [open]);

	// Esc closes from anywhere in the dialog.
	useEffect(() => {
		if (!open) return;
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") onClose();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [open, onClose]);

	const pedalBrandOptions = useMemo(() => pedalBrands(catalog.pedals), []);
	const boardBrands = useMemo(() => brandsOf(catalog.boards), []);

	const pedals = useMemo(
		() => filterPedals(catalog.pedals, { query, brand, effectTypes }),
		[query, brand, effectTypes],
	);
	const filteredBoards = useMemo(
		() => filterBoards(catalog.boards, { query, brand }),
		[query, brand],
	);

	// One uniform entry list for the ledger rows + the specimen pane.
	const entries = useMemo<PickerEntry[]>(() => {
		if (tab === "boards") {
			return filteredBoards.map((board) => ({
				id: board.id,
				brand: board.brand,
				name: board.name,
				widthCm: board.widthCm,
				heightCm: board.heightCm,
				imageSrc: resolveImageUrl(board.imageSource, board.image, "board", 800),
				meta: "",
			}));
		}
		return pedals.map((pedal) => {
			const labels = pedal.effectTypes.map(effectLabel);
			const meta =
				labels.length > 0
					? labels.slice(0, 3).join(" · ") +
						(labels.length > 3 ? ` +${labels.length - 3}` : "")
					: "";
			return {
				id: pedal.id,
				brand: pedal.brand,
				name: pedal.name,
				widthCm: pedal.widthCm,
				heightCm: pedal.heightCm,
				imageSrc: resolveImageUrl(pedal.imageSource, pedal.image, "pedal", 800),
				meta,
			};
		});
	}, [tab, pedals, filteredBoards]);

	const activeEntry =
		entries.find((entry) => entry.id === activeId) ?? entries[0] ?? null;

	// Placement is implicit (owner-approved direction): a pedal goes to the
	// SELECTED board, or loose if none is selected. No silent `boards[0]`
	// fallback — the footer hint must match what actually happens.
	const targetBoard =
		boards.find((board) => board.uid === selectedBoardUid) ?? null;
	const targetLabel =
		tab === "boards"
			? "Free canvas"
			: targetBoard
				? (boardDefinition(targetBoard)?.name ?? "Custom board")
				: "Free canvas";

	/** Current board-local (or world) rects already occupied in `container`. */
	const occupied = (boardUid: string | null) =>
		items
			.filter((item) => item.boardUid === boardUid)
			.map((item) => {
				const footprint = itemFootprint(item);
				return {
					x: item.x,
					y: item.y,
					widthCm: footprint.widthCm,
					heightCm: footprint.heightCm,
				};
			});

	const handlePlace = (entry: PickerEntry) => {
		const size = { widthCm: entry.widthCm, heightCm: entry.heightCm };
		if (tab === "boards") {
			const { scale, x, y, size: viewportSize } = useViewport.getState();
			const uid = addBoard(
				entry.id,
				viewportCenterCm(viewportSize, { scale, x, y }),
			);
			selectBoard(uid);
		} else if (targetBoard) {
			const footprint = boardFootprint(targetBoard);
			const base = centerOffset(
				footprint.widthCm,
				footprint.heightCm,
				entry.widthCm,
				entry.heightCm,
			);
			const pos = placeItem(base, size, occupied(targetBoard.uid), {
				bounds: footprint,
			});
			selectItem(addItem(entry.id, "pedal", targetBoard.uid, pos));
		} else {
			const { scale, x, y, size: viewportSize } = useViewport.getState();
			const center = viewportCenterCm(viewportSize, { scale, x, y });
			const base = {
				x: center.x - entry.widthCm / 2,
				y: center.y - entry.heightCm / 2,
			};
			const pos = placeItem(base, size, occupied(null));
			selectItem(addItem(entry.id, "pedal", null, pos));
		}
		onClose();
	};

	// Move the keyboard-active row and mirror focus to it (listbox behaviour).
	const moveActive = (delta: number) => {
		if (entries.length === 0) return;
		const index = activeEntry ? entries.indexOf(activeEntry) : -1;
		const next = Math.min(Math.max(index + delta, 0), entries.length - 1);
		const entry = entries[next];
		setActiveId(entry.id);
		requestAnimationFrame(() => rowRefs.current.get(entry.id)?.focus());
	};

	// Keep Tab inside the dialog (ARIA modal). The mobile tab switcher is
	// rendered INSIDE the panel while open (so it is part of the trap and
	// reachable by screen readers), so the panel is the only trap root.
	const trapTab = (event: React.KeyboardEvent<HTMLDivElement>) => {
		if (event.key !== "Tab") return;
		const selector =
			'button, input, select, a[href], [tabindex]:not([tabindex="-1"])';
		const focusables = [
			...(panelRef.current?.querySelectorAll<HTMLElement>(selector) ?? []),
			// Exclude the desktop-only tabs while they're display:none on mobile.
		].filter((element) => element.offsetParent !== null);
		if (focusables.length === 0) return;
		const first = focusables[0];
		const last = focusables[focusables.length - 1];
		if (event.shiftKey && document.activeElement === first) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && document.activeElement === last) {
			event.preventDefault();
			first.focus();
		}
	};

	// ↑↓ browse the ledger, ↵ places (the row is a button). Arrows are left to
	// the brand <select> while it owns focus.
	const handlePanelKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
		trapTab(event);
		if (event.defaultPrevented) return;
		if (event.target instanceof HTMLSelectElement) return;
		if (event.key === "ArrowDown") {
			event.preventDefault();
			moveActive(1);
		} else if (event.key === "ArrowUp") {
			event.preventDefault();
			moveActive(-1);
		}
	};

	// When collapsed, always keep any SELECTED effect type visible (even one
	// outside the preview) so an active filter is never invisible/unremovable.
	const effectPreview = EFFECT_TYPES.slice(0, EFFECT_CHIP_PREVIEW);
	const visibleEffects = showAllEffects
		? EFFECT_TYPES
		: [
				...effectPreview,
				...effectTypes.filter((type) => !effectPreview.includes(type)),
			];
	const brands = tab === "boards" ? boardBrands : pedalBrandOptions;
	const count = entries.length;
	const isBoards = tab === "boards";
	const hint = isBoards
		? "Adds at the viewport centre"
		: targetBoard
			? "Adds to the selected board"
			: "No board — adds loosely";

	// The mobile bottom tab bar. Rendered inside the dialog while open (so the
	// modal's switcher is in the AT/focus scope) and standalone while closed.
	const tabBar = (
		<nav className="picker-bar" aria-label="Catalog">
			<button
				type="button"
				className="picker-bar__tab"
				data-testid="picker-bar-pedals"
				aria-current={tab === "pedals" ? "true" : undefined}
				onClick={() => openTab("pedals")}
			>
				<BarIcon kind="pedal" />
				Pedals
			</button>
			<button
				type="button"
				className="picker-bar__tab"
				data-testid="picker-bar-boards"
				aria-current={tab === "boards" ? "true" : undefined}
				onClick={() => openTab("boards")}
			>
				<BarIcon kind="board" />
				Boards
			</button>
		</nav>
	);

	return (
		<>
			{open ? null : tabBar}

			{open ? (
				<div className="picker" data-testid="picker">
					<button
						type="button"
						className="picker__scrim"
						data-testid="picker-scrim"
						aria-label="Close picker"
						onClick={onClose}
					/>
					<div
						ref={panelRef}
						className="picker__panel"
						data-testid="picker-panel"
						role="dialog"
						aria-modal="true"
						aria-label={isBoards ? "Add a board" : "Add a pedal"}
						onKeyDown={handlePanelKeyDown}
					>
						<div className="picker__handle" aria-hidden="true" />
						<header className="picker__header">
							<div className="picker__heading">
								<span className="picker__eyebrow">
									{isBoards ? "Catalog — Boards" : "Catalog — Pedals"}
								</span>
								<h2 className="picker__title">
									{isBoards ? "Add board" : "Add pedal"}
								</h2>
								<span className="picker__header-hint" data-testid="picker-hint">
									{hint}
								</span>
							</div>
							<div className="picker__header-aside">
								<div className="picker__segmented">
									<button
										type="button"
										className="picker__segment"
										data-testid="picker-tab-pedals"
										aria-pressed={tab === "pedals"}
										onClick={() => changeTab("pedals")}
									>
										<BarIcon kind="pedal" />
										Pedals
									</button>
									<button
										type="button"
										className="picker__segment"
										data-testid="picker-tab-boards"
										aria-pressed={tab === "boards"}
										onClick={() => changeTab("boards")}
									>
										<BarIcon kind="board" />
										Boards
									</button>
								</div>
								<button
									type="button"
									className="picker__close"
									data-testid="picker-close"
									aria-label="Close"
									onClick={onClose}
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

						<div className="picker__body">
							<div className="picker__ledger">
								<div className="picker__tools">
									<div className="picker__search">
										<svg
											className="picker__search-icon"
											width="16"
											height="16"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											strokeWidth="2"
											strokeLinecap="round"
											aria-hidden="true"
										>
											<circle cx="11" cy="11" r="7" />
											<path d="M20 20l-3.2-3.2" />
										</svg>
										<label className="visually-hidden" htmlFor="picker-search">
											Search the catalog
										</label>
										<input
											id="picker-search"
											ref={searchRef}
											className="picker__search-input"
											data-testid="picker-search"
											type="search"
											placeholder={
												isBoards ? "Search boards…" : "Search pedals…"
											}
											value={query}
											onChange={(event) => setQuery(event.target.value)}
										/>
										{query ? (
											<button
												type="button"
												className="picker__search-clear"
												aria-label="Clear search"
												onClick={() => setQuery("")}
											>
												<svg
													width="14"
													height="14"
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
										) : null}
										<span
											className="picker__search-count"
											data-testid="picker-count"
											aria-live="polite"
										>
											{count} {isBoards ? "boards" : "pedals"}
										</span>
									</div>

									<div className="picker__filters">
										<label className="visually-hidden" htmlFor="picker-brand">
											Brand
										</label>
										<select
											id="picker-brand"
											className="picker__brand"
											data-testid="picker-brand"
											value={brand ?? ""}
											onChange={(event) => setBrand(event.target.value || null)}
										>
											<option value="">All brands</option>
											{brands.map((option) => (
												<option key={option} value={option}>
													{option}
												</option>
											))}
										</select>

										{isBoards ? null : (
											<fieldset className="picker__chips">
												<legend className="visually-hidden">Effect type</legend>
												{visibleEffects.map((type) => (
													<button
														key={type}
														type="button"
														className="picker__chip"
														data-testid={`picker-effect-${type}`}
														aria-pressed={effectTypes.includes(type)}
														onClick={() =>
															setEffectTypes((current) =>
																toggleEffectType(current, type),
															)
														}
													>
														{effectLabel(type)}
													</button>
												))}
												<button
													type="button"
													className="picker__chip picker__chip--more"
													data-testid="picker-effects-toggle"
													aria-expanded={showAllEffects}
													onClick={() => setShowAllEffects((value) => !value)}
												>
													{showAllEffects ? "Fewer" : "All types"}
												</button>
											</fieldset>
										)}
									</div>
								</div>

								<div className="picker__results" data-testid="picker-results">
									{count === 0 ? (
										<p className="picker__empty" data-testid="picker-empty">
											{isBoards ? "No boards match. " : "No pedals match. "}
											<button
												type="button"
												className="picker__clear-inline"
												onClick={() => {
													setQuery("");
													setBrand(null);
													setEffectTypes([]);
												}}
											>
												Clear filters
											</button>
										</p>
									) : (
										entries.map((entry) => {
											const isActive = entry.id === activeEntry?.id;
											return (
												<button
													key={entry.id}
													ref={(node) => {
														if (node) rowRefs.current.set(entry.id, node);
														else rowRefs.current.delete(entry.id);
													}}
													type="button"
													aria-current={isActive ? "true" : undefined}
													className="picker-item"
													data-active={isActive ? "true" : undefined}
													data-testid={`${isBoards ? "add-board" : "add-pedal"}-${entry.id}`}
													onMouseEnter={() => setActiveId(entry.id)}
													onFocus={() => setActiveId(entry.id)}
													onClick={() => handlePlace(entry)}
												>
													<PickerThumb
														src={entry.imageSrc}
														kind={isBoards ? "board" : "pedal"}
													/>
													<span className="picker-item__text">
														<span className="picker-item__name">
															{entry.name}
														</span>
														<span className="picker-item__brand">
															{entry.brand}
														</span>
													</span>
													<span className="picker-item__dims">
														{entry.widthCm} × {entry.heightCm} cm
													</span>
												</button>
											);
										})
									)}
								</div>

								<div className="picker__status">
									<span className="picker__keys" aria-hidden="true">
										<kbd className="picker__key">↑</kbd>
										<kbd className="picker__key">↓</kbd> browse
										<span className="picker__key-sep">·</span>
										<kbd className="picker__key">↵</kbd> place
									</span>
									{isBoards && selectedBoardUid ? (
										<button
											type="button"
											className="picker__remove"
											data-testid="remove-board"
											onClick={() => {
												removeBoard(selectedBoardUid);
												selectBoard(null);
												onClose();
											}}
										>
											Remove selected board
										</button>
									) : null}
								</div>
							</div>

							<aside className="picker__specimen" data-testid="picker-specimen">
								{activeEntry ? (
									<Specimen
										key={activeEntry.id}
										entry={activeEntry}
										kind={isBoards ? "board" : "pedal"}
										targetLabel={targetLabel}
										ctaLabel={
											isBoards
												? "Place at centre"
												: targetBoard
													? "Place on board"
													: "Place at centre"
										}
										onPlace={() => handlePlace(activeEntry)}
									/>
								) : (
									<div className="picker__specimen-empty">
										<p className="picker__specimen-hint">
											Nothing to inspect — adjust the search or filters.
										</p>
									</div>
								)}
							</aside>
						</div>
						{tabBar}
					</div>
				</div>
			) : null}
		</>
	);
}

/** The right-hand specimen pane: plate, scale bar, identity, placement CTA. */
function Specimen({
	entry,
	kind,
	targetLabel,
	ctaLabel,
	onPlace,
}: {
	entry: PickerEntry;
	kind: "pedal" | "board";
	targetLabel: string;
	ctaLabel: string;
	onPlace: () => void;
}) {
	return (
		<div className="specimen">
			<span className="specimen__eyebrow">Placing on</span>
			<span className="specimen__target">{targetLabel}</span>
			<div className="specimen__plate">
				<PickerThumb src={entry.imageSrc} variant="specimen" kind={kind} />
			</div>
			<div className="specimen__identity">
				<span className="specimen__brand">{entry.brand}</span>
				<h3 className="specimen__name">{entry.name}</h3>
				{entry.meta ? <p className="specimen__meta">{entry.meta}</p> : null}
				<p className="specimen__dims">
					{entry.widthCm} × {entry.heightCm} cm
				</p>
			</div>
			<button
				type="button"
				className="specimen__cta"
				data-testid="picker-place"
				onClick={onPlace}
			>
				{ctaLabel}
			</button>
		</div>
	);
}

/**
 * Thumbnail for the ledger rows + the specimen plate.
 *
 * It loads **CORS-first** (`crossOrigin="anonymous"`, mirroring the canvas
 * `useImage` loader), then retries once **without** CORS, then falls back to a
 * neutral tile. This order matters: a plain no-CORS load first poisons the HTTP
 * cache with a response that has no `Access-Control-Allow-Origin`, so the
 * canvas's later `crossOrigin` request reuses that cached copy and fails — for
 * hosts that only send the header when the request carries an `Origin` (e.g.
 * `static.roland.com`), the BOSS CE-20 thumbnail would then show in the picker
 * but its canvas image would never load. Loading CORS-first caches the
 * CORS-clean response; the no-CORS retry is safe here because these images are
 * DOM-only (never drawn into Konva), so it can display hotlinked hosts that
 * send no CORS header while the canvas correctly falls back for those.
 * See ADR-003 §Brand image URLs.
 */
function PickerThumb({
	src,
	variant = "row",
	kind = "pedal",
}: {
	src: string;
	variant?: "row" | "specimen";
	kind?: "pedal" | "board";
}) {
	// Attempt state, scoped to the current `src` (a failed board must not
	// suppress a later valid pedal image as the active item changes).
	const [attempt, setAttempt] = useState<{ src: string; phase: Phase }>({
		src,
		phase: "cors",
	});
	const phase: Phase = attempt.src === src ? attempt.phase : "cors";
	const bump = () =>
		setAttempt((current) => ({
			src,
			phase:
				(current.src === src ? current.phase : "cors") === "cors"
					? "nocors"
					: "failed",
		}));
	const crossOrigin = phase === "cors" ? "anonymous" : undefined;

	if (variant === "specimen") {
		if (phase === "failed") {
			return (
				<span
					className="specimen__img picker-item__thumb--empty"
					aria-hidden="true"
					data-empty="true"
				>
					{kind === "board" ? <BoardGlyph /> : null}
				</span>
			);
		}
		return (
			<img
				key={`${src}:${phase}`}
				className="specimen__img"
				src={src}
				alt=""
				loading="lazy"
				crossOrigin={crossOrigin}
				onError={bump}
			/>
		);
	}

	// Board rows show the real board art (a dark top-down plan) on the light
	// plate, letterboxed to true aspect; the glyph is only the failure fallback.
	const boardClass = kind === "board" ? " picker-item__thumb--board" : "";

	if (phase === "failed") {
		return kind === "board" ? (
			<span
				className="picker-item__thumb picker-item__thumb--board picker-item__thumb--glyph"
				aria-hidden="true"
			>
				<BoardGlyph />
			</span>
		) : (
			<span
				className="picker-item__thumb picker-item__thumb--empty"
				aria-hidden="true"
				data-empty="true"
			/>
		);
	}
	return (
		<img
			key={`${src}:${phase}`}
			className={`picker-item__thumb${boardClass}`}
			src={src}
			alt=""
			loading="lazy"
			crossOrigin={crossOrigin}
			onError={bump}
		/>
	);
}

type Phase = "cors" | "nocors" | "failed";

/** Neutral "board, no photo yet" glyph for an empty board tile. */
function BoardGlyph() {
	return (
		<svg
			width="22"
			height="22"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.6"
			strokeLinecap="round"
			aria-hidden="true"
		>
			<rect x="2.5" y="8" width="19" height="8" rx="2" />
			<path d="M7 8v8M17 8v8" opacity="0.5" />
		</svg>
	);
}

/** Mobile bottom-bar glyphs (18px, currentColor). */
function BarIcon({ kind }: { kind: "pedal" | "board" }) {
	return kind === "pedal" ? (
		<svg
			className="picker-bar__icon"
			width="18"
			height="18"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.8"
			strokeLinecap="round"
			aria-hidden="true"
		>
			<rect x="5" y="3" width="14" height="18" rx="2" />
			<circle cx="9.5" cy="8" r="1.4" />
			<circle cx="14.5" cy="8" r="1.4" />
			<path d="M9.5 13h5" />
		</svg>
	) : (
		<svg
			className="picker-bar__icon"
			width="18"
			height="18"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.8"
			strokeLinecap="round"
			aria-hidden="true"
		>
			<rect x="2.5" y="7" width="19" height="10" rx="2" />
			<path d="M6 7v10M18 7v10" opacity="0.5" />
		</svg>
	);
}
