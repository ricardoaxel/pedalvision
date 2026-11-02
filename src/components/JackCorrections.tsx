import { useEffect, useId, useRef, useState } from "react";
import {
	JACK_EDGES,
	JACK_KINDS,
	type JackEdge,
	type JackKind,
} from "../catalog/schema";
import { JACK_EDGE_LABELS, jackKindLabel } from "../lib/customPedal";
import type { DisplayUnits } from "../lib/geometry";
import { formatJack, jackProvenance } from "../lib/partInfo";
import { type ResolvedJack, useScene } from "../state/scene";
import { ChevronIcon } from "./icons";
import { PART_PREVIEW_SIZES, PartDrawing } from "./PartDrawing";

type JackPatch = {
	kind?: JackKind;
	edge?: JackEdge;
	pos?: number;
	stereo?: boolean;
};

/**
 * F-33 “Proof Marks” jack/IO correction editor. It lives inside the existing
 * InfoPanel Jacks section (owner-approved direction, 2026-10-31): one inline
 * accordion editor at a time, per-jack provenance markers, an in-panel
 * schematic map, per-jack reset and a two-step “Reset all jacks”. Read-only
 * shares and custom pedals get static rows only.
 */
interface JackCorrectionsProps {
	itemUid: string;
	/** Effective jacks (base + local corrections). */
	jacks: ResolvedJack[];
	/** Catalog/fallback jacks before local corrections (baseline text). */
	baseJacks: ResolvedJack[];
	widthCm: number;
	heightCm: number;
	units: DisplayUnits;
	/** False in a read-only share or when the item is not editable. */
	editable: boolean;
	/** Custom parts keep their shared editor, so no per-instance controls. */
	isCustom: boolean;
}

export function JackCorrections({
	itemUid,
	jacks,
	baseJacks,
	widthCm,
	heightCm,
	units,
	editable,
	isCustom,
}: JackCorrectionsProps) {
	const [correcting, setCorrecting] = useState(false);
	const [openIndex, setOpenIndex] = useState<number | null>(null);
	const [draftPos, setDraftPos] = useState(0.5);
	const [refusal, setRefusal] = useState<{
		index: number;
		message: string;
	} | null>(null);
	const [resetArmed, setResetArmed] = useState(false);
	const setJackOverride = useScene((state) => state.setJackOverride);
	const resetJackOverride = useScene((state) => state.resetJackOverride);
	const resetAllJackOverrides = useScene(
		(state) => state.resetAllJackOverrides,
	);
	const cancelResetRef = useRef<HTMLButtonElement>(null);
	const rowRefs = useRef(new Map<number, HTMLButtonElement | null>());
	const panelIdBase = useId();

	const correctedCount = jacks.filter((jack) => jack.corrected === true).length;
	const canCorrect = editable && !isCustom && jacks.length > 0;
	const openJack = openIndex !== null ? jacks[openIndex] : undefined;

	// Keep the slider draft in sync with the committed effective position only
	// when the row opens or a commit changes it. Do not depend on the array
	// identity (InfoPanel re-derives it every render).
	const openPos = openJack?.pos;
	useEffect(() => {
		if (openIndex === null) return;
		setDraftPos(openPos ?? 0.5);
	}, [openIndex, openPos]);

	useEffect(() => {
		if (!resetArmed) return;
		cancelResetRef.current?.focus();
	}, [resetArmed]);

	if (jacks.length === 0) return null;

	const closeEditor = () => {
		setOpenIndex(null);
		setRefusal(null);
	};
	const exitMode = () => {
		setCorrecting(false);
		closeEditor();
		setResetArmed(false);
	};
	const toggleMode = () => {
		if (correcting) exitMode();
		else {
			setCorrecting(true);
			setRefusal(null);
		}
	};
	const toggleRow = (index: number) => {
		if (openIndex === index) {
			closeEditor();
			return;
		}
		setOpenIndex(index);
		setRefusal(null);
		setResetArmed(false);
	};
	const commit = (index: number, patch: JackPatch) => {
		const result = setJackOverride(itemUid, index, patch);
		if (!result.ok) {
			setRefusal({
				index,
				message: result.reason ?? "That correction couldn’t be applied.",
			});
			return false;
		}
		setRefusal(null);
		return true;
	};
	const commitPos = (index: number) => {
		const effective = jacks[index]?.pos ?? 0.5;
		if (Math.abs(draftPos - effective) < 1e-9) return;
		commit(index, { pos: draftPos });
	};
	const resetOne = (index: number) => {
		const result = resetJackOverride(itemUid, index);
		if (!result.ok) {
			setRefusal({
				index,
				message: result.reason ?? "That reset couldn’t be applied.",
			});
			return;
		}
		setRefusal(null);
	};
	const resetAll = () => {
		const result = resetAllJackOverrides(itemUid);
		setResetArmed(false);
		if (!result.ok) {
			setRefusal({
				index: -1,
				message: result.reason ?? "That reset couldn’t be applied.",
			});
			return;
		}
		closeEditor();
	};

	const schematicJacks = jacks.map((jack, index) => ({
		id: String(index),
		kind: jack.kind,
		edge: jack.edge,
		pos: index === openIndex ? draftPos : jack.pos,
	}));

	return (
		<section
			className="info-panel__section jack-correction"
			data-testid="info-jacks"
		>
			<div className="info-panel__section-head">
				<h3 className="info-panel__eyebrow">Jacks</h3>
				<div className="jack-correction__head-actions">
					<span className="info-panel__count" data-testid="info-jack-count">
						{jacks.length}
					</span>
					{canCorrect ? (
						<button
							type="button"
							className="jack-correction__mode"
							data-testid="jack-correct-toggle"
							aria-pressed={correcting}
							onClick={toggleMode}
						>
							{correcting ? "Done" : "Correct"}
						</button>
					) : null}
				</div>
			</div>

			<div className="jack-correction__map">
				<PartDrawing
					widthCm={widthCm}
					depthCm={heightCm}
					jacks={schematicJacks}
					units={units}
					activeJackId={openIndex !== null ? String(openIndex) : null}
					startSize={PART_PREVIEW_SIZES.pedal}
				/>
				<span className="jack-correction__map-caption">
					Jack map · schematic
				</span>
			</div>

			<ul className="jack-correction__rows">
				{jacks.map((jack, index) => {
					const provenance = jackProvenance(jack);
					const isOpen = correcting && openIndex === index;
					const rowPanelId = `${panelIdBase}-jack-${index}`;
					const summary = (
						<span className="jack-correction__summary">{formatJack(jack)}</span>
					);
					const marker = <JackMarker provenance={provenance} />;
					return (
						<li
							// biome-ignore lint/suspicious/noArrayIndexKey: jacks carry no id; the index is the cable reference
							key={`${jack.kind}-${jack.edge}-${jack.pos}-${index}`}
							className="jack-correction__row"
							data-open={isOpen ? "true" : undefined}
						>
							{correcting ? (
								<button
									ref={(node) => {
										rowRefs.current.set(index, node);
									}}
									type="button"
									className="jack-correction__trigger"
									aria-expanded={isOpen}
									aria-controls={rowPanelId}
									data-testid={`jack-row-${index}`}
									onClick={() => toggleRow(index)}
								>
									{summary}
									{marker}
									<ChevronIcon size={16} className="jack-correction__chevron" />
								</button>
							) : (
								<div
									className="jack-correction__trigger jack-correction__trigger--static"
									data-testid={`jack-row-${index}`}
								>
									{summary}
									{marker}
								</div>
							)}

							{isOpen && openJack ? (
								<div
									id={rowPanelId}
									className="jack-correction__editor"
									data-testid={`jack-editor-${index}`}
								>
									<label className="jack-correction__field">
										<span className="jack-correction__label">Kind</span>
										<select
											className="jack-correction__select"
											data-testid={`jack-kind-${index}`}
											value={jack.kind}
											onChange={(event) =>
												commit(index, {
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
									</label>

									<fieldset className="jack-correction__field">
										<legend className="jack-correction__label">Edge</legend>
										<div className="segmented segmented--compact jack-correction__edge">
											{JACK_EDGES.map((edge) => (
												<button
													key={edge}
													type="button"
													className="segmented__option"
													data-testid={`jack-edge-${index}-${edge}`}
													aria-pressed={jack.edge === edge}
													title={edge[0].toUpperCase() + edge.slice(1)}
													onClick={() =>
														commit(index, { edge: edge as JackEdge })
													}
												>
													{JACK_EDGE_LABELS[edge]}
												</button>
											))}
										</div>
									</fieldset>

									<label className="jack-correction__field jack-correction__position">
										<span className="jack-correction__label">Position</span>
										<input
											className="jack-correction__range"
											data-testid={`jack-pos-${index}`}
											type="range"
											min={0}
											max={1}
											step={0.05}
											value={draftPos}
											aria-valuetext={`${draftPos.toFixed(2)} along the ${jack.edge} edge`}
											onChange={(event) =>
												setDraftPos(Number(event.target.value))
											}
											onPointerUp={() => commitPos(index)}
											onBlur={() => commitPos(index)}
											onKeyUp={(event) => {
												if (event.key === "Enter") commitPos(index);
											}}
										/>
										<span className="jack-correction__pos">
											{draftPos.toFixed(2)}
										</span>
									</label>

									<label className="jack-correction__trs">
										<input
											type="checkbox"
											data-testid={`jack-stereo-${index}`}
											checked={jack.stereo === true}
											onChange={(event) =>
												commit(index, { stereo: event.target.checked })
											}
										/>
										<span>TRS · 2 cables</span>
									</label>

									{baseJacks[index] ? (
										<p className="jack-correction__baseline">
											Catalog {formatJack(baseJacks[index])}
										</p>
									) : null}

									{jack.corrected ? (
										<button
											type="button"
											className="jack-correction__reset"
											data-testid={`jack-reset-${index}`}
											onClick={() => resetOne(index)}
										>
											Reset to catalog
										</button>
									) : null}

									{refusal && refusal.index === index ? (
										<p
											className="jack-correction__refusal"
											data-testid={`jack-refusal-${index}`}
											role="alert"
										>
											{refusal.message}
										</p>
									) : null}
								</div>
							) : null}
						</li>
					);
				})}
			</ul>

			{isCustom ? (
				<p className="info-panel__assumed">
					Custom part — jacks are shared by every copy.
				</p>
			) : null}

			{correctedCount > 0 ? (
				<p className="info-panel__assumed" data-testid="jack-corrected-note">
					Corrections apply to this scene only.
				</p>
			) : null}

			{correcting && correctedCount > 0 ? (
				<footer className="jack-correction__footer">
					{resetArmed ? (
						<fieldset className="jack-correction__confirm" aria-live="polite">
							<legend className="visually-hidden">
								Confirm reset all jack corrections
							</legend>
							<span>
								Reset {correctedCount}{" "}
								{correctedCount === 1 ? "jack correction" : "jack corrections"}?
							</span>
							<div className="jack-correction__confirm-actions">
								<button
									ref={cancelResetRef}
									type="button"
									className="jack-correction__cancel"
									data-testid="jack-reset-all-cancel"
									onClick={() => setResetArmed(false)}
								>
									Cancel
								</button>
								<button
									type="button"
									className="jack-correction__reset jack-correction__reset--all"
									data-testid="jack-reset-all-confirm"
									onClick={resetAll}
								>
									Reset all
								</button>
							</div>
						</fieldset>
					) : (
						<button
							type="button"
							className="jack-correction__reset-all"
							data-testid="jack-reset-all"
							onClick={() => setResetArmed(true)}
						>
							Reset all jacks
						</button>
					)}
					{refusal && refusal.index === -1 ? (
						<p className="jack-correction__refusal" role="alert">
							{refusal.message}
						</p>
					) : null}
				</footer>
			) : null}
		</section>
	);
}

function JackMarker({
	provenance,
}: {
	provenance: "assumed" | "approximate" | "corrected" | null;
}) {
	if (provenance === null) return null;
	const label =
		provenance === "approximate"
			? "Approx"
			: provenance === "assumed"
				? "Assumed"
				: "Corrected";
	return (
		<span
			className="jack-correction__marker"
			data-provenance={provenance}
			data-testid={`jack-marker-${provenance}`}
		>
			<span className="jack-correction__marker-glyph" aria-hidden="true" />
			<span className="jack-correction__marker-label">{label}</span>
		</span>
	);
}
