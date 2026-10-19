import { type ReactNode, useEffect, useRef, useState } from "react";
import {
	EFFECT_TYPES,
	type EffectType,
	JACK_EDGES,
	JACK_KINDS,
	type JackEdge,
	type JackKind,
} from "../catalog/schema";
import {
	type CustomPedalDraft,
	type CustomPedalErrors,
	changeDraftUnits,
	formatDimension,
	JACK_EDGE_LABELS,
	jackKindLabel,
	parseDimensionToCm,
	setDraftDimension,
	validateCustomPedalDraft,
} from "../lib/customPedal";
import type { CustomPedalDefinition, PlacedBoard } from "../state/scene";
import { PartDrawing } from "./PartDrawing";
import { effectLabel } from "./pickerFilter";

/** Effect chips shown before the "All types" reveal (mirrors the picker). */
const EFFECT_CHIP_PREVIEW = 8;

interface CustomPedalFormProps {
	/** Raw form state, owned by the picker so it survives close/tab switches. */
	draft: CustomPedalDraft;
	onChange: (draft: CustomPedalDraft) => void;
	/** The board a created part will attach to (null → loose). */
	targetBoard: PlacedBoard | null;
	/** Edit mode: the part already exists — saving updates it in place. */
	editing?: boolean;
	/** The leading kind control (Pedal · Supply · Board), rendered by the picker. */
	headerSlot?: ReactNode;
	/** Called with the validated definition when the CTA is pressed. */
	onSubmit: (definition: CustomPedalDefinition) => void;
}

/**
 * The custom pedal/supply creator (F7/P2-02) — the owner-approved "Datasheet"
 * direction: a spec sheet (TYPE → IDENTITY → FOOTPRINT → EFFECTS → JACKS →
 * POWER) with a sticky CTA, beside a live dimensioned **drawing** of the part
 * (desktop: the right pane; mobile: in-flow above the jack rows, since the sheet
 * has no second pane). The jack editor maps one row → one dot on the drawing;
 * the row being edited is the accent dot. cm is canonical; the cm/in toggle
 * only re-derives the displayed number (`changeDraftUnits`).
 *
 * The draft lives in `Picker` (controlled) so Esc/close/tab-switch never
 * discards a part the user was filling in.
 */
export function CustomPedalForm({
	draft,
	onChange,
	targetBoard,
	editing = false,
	headerSlot,
	onSubmit,
}: CustomPedalFormProps) {
	const [activeJackId, setActiveJackId] = useState<string | null>(null);
	const [showAllEffects, setShowAllEffects] = useState(false);
	// Inline errors only after a field has been touched (blurred), so an empty
	// form doesn't open covered in red.
	const [touched, setTouched] = useState<Record<string, boolean>>({});
	const validation = validateCustomPedalDraft(draft);
	const isSupply = draft.category === "supply";
	const patch = (changes: Partial<CustomPedalDraft>) =>
		onChange({ ...draft, ...changes });
	const touch = (field: string) =>
		setTouched((current) =>
			current[field] ? current : { ...current, [field]: true },
		);
	const errorFor = (field: keyof CustomPedalErrors) =>
		touched[field] ? validation.errors[field] : undefined;

	// The Custom tab has no search field, so the first field claims focus when
	// the form mounts (a dialog should start inside itself, P2-02).
	const nameRef = useRef<HTMLInputElement>(null);
	useEffect(() => {
		nameRef.current?.focus();
	}, []);

	const addJack = () => {
		const jack = {
			id: crypto.randomUUID(),
			kind: "in" as JackKind,
			edge: "top" as JackEdge,
			pos: 0.5,
		};
		onChange({ ...draft, jacks: [...draft.jacks, jack] });
		setActiveJackId(jack.id);
	};
	const updateJack = (
		id: string,
		changes: Partial<CustomPedalDraft["jacks"][number]>,
	) =>
		onChange({
			...draft,
			jacks: draft.jacks.map((jack) =>
				jack.id === id ? { ...jack, ...changes } : jack,
			),
		});
	const removeJack = (id: string) => {
		onChange({ ...draft, jacks: draft.jacks.filter((jack) => jack.id !== id) });
		if (activeJackId === id) setActiveJackId(null);
	};

	const widthCm = parseDimensionToCm(draft.width, draft.units);
	const depthCm = parseDimensionToCm(draft.depth, draft.units);

	const effectPreview = EFFECT_TYPES.slice(0, EFFECT_CHIP_PREVIEW);
	const visibleEffects = showAllEffects
		? EFFECT_TYPES
		: [
				...effectPreview,
				...draft.effectTypes.filter((type) => !effectPreview.includes(type)),
			];

	const toggleEffect = (type: EffectType) =>
		patch({
			effectTypes: draft.effectTypes.includes(type)
				? draft.effectTypes.filter((candidate) => candidate !== type)
				: [...draft.effectTypes, type],
		});

	const submit = () => {
		if (validation.ok) onSubmit(validation.value);
	};

	const drawing = (
		<PartDrawing
			widthCm={widthCm}
			depthCm={depthCm}
			jacks={draft.jacks}
			units={draft.units}
			activeJackId={activeJackId}
		/>
	);

	return (
		<div className="picker__body picker__body--custom">
			<div className="custom__sheet">
				<div className="custom__scroll" data-testid="custom-scroll">
					{headerSlot}
					<Section label="Identity">
						<div className="custom__row custom__row--identity">
							<Field label="Brand" htmlFor="custom-brand">
								<input
									id="custom-brand"
									className="custom__input"
									data-testid="custom-brand"
									type="text"
									maxLength={60}
									placeholder="e.g. Acme"
									value={draft.brand}
									onChange={(event) => patch({ brand: event.target.value })}
								/>
							</Field>
							<Field
								label="Name"
								htmlFor="custom-name"
								error={errorFor("name")}
							>
								<input
									id="custom-name"
									ref={nameRef}
									className="custom__input"
									data-testid="custom-name"
									type="text"
									maxLength={60}
									placeholder="e.g. Deluxe Fuzz"
									value={draft.name}
									onChange={(event) => patch({ name: event.target.value })}
									onBlur={() => touch("name")}
								/>
							</Field>
						</div>
					</Section>

					<Section
						label="Footprint"
						aside={
							<fieldset
								className="segmented segmented--compact"
								data-testid="custom-units"
							>
								<legend className="visually-hidden">Units</legend>
								{(["cm", "in"] as const).map((unit) => (
									<button
										key={unit}
										type="button"
										className="segmented__option"
										data-testid={`custom-units-${unit}`}
										aria-pressed={draft.units === unit}
										onClick={() => onChange(changeDraftUnits(draft, unit))}
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
								htmlFor="custom-width"
								error={errorFor("width")}
								suffix={draft.units}
							>
								<input
									id="custom-width"
									className="custom__input"
									data-testid="custom-width"
									type="text"
									inputMode="decimal"
									placeholder="0"
									value={draft.width}
									onChange={(event) =>
										onChange(
											setDraftDimension(draft, "width", event.target.value),
										)
									}
									onBlur={() => touch("width")}
								/>
							</Field>
							<Field
								label="Depth"
								htmlFor="custom-depth"
								error={errorFor("depth")}
								suffix={draft.units}
							>
								<input
									id="custom-depth"
									className="custom__input"
									data-testid="custom-depth"
									type="text"
									inputMode="decimal"
									placeholder="0"
									value={draft.depth}
									onChange={(event) =>
										onChange(
											setDraftDimension(draft, "depth", event.target.value),
										)
									}
									onBlur={() => touch("depth")}
								/>
							</Field>
							<span
								className="custom__helper"
								data-testid="custom-dimension-helper"
							>
								{widthCm !== null && depthCm !== null
									? `≈ ${formatDimension(widthCm, "in")} × ${formatDimension(depthCm, "in")} in`
									: "cm or in"}
							</span>
						</div>
					</Section>

					{isSupply ? null : (
						<Section label="Effects">
							<fieldset className="custom__chips">
								<legend className="visually-hidden">Effect type</legend>
								{visibleEffects.map((type) => (
									<button
										key={type}
										type="button"
										className="picker__chip"
										data-testid={`custom-effect-${type}`}
										aria-pressed={draft.effectTypes.includes(type)}
										onClick={() => toggleEffect(type)}
									>
										{effectLabel(type)}
									</button>
								))}
								<button
									type="button"
									className="picker__chip picker__chip--more"
									data-testid="custom-effects-toggle"
									aria-expanded={showAllEffects}
									onClick={() => setShowAllEffects((value) => !value)}
								>
									{showAllEffects ? "Fewer" : "All types"}
								</button>
							</fieldset>
						</Section>
					)}

					<Section
						label="Jacks"
						aside={<span className="custom__count">{draft.jacks.length}</span>}
					>
						<div className="custom__drawing-inline" aria-hidden="true">
							{drawing}
						</div>
						{draft.jacks.length === 0 ? (
							<p className="custom__empty">No jack locations yet.</p>
						) : (
							<ul className="custom__jacks" data-testid="custom-jacks">
								{draft.jacks.map((jack) => (
									<li
										key={jack.id}
										className="custom__jack"
										data-active={jack.id === activeJackId ? "true" : undefined}
										onMouseEnter={() => setActiveJackId(jack.id)}
										onMouseLeave={() => setActiveJackId(null)}
									>
										<label
											className="visually-hidden"
											htmlFor={`jack-kind-${jack.id}`}
										>
											Jack kind
										</label>
										<select
											id={`jack-kind-${jack.id}`}
											className="picker__brand custom__jack-kind"
											data-testid={`custom-jack-kind-${jack.id}`}
											value={jack.kind}
											onFocus={() => setActiveJackId(jack.id)}
											onChange={(event) =>
												updateJack(jack.id, {
													kind: event.target.value as JackKind,
												})
											}
										>
											{JACK_KINDS.map((kind) => (
												<option key={kind} value={kind}>
													{jackKindLabel(kind)}
												</option>
											))}
										</select>

										<fieldset className="segmented segmented--compact custom__edge">
											<legend className="visually-hidden">Jack edge</legend>
											{JACK_EDGES.map((edge) => (
												<button
													key={edge}
													type="button"
													className="segmented__option"
													data-testid={`custom-jack-edge-${jack.id}-${edge}`}
													aria-pressed={jack.edge === edge}
													title={`${edge[0].toUpperCase()}${edge.slice(1)}`}
													onFocus={() => setActiveJackId(jack.id)}
													onClick={() => updateJack(jack.id, { edge })}
												>
													{JACK_EDGE_LABELS[edge]}
												</button>
											))}
										</fieldset>

										<label
											className="visually-hidden"
											htmlFor={`jack-pos-${jack.id}`}
										>
											Position along the edge
										</label>
										<input
											id={`jack-pos-${jack.id}`}
											className="custom__range"
											data-testid={`custom-jack-pos-${jack.id}`}
											type="range"
											min={0}
											max={1}
											step={0.05}
											value={jack.pos}
											onFocus={() => setActiveJackId(jack.id)}
											onChange={(event) =>
												updateJack(jack.id, { pos: Number(event.target.value) })
											}
										/>
										<span className="custom__pos">{jack.pos.toFixed(2)}</span>

										<button
											type="button"
											className="custom__jack-remove"
											data-testid={`custom-jack-remove-${jack.id}`}
											aria-label="Remove jack"
											onClick={() => removeJack(jack.id)}
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
									</li>
								))}
							</ul>
						)}
						<button
							type="button"
							className="custom__add-jack"
							data-testid="custom-add-jack"
							onClick={addJack}
						>
							+ Add jack
						</button>
					</Section>

					<Section label="Power">
						{isSupply ? null : (
							<label className="custom__toggle">
								<input
									type="checkbox"
									data-testid="custom-power-toggle"
									checked={draft.powerEnabled}
									onChange={(event) =>
										patch({ powerEnabled: event.target.checked })
									}
								/>
								Powered
							</label>
						)}
						{isSupply || draft.powerEnabled ? (
							<div className="custom__row">
								<Field
									label="Voltage"
									htmlFor="custom-voltage"
									error={errorFor("voltage")}
									suffix="V"
								>
									<input
										id="custom-voltage"
										className="custom__input"
										data-testid="custom-voltage"
										type="text"
										inputMode="decimal"
										value={draft.voltage}
										onChange={(event) => patch({ voltage: event.target.value })}
										onBlur={() => touch("voltage")}
									/>
								</Field>
								<div className="custom__field custom__field--polarity">
									<span className="custom__label">Current</span>
									<div className="custom__current">
										<fieldset
											className="segmented segmented--compact"
											data-testid="custom-acdc"
										>
											<legend className="visually-hidden">AC or DC</legend>
											{(["DC", "AC"] as const).map((value) => (
												<button
													key={value}
													type="button"
													className="segmented__option"
													data-testid={`custom-acdc-${value}`}
													aria-pressed={draft.acDc === value}
													onClick={() => patch({ acDc: value })}
												>
													{value}
												</button>
											))}
										</fieldset>
										<input
											className="custom__input custom__input--ma"
											data-testid="custom-current"
											type="text"
											inputMode="decimal"
											aria-label="Current in milliamps"
											value={draft.currentMa}
											onChange={(event) =>
												patch({ currentMa: event.target.value })
											}
											onBlur={() => touch("currentMa")}
										/>
										<span className="custom__suffix">mA</span>
									</div>
									{errorFor("currentMa") ? (
										<p className="custom__error" role="alert">
											{errorFor("currentMa")}
										</p>
									) : null}
								</div>
							</div>
						) : (
							<p className="custom__empty">No power required for this pedal.</p>
						)}
					</Section>
				</div>

				<div
					className="custom__footer"
					data-editing={editing ? "true" : undefined}
				>
					<span className="custom__footer-hint">
						{editing
							? "Updates all placed copies"
							: targetBoard
								? "Adds to the selected board"
								: "No board — adds loosely"}
					</span>
					<button
						type="button"
						className="custom__cta"
						data-testid="custom-submit"
						disabled={!validation.ok}
						onClick={submit}
					>
						{editing ? "Save changes" : "Add custom part"}
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
						{draft.name.trim() || "Untitled part"}
					</span>
					<span
						className="custom__identity-dims"
						data-testid="custom-identity-dims"
					>
						{widthCm !== null && depthCm !== null
							? `${formatDimension(widthCm, "cm")} × ${formatDimension(depthCm, "cm")} cm`
							: "—"}
					</span>
				</div>
			</aside>
		</div>
	);
}

/** A titled spec-sheet section (mono eyebrow + optional right-aligned aside). */
function Section({
	label,
	aside,
	children,
}: {
	label: string;
	aside?: ReactNode;
	children: ReactNode;
}) {
	return (
		<section className="custom__section">
			<div className="custom__section-head">
				<h3 className="custom__eyebrow">{label}</h3>
				{aside}
			</div>
			{children}
		</section>
	);
}

/** A labelled field with optional unit suffix + inline error. */
function Field({
	label,
	htmlFor,
	error,
	suffix,
	children,
}: {
	label: string;
	htmlFor: string;
	error?: string;
	suffix?: string;
	children: ReactNode;
}) {
	return (
		<div className="custom__field">
			<label className="custom__label" htmlFor={htmlFor}>
				{label}
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
