import { useEffect, useMemo, useRef, useState } from "react";
import { catalog } from "../catalog/load";
import {
	type CatalogBoard,
	type CatalogPedal,
	EFFECT_TYPES,
	type EffectType,
} from "../catalog/schema";
import { resolveImageUrl } from "../lib/cdn";
import { centerOffset } from "../lib/geometry";
import { boardFootprint, useScene } from "../state/scene";
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
 * The catalog picker (P2-01) — "Parts Bin". Desktop: a centered modal opened
 * from the top toolbar. Mobile (<1024px): a persistent bottom tab bar that
 * raises a dismissible sheet. Search + brand/effect filters are pinned; only
 * the results scroll. Placing an item reuses the scene actions and dismisses
 * the picker (no toast — the canvas selection halo is the feedback, N8).
 *
 * See `docs/tasks/P2-01-picker-modal.md` (owner-approved "Parts Bin" direction).
 */
export function Picker({ open, tab, onOpen, onTab, onClose }: PickerProps) {
	const boards = useScene((state) => state.boards);
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

	const panelRef = useRef<HTMLDivElement>(null);
	const barRef = useRef<HTMLElement>(null);
	const searchRef = useRef<HTMLInputElement>(null);
	const returnFocusRef = useRef<HTMLElement | null>(null);

	// Reset filters when switching tabs: the brand menu and the effect chips
	// differ per tab, so a stale selection would silently hide every result.
	const resetFilters = () => {
		setQuery("");
		setBrand(null);
		setEffectTypes([]);
		setShowAllEffects(false);
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

	// Placement is implicit (owner-approved direction): a pedal goes to the
	// SELECTED board, or loose if none is selected. No silent `boards[0]`
	// fallback — the footer hint must match what actually happens.
	const targetBoard =
		boards.find((board) => board.uid === selectedBoardUid) ?? null;

	const handleAddBoard = (board: CatalogBoard) => {
		const { scale, x, y, size } = useViewport.getState();
		const uid = addBoard(board.id, viewportCenterCm(size, { scale, x, y }));
		selectBoard(uid);
		onClose();
	};

	const handleAddPedal = (pedal: CatalogPedal) => {
		if (targetBoard) {
			const footprint = boardFootprint(targetBoard);
			const offset = centerOffset(
				footprint.widthCm,
				footprint.heightCm,
				pedal.widthCm,
				pedal.heightCm,
			);
			const uid = addItem(pedal.id, "pedal", targetBoard.uid, offset);
			selectItem(uid);
		} else {
			const { scale, x, y, size } = useViewport.getState();
			const center = viewportCenterCm(size, { scale, x, y });
			const offset = centerOffset(0, 0, pedal.widthCm, pedal.heightCm);
			const uid = addItem(pedal.id, "pedal", null, {
				x: center.x + offset.x,
				y: center.y + offset.y,
			});
			selectItem(uid);
		}
		onClose();
	};

	// Keep Tab inside the dialog (ARIA modal). The mobile tab switcher lives
	// INSIDE the dialog when open, so it is part of the trap (and reachable by
	// screen readers) rather than outside the modal scope.
	const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
		if (event.key !== "Tab") return;
		const selector =
			'button, input, select, a[href], [tabindex]:not([tabindex="-1"])';
		const focusables = [panelRef.current, barRef.current]
			.flatMap((root) => [
				...(root?.querySelectorAll<HTMLElement>(selector) ?? []),
			])
			// Exclude the desktop-only tabs while they're display:none on mobile
			// (and the bar while it's display:none on desktop).
			.filter((element) => element.offsetParent !== null);
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
	const count = tab === "boards" ? filteredBoards.length : pedals.length;

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
				Pedals
			</button>
			<button
				type="button"
				className="picker-bar__tab"
				data-testid="picker-bar-boards"
				aria-current={tab === "boards" ? "true" : undefined}
				onClick={() => openTab("boards")}
			>
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
						aria-label={tab === "boards" ? "Add a board" : "Add a pedal"}
						onKeyDown={handleKeyDown}
					>
						<div className="picker__handle" aria-hidden="true" />
						<header className="picker__header">
							<h2 className="picker__title">
								{tab === "boards" ? "Add board" : "Add pedal"}
							</h2>
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
						</header>

						<div className="picker__tabs">
							<button
								type="button"
								className="picker__tab"
								data-testid="picker-tab-pedals"
								aria-pressed={tab === "pedals"}
								onClick={() => changeTab("pedals")}
							>
								Pedals
							</button>
							<button
								type="button"
								className="picker__tab"
								data-testid="picker-tab-boards"
								aria-pressed={tab === "boards"}
								onClick={() => changeTab("boards")}
							>
								Boards
							</button>
						</div>

						<div className="picker__search">
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
									tab === "boards" ? "Search boards…" : "Search pedals…"
								}
								value={query}
								onChange={(event) => setQuery(event.target.value)}
							/>
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

							{tab === "pedals" ? (
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
										{showAllEffects ? "Fewer" : "More"}
									</button>
								</fieldset>
							) : null}
						</div>

						<div className="picker__results" data-testid="picker-results">
							{count === 0 ? (
								<p className="picker__empty" data-testid="picker-empty">
									{tab === "boards" ? (
										<>
											No boards match.{" "}
											<button
												type="button"
												className="picker__clear-inline"
												onClick={() => {
													setQuery("");
													setBrand(null);
												}}
											>
												Clear filters
											</button>
										</>
									) : (
										<>
											No pedals match.{" "}
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
										</>
									)}
								</p>
							) : tab === "boards" ? (
								filteredBoards.map((board) => (
									<button
										key={board.id}
										type="button"
										className="picker-item"
										data-testid={`add-board-${board.id}`}
										onClick={() => handleAddBoard(board)}
									>
										<PickerThumb
											src={resolveImageUrl(
												board.imageSource,
												board.image,
												"board",
												350,
											)}
										/>
										<span className="picker-item__text">
											<span className="picker-item__name">
												{board.brand} {board.name}
											</span>
											<span className="picker-item__dims">
												{board.widthCm} × {board.heightCm} cm
											</span>
										</span>
									</button>
								))
							) : (
								pedals.map((pedal) => (
									<button
										key={pedal.id}
										type="button"
										className="picker-item"
										data-testid={`add-pedal-${pedal.id}`}
										onClick={() => handleAddPedal(pedal)}
									>
										<PickerThumb
											src={resolveImageUrl(
												pedal.imageSource,
												pedal.image,
												"pedal",
												350,
											)}
										/>
										<span className="picker-item__text">
											<span className="picker-item__name">{pedal.name}</span>
											<span className="picker-item__brand">{pedal.brand}</span>
											<span className="picker-item__dims">
												{pedal.widthCm} × {pedal.heightCm} cm
											</span>
										</span>
									</button>
								))
							)}
						</div>

						<footer className="picker__footer">
							<span
								className="picker__count"
								data-testid="picker-count"
								aria-live="polite"
							>
								{count} {tab === "boards" ? "boards" : "pedals"}
							</span>
							{tab === "boards" ? (
								selectedBoardUid ? (
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
								) : (
									<span className="picker__hint">
										Adds at the viewport centre
									</span>
								)
							) : (
								<span className="picker__hint" data-testid="picker-hint">
									{targetBoard
										? "Adds to the selected board"
										: "No board — adds loosely"}
								</span>
							)}
						</footer>
					</div>
					{tabBar}
				</div>
			) : null}
		</>
	);
}

/** Result thumbnail — falls back to a neutral tile when the image fails. */
function PickerThumb({ src }: { src: string }) {
	const [failed, setFailed] = useState(false);
	if (failed) {
		return (
			<span
				className="picker-item__thumb picker-item__thumb--empty"
				aria-hidden="true"
			/>
		);
	}
	return (
		<img
			className="picker-item__thumb"
			src={src}
			alt=""
			loading="lazy"
			onError={() => setFailed(true)}
		/>
	);
}
