import {
	type CSSProperties,
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { createPortal } from "react-dom";
import {
	CABLE_INK_OPTIONS,
	cableInkOption,
	cableInkWarning,
	normalizeHexColor,
} from "../lib/cableColor";
import { cableCurve, cablePointAt } from "../lib/cablePath";
import { cmToPx } from "../lib/geometry";
import { anchorIndexFor, cableEndAnchorFromIndex } from "../lib/jackAnchor";
import { useReadOnly } from "../state/readOnly";
import { useScene } from "../state/scene";
import {
	selectSelectedCableUid,
	selectSelectedEndpointUid,
	useSelection,
} from "../state/selection";
import { useSettings } from "../state/settings";
import { useViewport } from "../state/viewport";
import { canvasTheme } from "../styles/theme";
import {
	ACTION_BAR_GAP,
	ACTION_BAR_MARGIN,
	ACTION_BAR_MOBILE_MEDIA,
	ACTION_BAR_TAB_BAR_HEIGHT,
	INK_POPOVER_HEIGHT,
	INK_POPOVER_MEDIA,
	INK_POPOVER_WIDTH,
} from "./actionBarLayout";

/**
 * HTML action bar for a selected cable or endpoint (P4-02). Positioned from the
 * object's screen coordinates (never a Konva shape), clamped inside the canvas
 * pane and above the mobile tab bar.
 *
 * Q-05: on desktop the patch inks are inline; on a phone the bar is a compact
 * current-ink trigger + Delete, and the palette lives in an anchored popover.
 */
export function GraphActionBar() {
	const boards = useScene((state) => state.boards);
	const items = useScene((state) => state.items);
	const customPedals = useScene((state) => state.customPedals);
	const endpoints = useScene((state) => state.endpoints);
	const cables = useScene((state) => state.cables);
	const removeCable = useScene((state) => state.removeCable);
	const removeEndpoint = useScene((state) => state.removeEndpoint);
	const setCableColor = useScene((state) => state.setCableColor);
	const readOnly = useReadOnly((state) => state.readOnly);
	const showCables = useSettings((state) => state.showCables);
	const selectedCableUid = useSelection(selectSelectedCableUid);
	const selectedEndpointUid = useSelection(selectSelectedEndpointUid);
	const clearSelection = useSelection((state) => state.clearSelection);
	const scale = useViewport((state) => state.scale);
	const vx = useViewport((state) => state.x);
	const vy = useViewport((state) => state.y);
	const viewportSize = useViewport((state) => state.size);

	const barRef = useRef<HTMLDivElement>(null);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const popoverRef = useRef<HTMLDivElement>(null);
	const customInputRef = useRef<HTMLInputElement>(null);
	const [size, setSize] = useState({ width: 0, height: 0 });
	const [mobile, setMobile] = useState(false);
	const [compact, setCompact] = useState(false);
	const [inkOpen, setInkOpen] = useState(false);

	useEffect(() => {
		const tabQuery = window.matchMedia(ACTION_BAR_MOBILE_MEDIA);
		const inkQuery = window.matchMedia(INK_POPOVER_MEDIA);
		const updateTab = () => setMobile(tabQuery.matches);
		const updateInk = () => setCompact(inkQuery.matches);
		updateTab();
		updateInk();
		tabQuery.addEventListener("change", updateTab);
		inkQuery.addEventListener("change", updateInk);
		return () => {
			tabQuery.removeEventListener("change", updateTab);
			inkQuery.removeEventListener("change", updateInk);
		};
	}, []);

	const cable = selectedCableUid
		? cables.find((candidate) => candidate.uid === selectedCableUid)
		: undefined;
	const endpoint = selectedEndpointUid
		? endpoints.find((candidate) => candidate.uid === selectedEndpointUid)
		: undefined;
	const visible =
		!readOnly && showCables && (cable !== undefined || endpoint !== undefined);

	const storedInk = cable?.color?.trim() || undefined;
	const normalizedInk = normalizeHexColor(storedInk);
	const palette = cableInkOption(storedInk);
	const customInk = storedInk !== undefined && palette === undefined;
	const warning = customInk ? cableInkWarning(storedInk) : null;
	const customInputValue = normalizedInk ?? canvasTheme.cable;
	const customChipStyle =
		customInk && normalizedInk
			? ({ "--ink-custom": normalizedInk } as CSSProperties)
			: undefined;
	const chipClass = palette
		? `cable-ink__chip--${palette.id}`
		: customInk
			? "cable-ink__chip--custom"
			: "cable-ink__chip--default";
	const currentInkLabel = palette?.label ?? (customInk ? "Custom" : "Default");

	useEffect(() => {
		if (!visible || !compact) setInkOpen(false);
	}, [visible, compact]);

	const lastCableRef = useRef(selectedCableUid);
	useEffect(() => {
		if (lastCableRef.current === selectedCableUid) return;
		lastCableRef.current = selectedCableUid;
		setInkOpen(false);
	}, [selectedCableUid]);

	useLayoutEffect(() => {
		if (!visible) return;
		const bar = barRef.current;
		if (!bar) return;
		const measure = () => {
			setSize({ width: bar.offsetWidth, height: bar.offsetHeight });
		};
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(bar);
		return () => observer.disconnect();
	}, [visible]);

	useEffect(() => {
		if (!inkOpen) return;
		const popover = popoverRef.current;
		const checked = popover?.querySelector<HTMLInputElement>(
			'input[type="radio"]:checked',
		);
		const timer = window.setTimeout(() => checked?.focus(), 0);
		const onPointerDown = (event: PointerEvent) => {
			const target = event.target as Node;
			if (popover?.contains(target) || triggerRef.current?.contains(target)) {
				return;
			}
			setInkOpen(false);
		};
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return;
			event.preventDefault();
			setInkOpen(false);
			triggerRef.current?.focus();
		};
		document.addEventListener("pointerdown", onPointerDown);
		document.addEventListener("keydown", onKeyDown);
		return () => {
			window.clearTimeout(timer);
			document.removeEventListener("pointerdown", onPointerDown);
			document.removeEventListener("keydown", onKeyDown);
		};
	}, [inkOpen]);

	// The color input is uncontrolled: React's synthetic onChange streams while
	// the OS picker is open (many undo steps), so commit the native `change`
	// event instead (one pick = one step). A callback ref attaches the listener
	// whenever the input mounts (desktop inline / mobile popover).
	const customValueRef = useRef(customInputValue);
	customValueRef.current = customInputValue;
	const customCommitRef = useRef<() => void>(() => undefined);
	customCommitRef.current = () => {
		const input = customInputRef.current;
		if (!input || !cable) return;
		const next = normalizeHexColor(input.value);
		if (next) setCableColor(cable.uid, next);
	};
	const handleCustomChange = useCallback(() => {
		customCommitRef.current();
	}, []);
	const setCustomInput = useCallback(
		(node: HTMLInputElement | null) => {
			if (customInputRef.current) {
				customInputRef.current.removeEventListener(
					"change",
					handleCustomChange,
				);
			}
			customInputRef.current = node;
			if (!node) return;
			node.value = customValueRef.current;
			node.addEventListener("change", handleCustomChange);
		},
		[handleCustomChange],
	);
	useEffect(() => {
		const input = customInputRef.current;
		if (input) input.value = customInputValue;
	}, [customInputValue]);

	if (!visible) return null;

	let anchorX = 0;
	let anchorY = 0;
	if (cable) {
		const index = anchorIndexFor({ boards, items, customPedals, endpoints });
		const from = cableEndAnchorFromIndex(cable.from, index);
		const to = cableEndAnchorFromIndex(cable.to, index);
		if (from && to) {
			const curve = cableCurve(from, to, Math.max(scale, 0.0001));
			const midpoint = cablePointAt(curve, 0.5);
			anchorX = midpoint.x * scale + vx;
			anchorY = midpoint.y * scale + vy;
		} else {
			return null;
		}
	} else if (endpoint) {
		anchorX = cmToPx(endpoint.x) * scale + vx;
		anchorY = cmToPx(endpoint.y) * scale + vy;
	}

	const half = size.width / 2;
	const viewportMin = half + ACTION_BAR_MARGIN;
	const viewportMax = Math.max(
		viewportMin,
		viewportSize.width - half - ACTION_BAR_MARGIN,
	);
	const bottomReserve = mobile ? ACTION_BAR_TAB_BAR_HEIGHT : 0;
	const left = Math.min(viewportMax, Math.max(viewportMin, anchorX));
	const top = Math.min(
		Math.max(
			ACTION_BAR_MARGIN,
			viewportSize.height - bottomReserve - size.height - ACTION_BAR_MARGIN,
		),
		Math.max(ACTION_BAR_MARGIN, anchorY + ACTION_BAR_GAP),
	);

	// Popover position: viewport-fixed (portaled) so the bar transform cannot
	// skew or clip it. Prefer below the bar; flip above when the phone's bottom
	// reserve leaves no room. Centre on the trigger and keep an 8px inset.
	const triggerCenterX = left - size.width / 2 + ACTION_BAR_MARGIN + 22;
	const popoverLeft = Math.min(
		Math.max(ACTION_BAR_MARGIN, triggerCenterX - INK_POPOVER_WIDTH / 2),
		Math.max(
			ACTION_BAR_MARGIN,
			viewportSize.width - INK_POPOVER_WIDTH - ACTION_BAR_MARGIN,
		),
	);
	const belowTop = top + size.height + ACTION_BAR_GAP;
	const roomBelow =
		viewportSize.height - bottomReserve - ACTION_BAR_MARGIN - belowTop;
	const below = roomBelow >= INK_POPOVER_HEIGHT;
	const placement = below ? "below" : "above";
	const popoverTop = below
		? belowTop
		: Math.max(ACTION_BAR_MARGIN, top - INK_POPOVER_HEIGHT - ACTION_BAR_GAP);

	const remove = () => {
		if (cable) removeCable(cable.uid);
		if (endpoint) removeEndpoint(endpoint.uid);
		clearSelection();
	};

	const customOption = cable ? (
		<label
			className="cable-ink__option cable-ink__option--custom"
			data-testid="cable-ink-custom"
			title={warning ?? "Custom ink"}
			onClick={(event) => {
				// A checked radio does not fire `change`, so an existing custom ink
				// must re-open the picker from the explicit click.
				event.preventDefault();
				customInputRef.current?.click();
			}}
			onKeyDown={(event) => {
				if (event.key !== " " && event.key !== "Enter") return;
				event.preventDefault();
				customInputRef.current?.click();
			}}
		>
			<input
				type="radio"
				name="cable-ink"
				className="cable-ink__control"
				value="custom"
				checked={customInk}
				onChange={() => customInputRef.current?.click()}
				aria-label="Custom ink"
			/>
			<input
				ref={setCustomInput}
				type="color"
				className="cable-ink__custom-input"
				defaultValue={customInputValue}
				onClick={(event) => event.stopPropagation()}
				tabIndex={-1}
				aria-hidden="true"
				data-testid="cable-ink-custom-input"
			/>
			<span
				className="cable-ink__chip cable-ink__chip--custom"
				data-filled={customInk && normalizedInk ? "true" : "false"}
				style={customChipStyle}
				aria-hidden="true"
			/>
			{warning ? (
				<span
					className="cable-ink__warning"
					role="img"
					data-testid="cable-ink-warning"
					title={warning}
					aria-label={warning}
				/>
			) : null}
		</label>
	) : null;

	const inkOptions = cable ? (
		<>
			<label
				className="cable-ink__option"
				data-testid="cable-ink-default"
				title="Default ink"
			>
				<input
					type="radio"
					name="cable-ink"
					className="cable-ink__control"
					value="default"
					checked={storedInk === undefined}
					onChange={() => setCableColor(cable.uid, null)}
					aria-label="Default ink"
				/>
				<span
					className="cable-ink__chip cable-ink__chip--default"
					aria-hidden="true"
				/>
			</label>
			{CABLE_INK_OPTIONS.map((option) => (
				<label
					key={option.id}
					className="cable-ink__option"
					data-testid={`cable-ink-${option.id}`}
					title={option.label}
				>
					<input
						type="radio"
						name="cable-ink"
						className="cable-ink__control"
						value={option.id}
						checked={palette?.id === option.id}
						onChange={() => setCableColor(cable.uid, option.value)}
						aria-label={option.label}
					/>
					<span
						className={`cable-ink__chip cable-ink__chip--${option.id}`}
						aria-hidden="true"
					/>
				</label>
			))}
			{customOption}
		</>
	) : null;

	const trigger = cable ? (
		<button
			ref={triggerRef}
			type="button"
			className="cable-ink__trigger"
			data-testid="cable-ink-trigger"
			aria-haspopup="dialog"
			aria-expanded={inkOpen}
			aria-label={`Patch ink: ${currentInkLabel}`}
			onClick={() => setInkOpen((open) => !open)}
		>
			<span
				className={`cable-ink__chip ${chipClass}`}
				data-filled={customInk && normalizedInk ? "true" : "false"}
				style={customChipStyle}
				aria-hidden="true"
			/>
			<svg
				className="cable-ink__chevron"
				width="10"
				height="10"
				viewBox="0 0 10 10"
				fill="none"
				aria-hidden="true"
				focusable="false"
			>
				<path
					d="M2 4l3 3 3-3"
					stroke="currentColor"
					strokeWidth="1.5"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
			</svg>
			{warning ? (
				<span
					className="cable-ink__warning"
					role="img"
					data-testid="cable-ink-trigger-warning"
					title={warning}
					aria-label={warning}
				/>
			) : null}
		</button>
	) : null;

	return (
		<div
			ref={barRef}
			className="item-action-bar graph-action-bar"
			data-testid="graph-action-bar"
			role="toolbar"
			aria-label={
				cable ? "Selected cable actions" : "Selected endpoint actions"
			}
			style={{ left: `${left}px`, top: `${top}px` }}
		>
			{cable ? (
				<div className="cable-ink">
					{compact ? (
						<>
							{trigger}
							{inkOpen
								? createPortal(
										<div
											ref={popoverRef}
											className="cable-ink__popover"
											role="dialog"
											aria-label="Patch ink"
											data-testid="cable-ink-popover"
											data-placement={placement}
											style={{
												left: `${popoverLeft}px`,
												top: `${popoverTop}px`,
											}}
										>
											<span className="cable-ink__popover-header">
												Patch ink
											</span>
											<div
												className="cable-ink__group"
												role="radiogroup"
												aria-label="Cable ink"
												data-testid="cable-ink-palette"
											>
												{inkOptions}
											</div>
										</div>,
										document.body,
									)
								: null}
						</>
					) : (
						<>
							<span className="cable-ink__legend" id="cable-ink-label">
								Patch ink
							</span>
							<div
								className="cable-ink__group"
								role="radiogroup"
								aria-labelledby="cable-ink-label"
								data-testid="cable-ink-palette"
							>
								{inkOptions}
							</div>
						</>
					)}
				</div>
			) : null}
			{cable ? (
				<span className="graph-action-bar__divider" aria-hidden="true" />
			) : null}
			<button
				type="button"
				className={`item-action-bar__button ${
					cable
						? "item-action-bar__button--graph-delete"
						: "item-action-bar__button--danger"
				}`}
				data-testid="delete-graph-item"
				aria-label={cable ? "Delete cable" : "Delete endpoint"}
				onClick={remove}
			>
				{cable ? "Delete cable" : "Delete endpoint"}
			</button>
		</div>
	);
}
