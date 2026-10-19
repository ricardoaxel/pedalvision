import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { catalog } from "../catalog/load";
import { EFFECT_TYPES, type EffectType } from "../catalog/schema";
import { resolveImageUrl } from "../lib/cdn";
import {
	draftFromCustomBoard,
	emptyCustomBoardDraft,
} from "../lib/customBoard";
import {
	draftFromCustomPedal,
	emptyCustomPedalDraft,
} from "../lib/customPedal";
import { focusAddBoardTrigger } from "../lib/focus";
import { centerOffset, placeItem } from "../lib/geometry";
import {
	boardDefinition,
	boardFootprint,
	type CustomBoardDefinition,
	type CustomPedalDefinition,
	customPedalById,
	isCustomBoard,
	itemFootprint,
	useScene,
} from "../state/scene";
import { selectSelectedBoardUid, useSelection } from "../state/selection";
import { useViewport, viewportCenterCm } from "../state/viewport";
import { CustomBoardForm } from "./CustomBoardForm";
import { CustomPedalForm } from "./CustomPedalForm";
import { BoardIcon, CustomIcon, PedalIcon } from "./icons";
import { usePartImage } from "./partImage";
import {
	brandsOf,
	effectLabel,
	filterBoards,
	filterPedals,
	pedalBrands,
	toggleEffectType,
} from "./pickerFilter";
import { Section } from "./SheetSection";

export type PickerTab = "pedals" | "boards" | "custom";

/**
 * Per-tab header copy — a map, not nested ternaries, so a new tab can't silently
 * mislabel the dialog for assistive tech (P2-02 defect fix).
 */
const TAB_COPY: Record<
	PickerTab,
	{
		eyebrow: string;
		title: string;
		dialog: string;
		search: string;
		count: string;
		empty: string;
	}
> = {
	pedals: {
		eyebrow: "Catalog — Pedals",
		title: "Add pedal",
		dialog: "Add a pedal",
		search: "Search pedals…",
		count: "pedals",
		empty: "No pedals match. ",
	},
	boards: {
		eyebrow: "Catalog — Boards",
		title: "Add board",
		dialog: "Add a board",
		search: "Search boards…",
		count: "boards",
		empty: "No boards match. ",
	},
	custom: {
		eyebrow: "Catalog — Custom",
		title: "Add custom part",
		dialog: "Create a custom part",
		search: "",
		count: "parts",
		empty: "No parts match. ",
	},
};

/** Effect chips shown before the "More" reveal (keeps the filter row compact). */
const EFFECT_CHIP_PREVIEW = 8;

interface PickerProps {
	open: boolean;
	tab: PickerTab;
	/** When set, the Custom tab opens in edit mode seeded from this part. */
	editRefId?: string | null;
	/** When set, the Custom tab opens in board-edit mode seeded from this board uid. */
	editBoardUid?: string | null;
	/** Open the picker on `tab` (mobile tab bar + desktop trigger). */
	onOpen: (tab: PickerTab) => void;
	/** Switch tab while open (desktop modal tabs). */
	onTab: (tab: PickerTab) => void;
	/** Leave edit mode (tab switch away from Custom). */
	onClearEdit?: () => void;
	/** Leave board-edit mode. */
	onClearEditBoard?: () => void;
	onClose: () => void;
}

/** The user-defined part kinds offered by the Custom tab's kind segment. */
type CustomKind = "pedal" | "supply" | "board";

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
export function Picker({
	open,
	tab,
	editRefId,
	editBoardUid,
	onOpen,
	onTab,
	onClearEdit,
	onClearEditBoard,
	onClose,
}: PickerProps) {
	const boards = useScene((state) => state.boards);
	const items = useScene((state) => state.items);
	const customPedals = useScene((state) => state.customPedals);
	const addBoard = useScene((state) => state.addBoard);
	const removeBoard = useScene((state) => state.removeBoard);
	const addItem = useScene((state) => state.addItem);
	const addCustomPedal = useScene((state) => state.addCustomPedal);
	const updateCustomPedal = useScene((state) => state.updateCustomPedal);
	const addCustomBoard = useScene((state) => state.addCustomBoard);
	const updateCustomBoard = useScene((state) => state.updateCustomBoard);
	const selectedBoardUid = useSelection(selectSelectedBoardUid);
	const selectBoard = useSelection((state) => state.selectBoard);
	const selectItem = useSelection((state) => state.selectItem);

	const [query, setQuery] = useState("");
	const [brand, setBrand] = useState<string | null>(null);
	const [effectTypes, setEffectTypes] = useState<EffectType[]>([]);
	const [showAllEffects, setShowAllEffects] = useState(false);
	/** The item shown in the specimen pane (hover/keyboard-active). */
	const [activeId, setActiveId] = useState<string | null>(null);
	/** Custom-part draft lives here so Esc/close/tab-switch never discards it. */
	const [customDraft, setCustomDraft] = useState(() =>
		emptyCustomPedalDraft("cm"),
	);
	/** Custom-board draft (P2-05) — same lifetime rules as `customDraft`. */
	const [boardDraft, setBoardDraft] = useState(() =>
		emptyCustomBoardDraft("cm"),
	);
	/** Which user-defined kind the Custom tab is showing (pedal/supply/board). */
	const [customKind, setCustomKind] = useState<CustomKind>("pedal");

	const panelRef = useRef<HTMLDivElement>(null);
	const searchRef = useRef<HTMLInputElement>(null);
	const returnFocusRef = useRef<HTMLElement | null>(null);
	const rowRefs = useRef(new Map<string, HTMLButtonElement>());

	// Edit mode: the Custom tab seeded from an existing custom part (P2-02) or
	// custom board (P2-05).
	const isEditingBoard = tab === "custom" && editBoardUid != null;
	const isEditingPedal = tab === "custom" && editRefId != null;
	const isEditing = isEditingBoard || isEditingPedal;
	const isBoard = customKind === "board";
	const editedPart =
		editRefId != null ? customPedalById(customPedals, editRefId) : null;
	const editedBoard =
		editBoardUid != null
			? (boards.find(
					(board) => board.uid === editBoardUid && isCustomBoard(board),
				) ?? null)
			: null;
	const appliedEditRef = useRef<string | null>(null);
	const appliedEditBoard = useRef<string | null>(null);

	// Seed the draft from the stored definition when edit mode is entered (once
	// per refId), so re-opening Custom for a NEW part keeps the new-part draft.
	// `useLayoutEffect` applies the seed before paint — no empty-form flash.
	useLayoutEffect(() => {
		if (!open || editRefId == null) {
			appliedEditRef.current = null;
			return;
		}
		if (appliedEditRef.current === editRefId) return;
		const custom = customPedalById(customPedals, editRefId);
		if (custom) {
			appliedEditRef.current = editRefId;
			setCustomKind(custom.category);
			setCustomDraft((current) => draftFromCustomPedal(custom, current.units));
		}
	}, [open, editRefId, customPedals]);

	// Same seed for a custom board edit (P2-05); forces the Board kind.
	useLayoutEffect(() => {
		if (!open || editBoardUid == null) {
			appliedEditBoard.current = null;
			return;
		}
		if (appliedEditBoard.current === editBoardUid) return;
		const board = boards.find(
			(candidate) => candidate.uid === editBoardUid && isCustomBoard(candidate),
		);
		if (board) {
			appliedEditBoard.current = editBoardUid;
			setCustomKind("board");
			setBoardDraft((current) => draftFromCustomBoard(board, current.units));
		}
	}, [open, editBoardUid, boards]);

	// Leaving edit mode clears the edit draft(s) so they can't leak into Create;
	// the next Edit re-seeds from the saved definition.
	const leaveEdit = () => {
		onClearEdit?.();
		onClearEditBoard?.();
		setCustomDraft((current) => emptyCustomPedalDraft(current.units));
		setBoardDraft((current) => emptyCustomBoardDraft(current.units));
	};

	/** Switch the Custom tab between Pedal / Supply / Board (locked mid-edit). */
	const changeKind = (kind: CustomKind) => {
		if (isEditing) return;
		setCustomKind(kind);
		if (kind === "board") return;
		setCustomDraft((current) => ({
			...current,
			category: kind,
			// A supply is its power spec — open the fields.
			powerEnabled: kind === "supply" ? true : current.powerEnabled,
		}));
	};

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
		// Only an EDIT draft is dropped on a tab change; a Create draft survives
		// (see the note above `resetFilters`).
		if (isEditing) leaveEdit();
		resetFilters();
		onTab(next);
	};

	/**
	 * "Not listed? Create a custom-size …" shortcut from the Pedals/Boards
	 * ledgers. Sets the kind and switches tab in one batch (no wrong-kind paint),
	 * reusing `changeTab` for the edit-draft + filter rules. Deliberately NOT
	 * `changeKind` (edit-guarded, supply side effects) and NOT `openTab` (would
	 * reset filters/focus on an already-open picker).
	 */
	const openCustom = (kind: CustomKind) => {
		setCustomKind(kind);
		changeTab("custom");
	};

	const openTab = (next: PickerTab) => {
		// Re-tapping the active tab is a no-op: it must NOT reopen the picker
		// (which would clear edit mode and leak the edit draft into Create).
		if (open && next === tab) return;
		if (open && next !== tab && isEditing) leaveEdit();
		if (!open || next !== tab) resetFilters();
		// Capture the trigger BEFORE the panel (and the Custom form's focus
		// effect, which runs first for a child) can move focus, so closing
		// restores to the real trigger (P2-02).
		if (!open) {
			returnFocusRef.current = document.activeElement as HTMLElement | null;
		}
		onOpen(next);
	};

	// Every close path (Esc / scrim / close X / after Save) must drop an edit
	// draft, or the next Create reopens pre-filled with the edited part.
	const editingRef = useRef(false);
	editingRef.current = isEditing;
	const closePicker = () => {
		if (editingRef.current) {
			setCustomDraft((current) => emptyCustomPedalDraft(current.units));
			setBoardDraft((current) => emptyCustomBoardDraft(current.units));
		}
		onClose();
	};

	// Focus management: move focus into the picker on open, restore on close.
	// The Custom tab has no search field; its first field focuses itself on mount
	// (P2-02), so the search-ref focus here is simply a no-op there.
	useEffect(() => {
		if (open) {
			// Don't clobber a capture made in the open handler (mobile tab bar).
			if (!returnFocusRef.current) {
				returnFocusRef.current = document.activeElement as HTMLElement | null;
			}
			searchRef.current?.focus();
			return;
		}
		const returnTarget = returnFocusRef.current;
		if (returnTarget?.isConnected) {
			returnTarget.focus();
		} else {
			// The opener can unmount with the action it triggered (e.g. the P2-08
			// first-run note placing the first board): never drop focus to <body>.
			focusAddBoardTrigger();
		}
		returnFocusRef.current = null;
	}, [open]);

	// Esc closes from anywhere in the dialog (dropping an edit draft like the
	// other close paths, via the stable `editingRef`).
	useEffect(() => {
		if (!open) return;
		const onKey = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return;
			if (editingRef.current) {
				setCustomDraft((current) => emptyCustomPedalDraft(current.units));
				setBoardDraft((current) => emptyCustomBoardDraft(current.units));
			}
			onClose();
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
				const footprint = itemFootprint(item, customPedals);
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

	// Register the custom part, then place it exactly like a catalog pedal and
	// reset the draft so the sheet is ready for the next one.
	const handleCreate = (definition: CustomPedalDefinition) => {
		const refId = addCustomPedal(definition);
		const size = { widthCm: definition.widthCm, heightCm: definition.heightCm };
		if (targetBoard) {
			const footprint = boardFootprint(targetBoard);
			const base = centerOffset(
				footprint.widthCm,
				footprint.heightCm,
				size.widthCm,
				size.heightCm,
			);
			const pos = placeItem(base, size, occupied(targetBoard.uid), {
				bounds: footprint,
			});
			selectItem(addItem(refId, definition.category, targetBoard.uid, pos));
		} else {
			const { scale, x, y, size: viewportSize } = useViewport.getState();
			const center = viewportCenterCm(viewportSize, { scale, x, y });
			const base = {
				x: center.x - size.widthCm / 2,
				y: center.y - size.heightCm / 2,
			};
			const pos = placeItem(base, size, occupied(null));
			selectItem(addItem(refId, definition.category, null, pos));
		}
		setCustomDraft(emptyCustomPedalDraft(customDraft.units));
		onClose();
	};

	// Save an edited custom part in place: the definition updates, every placed
	// copy re-renders at the new name/footprint, and the selection stays (the
	// halo is the feedback — no toast).
	const handleSave = (definition: CustomPedalDefinition) => {
		if (editRefId) updateCustomPedal(editRefId, definition);
		closePicker();
	};

	// Register the custom board and place it at the viewport centre (like a
	// catalog board), then reset the draft.
	const handleCreateBoard = (definition: CustomBoardDefinition) => {
		const { scale, x, y, size: viewportSize } = useViewport.getState();
		const uid = addCustomBoard(
			definition,
			viewportCenterCm(viewportSize, { scale, x, y }),
		);
		selectBoard(uid);
		setBoardDraft((current) => emptyCustomBoardDraft(current.units));
		onClose();
	};

	// Save an edited custom board in place: size/texture/name update, the board
	// stays where it is (x/y/rotation untouched).
	const handleSaveBoard = (definition: CustomBoardDefinition) => {
		if (editBoardUid) updateCustomBoard(editBoardUid, definition);
		closePicker();
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
			'button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])';
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

	// ↑↓ browse the ledger, ↵ places. The catalog search field keeps arrow
	// navigation into the results (a listbox-search pattern), but every OTHER
	// text field, select, and the jack range slider keep their own arrows
	// (P2-02 — the custom form must not have its caret/stepping hijacked).
	const handlePanelKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
		trapTab(event);
		if (event.defaultPrevented) return;
		const target = event.target;
		const isSearchField =
			target instanceof HTMLInputElement && target.id === "picker-search";
		if (
			!isSearchField &&
			(target instanceof HTMLInputElement ||
				target instanceof HTMLTextAreaElement ||
				target instanceof HTMLSelectElement)
		) {
			return;
		}
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
	const isCustom = tab === "custom";
	const copy = TAB_COPY[tab];
	// Edit mode overrides the title/dialog (the eyebrow is a location label) and,
	// on mobile, swaps the placement hint for the part's identity. The Custom tab
	// is kind-aware: the board creator has its own title/hint (P2-05).
	const customTitle = isBoard
		? isEditingBoard
			? "Edit custom board"
			: "Add custom board"
		: isEditingPedal
			? "Edit custom part"
			: copy.title;
	const customDialog = isBoard
		? isEditingBoard
			? "Edit a custom board"
			: "Create a custom board"
		: isEditingPedal
			? "Edit a custom part"
			: copy.dialog;
	const title = isCustom ? customTitle : copy.title;
	const dialog = isCustom ? customDialog : copy.dialog;
	const hint = isEditingBoard
		? editedBoard
			? `${editedBoard.brand || "Custom"} · ${editedBoard.name || "Untitled board"}`
			: "Editing board"
		: isEditingPedal
			? editedPart
				? `${editedPart.brand || "Custom"} · ${editedPart.name || "Untitled part"}`
				: "Editing part"
			: isBoard
				? "Adds at the viewport centre"
				: isBoards
					? "Adds at the viewport centre"
					: targetBoard
						? "Adds to the selected board"
						: "No board — adds loosely";

	// The leading kind control for the Custom sheet (Pedal · Supply · Board).
	// It replaces the old in-form Type section; locked while editing (a part
	// cannot change kind after it exists).
	const kindSegment = (
		<Section label="Type">
			<fieldset
				className="segmented"
				data-testid="custom-category"
				disabled={isEditing}
			>
				<legend className="visually-hidden">Kind of part</legend>
				{(
					[
						["pedal", "Pedal"],
						["supply", "Supply"],
						["board", "Board"],
					] as const
				).map(([value, label]) => (
					<button
						key={value}
						type="button"
						className="segmented__option"
						data-testid={`custom-category-${value}`}
						aria-pressed={customKind === value}
						onClick={() => changeKind(value)}
					>
						{label}
					</button>
				))}
			</fieldset>
		</Section>
	);

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
				<PedalIcon size={18} className="picker-bar__icon" />
				Pedals
			</button>
			<button
				type="button"
				id="tab-bar-boards"
				className="picker-bar__tab"
				data-testid="picker-bar-boards"
				aria-current={tab === "boards" ? "true" : undefined}
				onClick={() => openTab("boards")}
			>
				<BoardIcon size={18} className="picker-bar__icon" />
				Boards
			</button>
			<button
				type="button"
				className="picker-bar__tab"
				data-testid="picker-bar-custom"
				aria-current={tab === "custom" ? "true" : undefined}
				onClick={() => openTab("custom")}
			>
				<CustomIcon size={18} className="picker-bar__icon" />
				Custom
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
						onClick={closePicker}
					/>
					<div
						ref={panelRef}
						className="picker__panel"
						data-testid="picker-panel"
						role="dialog"
						aria-modal="true"
						aria-label={dialog}
						onKeyDown={handlePanelKeyDown}
					>
						<div className="picker__handle" aria-hidden="true" />
						<header className="picker__header">
							<div className="picker__heading">
								<span className="picker__eyebrow">{copy.eyebrow}</span>
								<h2 className="picker__title">{title}</h2>
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
										<PedalIcon size={16} />
										Pedals
									</button>
									<button
										type="button"
										className="picker__segment"
										data-testid="picker-tab-boards"
										aria-pressed={tab === "boards"}
										onClick={() => changeTab("boards")}
									>
										<BoardIcon size={16} />
										Boards
									</button>
									<button
										type="button"
										className="picker__segment"
										data-testid="picker-tab-custom"
										aria-pressed={tab === "custom"}
										onClick={() => changeTab("custom")}
									>
										<CustomIcon size={16} />
										Custom
									</button>
								</div>
								<button
									type="button"
									className="picker__close"
									data-testid="picker-close"
									aria-label="Close"
									onClick={closePicker}
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

						{isCustom ? (
							isBoard ? (
								<CustomBoardForm
									draft={boardDraft}
									onChange={setBoardDraft}
									editing={isEditingBoard}
									headerSlot={kindSegment}
									onSubmit={
										isEditingBoard ? handleSaveBoard : handleCreateBoard
									}
								/>
							) : (
								<CustomPedalForm
									draft={customDraft}
									onChange={setCustomDraft}
									targetBoard={targetBoard}
									editing={isEditingPedal}
									headerSlot={kindSegment}
									onSubmit={isEditingPedal ? handleSave : handleCreate}
								/>
							)
						) : (
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
											<label
												className="visually-hidden"
												htmlFor="picker-search"
											>
												Search the catalog
											</label>
											<input
												id="picker-search"
												ref={searchRef}
												className="picker__search-input"
												data-testid="picker-search"
												type="search"
												placeholder={copy.search}
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
												{count} {copy.count}
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
												onChange={(event) =>
													setBrand(event.target.value || null)
												}
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
													<legend className="visually-hidden">
														Effect type
													</legend>
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

									<div className="picker__custom-line">
										<span className="picker__custom-prompt">Not listed?</span>
										<button
											type="button"
											className="picker__custom-link"
											data-testid="picker-custom-shortcut"
											onClick={() => openCustom(isBoards ? "board" : "pedal")}
										>
											{isBoards
												? "Create a custom-size board"
												: "Create a custom-size pedal"}
										</button>
									</div>

									<div className="picker__results" data-testid="picker-results">
										{count === 0 ? (
											<p className="picker__empty" data-testid="picker-empty">
												{copy.empty}
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

								<aside
									className="picker__specimen"
									data-testid="picker-specimen"
								>
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
						)}
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
	// CORS-first → cache-bust → no-CORS → failed (shared with the P2-03 panel).
	const { phase, url, crossOrigin, onError } = usePartImage(src);

	if (variant === "specimen") {
		if (phase === "failed") {
			return (
				<span
					className="specimen__img picker-item__thumb--empty"
					aria-hidden="true"
					data-empty="true"
				>
					{kind === "board" ? <BoardIcon size={22} strokeWidth={1.6} /> : null}
				</span>
			);
		}
		return (
			<img
				key={`${src}:${phase}`}
				className="specimen__img"
				src={url}
				alt=""
				loading="lazy"
				crossOrigin={crossOrigin}
				onError={onError}
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
				<BoardIcon size={22} strokeWidth={1.6} />
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
			src={url}
			alt=""
			loading="lazy"
			crossOrigin={crossOrigin}
			onError={onError}
		/>
	);
}
