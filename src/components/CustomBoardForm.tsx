import { type ReactNode, useEffect, useRef, useState } from "react";
import { BOARD_TEXTURES, boardTextureLabel } from "../lib/boardTexture";
import {
	type CustomBoardDraft,
	type CustomBoardErrors,
	changeBoardDraftUnits,
	MAX_BOARD_DIMENSION_CM,
	setBoardDraftDimension,
	validateCustomBoardDraft,
} from "../lib/customBoard";
import { formatDimension, parseDimensionToCm } from "../lib/customPedal";
import type { CustomBoardDefinition } from "../state/scene";
import { PartDrawing } from "./PartDrawing";
import { Section } from "./SheetSection";

interface CustomBoardFormProps {
	/** Raw form state, owned by the picker so it survives close/tab switches. */
	draft: CustomBoardDraft;
	onChange: (draft: CustomBoardDraft) => void;
	/** Edit mode: the board already exists — saving updates it in place. */
	editing?: boolean;
	/** The leading kind control (Pedal · Supply · Board), rendered by the picker. */
	headerSlot?: ReactNode;
	/** Called with the validated definition when the CTA is pressed. */
	onSubmit: (definition: CustomBoardDefinition) => void;
}

/**
 * The custom board creator (P2-05, owner-approved "Substrate" direction): a
 * spec sheet (IDENTITY → FOOTPRINT → SURFACE) with a sticky CTA, beside a live
 * dimensioned drawing of the board in its chosen finish (desktop: right pane;
 * mobile: in-flow inside SURFACE). cm is canonical; the cm/in toggle only
 * re-derives the displayed number (`changeBoardDraftUnits`).
 */
export function CustomBoardForm({
	draft,
	onChange,
	editing = false,
	headerSlot,
	onSubmit,
}: CustomBoardFormProps) {
	// Inline errors only after a field has been touched (blurred), so an empty
	// form doesn't open covered in red.
	const [touched, setTouched] = useState<Record<string, boolean>>({});
	const validation = validateCustomBoardDraft(draft);
	const patch = (changes: Partial<CustomBoardDraft>) =>
		onChange({ ...draft, ...changes });
	const touch = (field: string) =>
		setTouched((current) =>
			current[field] ? current : { ...current, [field]: true },
		);
	const errorFor = (field: keyof CustomBoardErrors) =>
		touched[field] ? validation.errors[field] : undefined;

	// The Custom tab has no search field, so the first field claims focus when
	// the form mounts (a dialog should start inside itself).
	const brandRef = useRef<HTMLInputElement>(null);
	useEffect(() => {
		brandRef.current?.focus();
	}, []);

	const widthCm = parseDimensionToCm(draft.width, draft.units);
	const depthCm = parseDimensionToCm(draft.depth, draft.units);

	const submit = () => {
		if (validation.ok) onSubmit(validation.value);
	};

	const drawing = (
		<PartDrawing
			widthCm={widthCm}
			depthCm={depthCm}
			jacks={[]}
			units={draft.units}
			finish={draft.texture}
		/>
	);

	const unitsHelper =
		widthCm !== null && depthCm !== null
			? draft.units === "cm"
				? `≈ ${formatDimension(widthCm, "in")} × ${formatDimension(depthCm, "in")} in`
				: `≈ ${formatDimension(widthCm, "cm")} × ${formatDimension(depthCm, "cm")} cm`
			: "cm or in";

	return (
		<div className="picker__body picker__body--custom">
			<div className="custom__sheet">
				<div className="custom__scroll" data-testid="custom-scroll">
					{headerSlot}
					<Section label="Identity">
						<div className="custom__row custom__row--identity">
							<Field label="Brand" htmlFor="board-brand" optional>
								<input
									id="board-brand"
									ref={brandRef}
									className="custom__input"
									data-testid="board-brand"
									type="text"
									maxLength={60}
									placeholder="e.g. Acme"
									value={draft.brand}
									onChange={(event) => patch({ brand: event.target.value })}
								/>
							</Field>
							<Field label="Name" htmlFor="board-name" optional>
								<input
									id="board-name"
									className="custom__input"
									data-testid="board-name"
									type="text"
									maxLength={60}
									placeholder="e.g. Big Rig"
									value={draft.name}
									onChange={(event) => patch({ name: event.target.value })}
								/>
							</Field>
						</div>
					</Section>

					<Section
						label="Footprint"
						aside={
							<fieldset
								className="segmented segmented--compact"
								data-testid="board-units"
							>
								<legend className="visually-hidden">Units</legend>
								{(["cm", "in"] as const).map((unit) => (
									<button
										key={unit}
										type="button"
										className="segmented__option"
										data-testid={`board-units-${unit}`}
										aria-pressed={draft.units === unit}
										onClick={() => onChange(changeBoardDraftUnits(draft, unit))}
									>
										{unit}
									</button>
								))}
							</fieldset>
						}
					>
						<div className="custom__row">
							<Field
								label="Width"
								htmlFor="board-width"
								error={errorFor("width")}
								suffix={draft.units}
							>
								<input
									id="board-width"
									className="custom__input"
									data-testid="board-width"
									type="text"
									inputMode="decimal"
									placeholder="0"
									value={draft.width}
									onChange={(event) =>
										onChange(
											setBoardDraftDimension(
												draft,
												"width",
												event.target.value,
											),
										)
									}
									onBlur={() => touch("width")}
								/>
							</Field>
							<Field
								label="Depth"
								htmlFor="board-depth"
								error={errorFor("depth")}
								suffix={draft.units}
							>
								<input
									id="board-depth"
									className="custom__input"
									data-testid="board-depth"
									type="text"
									inputMode="decimal"
									placeholder="0"
									value={draft.depth}
									onChange={(event) =>
										onChange(
											setBoardDraftDimension(
												draft,
												"depth",
												event.target.value,
											),
										)
									}
									onBlur={() => touch("depth")}
								/>
							</Field>
							<span
								className="custom__helper"
								data-testid="board-dimension-helper"
							>
								{unitsHelper}
							</span>
						</div>
					</Section>

					<Section
						label="Surface"
						aside={<span className="custom__count">{draft.texture}</span>}
					>
						<div className="custom__drawing-inline" aria-hidden="true">
							{drawing}
						</div>
						<fieldset className="finish-grid" data-testid="board-finishes">
							<legend className="visually-hidden">Surface finish</legend>
							{BOARD_TEXTURES.map((texture) => (
								<label
									key={texture}
									className="finish-swatch"
									data-testid={`board-finish-${texture}`}
									data-checked={draft.texture === texture ? "true" : undefined}
								>
									<input
										type="radio"
										name="board-finish"
										className="finish-swatch__control"
										value={texture}
										checked={draft.texture === texture}
										onChange={() => patch({ texture })}
									/>
									<span
										className={`finish-swatch__tile finish-swatch__tile--${texture}`}
										aria-hidden="true"
									/>
									<span className="finish-swatch__label">
										{boardTextureLabel(texture)}
									</span>
								</label>
							))}
						</fieldset>
						<p className="custom__helper">
							The board surface only — accents and pedals sit on top. Max{" "}
							{MAX_BOARD_DIMENSION_CM} cm per side.
						</p>
					</Section>
				</div>

				<div
					className="custom__footer"
					data-editing={editing ? "true" : undefined}
				>
					<span className="custom__footer-hint">
						{editing
							? "Saves changes to this board"
							: "Adds at the viewport centre"}
					</span>
					<button
						type="button"
						className="custom__cta"
						data-testid="board-submit"
						disabled={!validation.ok}
						onClick={submit}
					>
						{editing ? "Save changes" : "Add custom board"}
					</button>
				</div>
			</div>

			<aside className="custom__drawing" aria-hidden="true">
				<span className="specimen__eyebrow">Drawing</span>
				<div className="custom__plate">{drawing}</div>
				<div className="custom__identity">
					<span className="custom__identity-brand">
						{draft.brand.trim() || "Custom"}
					</span>
					<span className="custom__identity-name">
						{draft.name.trim() || "Untitled board"}
					</span>
					<span
						className="custom__identity-dims"
						data-testid="board-identity-dims"
					>
						{widthCm !== null && depthCm !== null
							? `${formatDimension(widthCm, "cm")} × ${formatDimension(depthCm, "cm")} cm`
							: "—"}
					</span>
					<span className="custom__identity-dims">
						{boardTextureLabel(draft.texture)} finish
					</span>
				</div>
			</aside>
		</div>
	);
}

/** A labelled field with optional unit suffix + inline error. */
function Field({
	label,
	htmlFor,
	error,
	suffix,
	optional,
	children,
}: {
	label: string;
	htmlFor: string;
	error?: string;
	suffix?: string;
	optional?: boolean;
	children: ReactNode;
}) {
	return (
		<div className="custom__field">
			<label className="custom__label" htmlFor={htmlFor}>
				{label}
				{optional ? (
					<span className="custom__label-optional"> (optional)</span>
				) : null}
			</label>
			<div className="custom__control">
				{children}
				{suffix ? <span className="custom__suffix">{suffix}</span> : null}
			</div>
			{error ? (
				<p className="custom__error" role="alert">
					{error}
				</p>
			) : null}
		</div>
	);
}
