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
	normalizeHexColor,
	SCENE_COLOR_OPTIONS,
	sceneColorLabel,
	sceneColorOption,
	sceneColorValue,
	sceneColorWarning,
} from "../lib/sceneColor";
import {
	ACTION_BAR_GAP,
	ACTION_BAR_MARGIN,
	SCENE_COLOR_POPOVER_HEIGHT as POPOVER_HEIGHT,
	SCENE_COLOR_POPOVER_WIDTH as POPOVER_WIDTH,
} from "./actionBarLayout";

/** A small painter's-palette glyph so the trigger reads as a color control,
 * never as a status LED. */
function PaletteIcon() {
	return (
		<svg
			width="17"
			height="17"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.7"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
			focusable="false"
		>
			<path d="M12 3a9 9 0 1 0 0 18c1.3 0 2.2-.9 2.2-2 0-.6-.2-1-.6-1.4-.4-.4-.6-.8-.6-1.3 0-1 .8-1.8 1.8-1.8H17a4 4 0 0 0 4-4c0-4.4-4-8-9-8Z" />
			<circle cx="7.5" cy="11.5" r="1" fill="currentColor" stroke="none" />
			<circle cx="10" cy="7.5" r="1" fill="currentColor" stroke="none" />
			<circle cx="14.5" cy="7.5" r="1" fill="currentColor" stroke="none" />
		</svg>
	);
}

interface SceneColorControlProps {
	/** Stored normalized hex, or undefined for Default. */
	value?: string;
	/** Visible/announced control name, e.g. "Organization color". */
	label: string;
	/** Test-id prefix, e.g. "item-color" / "board-color". */
	testId: string;
	/** Set or clear the color. `null` clears the field (Default). */
	onChange: (color: string | null) => void;
	/** Forwarded so the toolbar can include the trigger in its roving tabindex. */
	triggerRef?: (element: HTMLButtonElement | null) => void;
	tabIndex?: number;
	onFocus?: () => void;
}

/**
 * A compact organization-color trigger + anchored palette popover (F-16
 * "Field Marks"). One form on desktop and mobile so the dense item/board action
 * bars stay compact; the five inks come from Q-05 (one color vocabulary) and the
 * custom slot uses the native color input.
 *
 * The native color input is uncontrolled and commits on `change` (not React's
 * streaming `onChange`) so one pick = one undoable history step.
 */
export function SceneColorControl({
	value,
	label,
	testId,
	onChange,
	triggerRef,
	tabIndex = 0,
	onFocus,
}: SceneColorControlProps) {
	const normalized = sceneColorValue(value);
	const palette = sceneColorOption(value);
	const custom = value !== undefined && value.trim() !== "" && !palette;
	const warning = custom ? sceneColorWarning(value) : null;
	const currentLabel = sceneColorLabel(value);

	const triggerElement = useRef<HTMLButtonElement | null>(null);
	const popoverElement = useRef<HTMLDivElement>(null);
	const customInputElement = useRef<HTMLInputElement | null>(null);
	const [open, setOpen] = useState(false);
	const [position, setPosition] = useState({
		left: ACTION_BAR_MARGIN,
		top: ACTION_BAR_MARGIN,
	});

	const setTrigger = (node: HTMLButtonElement | null) => {
		triggerElement.current = node;
		triggerRef?.(node);
	};

	// Anchor the portal to the trigger using the **measured** popover size, so
	// the estimate can never leave it over the mobile HUD/sheet. Mobile opens
	// above the trigger when it fits (the canvas HUD + help FAB live below);
	// desktop opens below unless that would overflow.
	useLayoutEffect(() => {
		if (!open) return;
		const trigger = triggerElement.current;
		const popover = popoverElement.current;
		if (!trigger || !popover) return;
		const place = () => {
			const rect = trigger.getBoundingClientRect();
			const width = popover.offsetWidth || POPOVER_WIDTH;
			const height = popover.offsetHeight || POPOVER_HEIGHT;
			const viewportWidth = window.innerWidth;
			const viewportHeight = window.innerHeight;
			const left = Math.min(
				Math.max(ACTION_BAR_MARGIN, rect.left + rect.width / 2 - width / 2),
				Math.max(ACTION_BAR_MARGIN, viewportWidth - width - ACTION_BAR_MARGIN),
			);
			const gap = ACTION_BAR_GAP;
			const belowTop = rect.bottom + gap;
			const fitsBelow = belowTop + height <= viewportHeight - ACTION_BAR_MARGIN;
			const aboveTop = rect.top - height - gap;
			const fitsAbove = aboveTop >= ACTION_BAR_MARGIN;
			const mobile = viewportWidth <= 640;
			const above = mobile ? fitsAbove : !fitsBelow && fitsAbove;
			setPosition({
				left,
				top: above ? Math.max(ACTION_BAR_MARGIN, aboveTop) : belowTop,
			});
		};
		place();
		const observer = new ResizeObserver(place);
		observer.observe(popover);
		window.addEventListener("resize", place);
		window.addEventListener("scroll", place, true);
		return () => {
			observer.disconnect();
			window.removeEventListener("resize", place);
			window.removeEventListener("scroll", place, true);
		};
	}, [open]);

	// Focus the selected option, dismiss on outside press / Escape.
	useEffect(() => {
		if (!open) return;
		const popover = popoverElement.current;
		const checked = popover?.querySelector<HTMLInputElement>(
			'input[type="radio"]:checked',
		);
		const timer = window.setTimeout(() => checked?.focus(), 0);
		const onPointerDown = (event: PointerEvent) => {
			const target = event.target as Node;
			if (
				popover?.contains(target) ||
				triggerElement.current?.contains(target)
			) {
				return;
			}
			setOpen(false);
		};
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return;
			event.preventDefault();
			setOpen(false);
			triggerElement.current?.focus();
		};
		document.addEventListener("pointerdown", onPointerDown);
		document.addEventListener("keydown", onKeyDown);
		return () => {
			window.clearTimeout(timer);
			document.removeEventListener("pointerdown", onPointerDown);
			document.removeEventListener("keydown", onKeyDown);
		};
	}, [open]);

	// Uncontrolled custom input: attach a native `change` listener so the OS
	// picker's streamed `input` events cannot create a history step per pixel.
	const customValue = normalized ?? "#000000";
	const customValueRef = useRef(customValue);
	customValueRef.current = customValue;
	const commitRef = useRef<() => void>(() => undefined);
	commitRef.current = () => {
		const input = customInputElement.current;
		if (!input) return;
		const next = normalizeHexColor(input.value);
		if (next) onChange(next);
	};
	const handleCustomChange = useCallback(() => {
		commitRef.current();
	}, []);
	const setCustomInput = useCallback(
		(node: HTMLInputElement | null) => {
			const previous = customInputElement.current;
			if (previous) {
				previous.removeEventListener("change", handleCustomChange);
			}
			customInputElement.current = node;
			if (!node) return;
			node.value = customValueRef.current;
			node.addEventListener("change", handleCustomChange);
		},
		[handleCustomChange],
	);
	useEffect(() => {
		const input = customInputElement.current;
		if (input) input.value = customValue;
	}, [customValue]);

	const ringStyle = normalized
		? ({ "--scene-color": normalized } as CSSProperties)
		: undefined;
	const customRingStyle =
		custom && normalized
			? ({ "--scene-color": normalized } as CSSProperties)
			: undefined;
	const swatchClass = palette
		? `scene-color__swatch scene-color__swatch--${palette.id}`
		: custom
			? "scene-color__swatch scene-color__swatch--custom"
			: "scene-color__swatch scene-color__swatch--default";

	const options = (
		<>
			<label
				className="scene-color__option"
				data-testid={`${testId}-default`}
				title="No color"
			>
				<input
					type="radio"
					name={`${testId}-palette`}
					className="scene-color__control"
					value="default"
					checked={value === undefined || value.trim() === ""}
					onChange={() => onChange(null)}
					aria-label="No color"
				/>
				<span
					className="scene-color__swatch scene-color__swatch--default"
					aria-hidden="true"
				/>
			</label>
			{SCENE_COLOR_OPTIONS.map((option) => (
				<label
					key={option.id}
					className="scene-color__option"
					data-testid={`${testId}-${option.id}`}
					title={option.label}
				>
					<input
						type="radio"
						name={`${testId}-palette`}
						className="scene-color__control"
						value={option.id}
						checked={palette?.id === option.id}
						onChange={() => onChange(option.value)}
						aria-label={option.label}
					/>
					<span
						className={`scene-color__swatch scene-color__swatch--${option.id}`}
						aria-hidden="true"
					/>
				</label>
			))}
			<span className="scene-color__separator" aria-hidden="true" />
			<label
				className="scene-color__option scene-color__option--custom"
				data-testid={`${testId}-custom`}
				title={warning ?? "Custom color"}
				onClick={(event) => {
					// A checked radio does not fire `change`; reopen the OS picker
					// explicitly when a custom color is already selected.
					event.preventDefault();
					customInputElement.current?.click();
				}}
				onKeyDown={(event) => {
					if (event.key !== " " && event.key !== "Enter") return;
					event.preventDefault();
					customInputElement.current?.click();
				}}
			>
				<input
					type="radio"
					name={`${testId}-palette`}
					className="scene-color__control"
					value="custom"
					checked={custom}
					onChange={() => customInputElement.current?.click()}
					aria-label="Custom color"
				/>
				<input
					ref={setCustomInput}
					type="color"
					className="scene-color__custom-input"
					defaultValue={customValue}
					onClick={(event) => event.stopPropagation()}
					tabIndex={-1}
					aria-hidden="true"
					data-testid={`${testId}-custom-input`}
				/>
				<span
					className="scene-color__swatch scene-color__swatch--custom"
					data-filled={custom && normalized ? "true" : "false"}
					style={customRingStyle}
					aria-hidden="true"
				/>
				{warning ? (
					<span
						className="scene-color__warning"
						role="img"
						data-testid={`${testId}-warning`}
						title={warning}
						aria-label={warning}
					/>
				) : null}
			</label>
		</>
	);

	return (
		<>
			<button
				ref={setTrigger}
				type="button"
				className="item-action-bar__button scene-color__trigger"
				data-testid={`${testId}-trigger`}
				tabIndex={tabIndex}
				onFocus={onFocus}
				aria-haspopup="dialog"
				aria-expanded={open}
				aria-label={`${label}: ${currentLabel}`}
				title={`${label}: ${currentLabel}`}
				onClick={() => setOpen((current) => !current)}
			>
				<PaletteIcon />
				<span
					className={swatchClass}
					data-filled={custom && normalized ? "true" : "false"}
					style={ringStyle}
					aria-hidden="true"
				/>
				<span className="scene-color__label" aria-hidden="true">
					Color
				</span>
				{warning ? (
					<span
						className="scene-color__warning"
						role="img"
						data-testid={`${testId}-trigger-warning`}
						title={warning}
						aria-label={warning}
					/>
				) : null}
			</button>
			{open
				? createPortal(
						<div
							ref={popoverElement}
							className="scene-color__popover"
							role="dialog"
							aria-label={label}
							data-testid={`${testId}-popover`}
							style={{ left: `${position.left}px`, top: `${position.top}px` }}
						>
							<span className="scene-color__popover-header">{label}</span>
							<div
								className="scene-color__group"
								role="radiogroup"
								aria-label={label}
								data-testid={`${testId}-palette`}
							>
								{options}
							</div>
						</div>,
						document.body,
					)
				: null}
		</>
	);
}
