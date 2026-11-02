import { useEffect, useId, useRef, useState } from "react";
import { JACK_KINDS, type JackKind } from "../catalog/schema";
import { jackKindLabel } from "../lib/customPedal";
import type { DisplayUnits } from "../lib/geometry";
import {
	formatJackPosition,
	JACK_EDGE_NAMES,
	jackKindLabelAt,
	jackProvenance,
} from "../lib/partInfo";
import { useJackProof } from "../state/jackProof";
import { type ResolvedJack, useScene } from "../state/scene";
import { ChevronIcon } from "./icons";

type JackPatch = {
	kind?: JackKind;
	stereo?: boolean;
};

/**
 * F-33 “Press Proof” ledger. The canvas is the schematic: entering Correct
 * turns every effective jack on the real pedal into a draggable pin. The panel
 * keeps the provenance rows, kind/TRS, reset and the position readout, and is
 * the accessible/keyboard proxy for the canvas pins.
 */
interface JackCorrectionsProps {
	itemUid: string;
	jacks: ResolvedJack[];
	baseJacks: ResolvedJack[];
	widthCm: number;
	heightCm: number;
	units: DisplayUnits;
	editable: boolean;
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
	const activeUid = useJackProof((state) => state.activeUid);
	const selectedJack = useJackProof((state) => state.selectedJack);
	const notice = useJackProof((state) => state.notice);
	const select = useJackProof((state) => state.select);
	const beginProof = useJackProof((state) => state.begin);
	const exitProof = useJackProof((state) => state.exit);
	const setJackOverride = useScene((state) => state.setJackOverride);
	const resetJackOverride = useScene((state) => state.resetJackOverride);
	const resetAllJackOverrides = useScene(
		(state) => state.resetAllJackOverrides,
	);
	const [resetArmed, setResetArmed] = useState(false);
	const cancelResetRef = useRef<HTMLButtonElement>(null);
	const panelIdBase = useId();

	const correcting = activeUid === itemUid;
	const correctedCount = jacks.filter((jack) => jack.corrected === true).length;
	const canCorrect = editable && !isCustom && jacks.length > 0;
	const openIndex = correcting ? selectedJack : null;
	const openJack = openIndex !== null ? jacks[openIndex] : undefined;

	useEffect(() => {
		if (!resetArmed) return;
		cancelResetRef.current?.focus();
	}, [resetArmed]);

	if (jacks.length === 0) return null;

	const toggleMode = () => {
		if (correcting) {
			exitProof();
			setResetArmed(false);
			return;
		}
		beginProof(itemUid);
	};
	const commit = (index: number, patch: JackPatch) => {
		const result = setJackOverride(itemUid, index, patch);
		if (!result.ok) {
			useJackProof
				.getState()
				.setNotice(result.reason ?? "That correction couldn’t be applied.");
		} else {
			useJackProof.getState().setNotice(null);
		}
	};
	const resetOne = (index: number) => {
		const result = resetJackOverride(itemUid, index);
		if (!result.ok) {
			useJackProof
				.getState()
				.setNotice(result.reason ?? "That reset couldn’t be applied.");
			return;
		}
		useJackProof.getState().setNotice(null);
	};
	const resetAll = () => {
		const result = resetAllJackOverrides(itemUid);
		setResetArmed(false);
		if (!result.ok) {
			useJackProof
				.getState()
				.setNotice(result.reason ?? "That reset couldn’t be applied.");
			return;
		}
		useJackProof.getState().setNotice(null);
	};

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
							className={`jack-correction__mode${
								correcting ? " jack-correction__mode--done" : ""
							}`}
							data-testid="jack-correct-toggle"
							aria-pressed={correcting}
							onClick={toggleMode}
						>
							{correcting ? "Done" : "Correct"}
						</button>
					) : null}
				</div>
			</div>

			{correcting ? (
				<>
					<p className="jack-correction__hint" data-testid="jack-proof-hint">
						Drag a pin on the face · arrows nudge.
					</p>
					<p className="jack-correction__legend" aria-hidden="true">
						◇ assumed / approx · ◎ corrected
					</p>
				</>
			) : null}

			<ul className="jack-correction__rows">
				{jacks.map((jack, index) => {
					const provenance = jackProvenance(jack);
					const isOpen = correcting && openIndex === index;
					const rowPanelId = `${panelIdBase}-jack-${index}`;
					const summary = (
						<span className="jack-correction__summary">
							<span className="jack-correction__kind">
								{jackKindLabelAt(jacks, index)}
							</span>
							<span className="jack-correction__sep" aria-hidden="true">
								{" · "}
							</span>
							<span className="jack-correction__position">
								{formatJackPosition(jack, widthCm, heightCm, units) ||
									`${JACK_EDGE_NAMES[jack.edge]} · ${(jack.pos ?? 0.5).toFixed(2)}`}
							</span>
						</span>
					);
					const ariaLabel = `${jackKindLabelAt(jacks, index)}, ${
						provenance ?? "catalog"
					}, ${
						formatJackPosition(jack, widthCm, heightCm, units) ||
						`${JACK_EDGE_NAMES[jack.edge]} ${(jack.pos ?? 0.5).toFixed(2)}`
					}`;
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
									type="button"
									className="jack-correction__trigger"
									aria-label={ariaLabel}
									aria-expanded={isOpen}
									aria-controls={rowPanelId}
									data-testid={`jack-row-${index}`}
									onClick={() => select(index)}
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

									<p className="jack-correction__baseline">
										Position{" "}
										<span
											className="jack-correction__position"
											data-testid={`jack-position-${index}`}
										>
											{formatJackPosition(jack, widthCm, heightCm, units) ||
												"catalog edge"}
										</span>
									</p>
									{baseJacks[index] ? (
										<p className="jack-correction__baseline">
											Catalog{" "}
											{formatJackRow(
												baseJacks[index],
												widthCm,
												heightCm,
												units,
											)}
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
									{notice ? (
										<p
											className="jack-correction__refusal"
											data-testid="jack-proof-notice"
											role="alert"
										>
											{notice}
										</p>
									) : null}
								</div>
							) : null}
						</li>
					);
				})}
			</ul>

			{notice && openIndex === null ? (
				<p
					className="jack-correction__refusal"
					data-testid="jack-proof-notice"
					role="alert"
				>
					{notice}
				</p>
			) : null}

			{isCustom ? (
				<p className="info-panel__assumed">
					Custom part — jacks are shared by every copy.
				</p>
			) : null}

			{correctedCount > 0 ? (
				<p className="info-panel__assumed" data-testid="jack-corrected-note">
					Corrected positions apply to this scene only.
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
				</footer>
			) : null}
		</section>
	);
}

function formatJackRow(
	jack: ResolvedJack,
	widthCm: number,
	heightCm: number,
	units: DisplayUnits,
): string {
	const position = formatJackPosition(jack, widthCm, heightCm, units);
	if (position) return `${jackKindLabel(jack.kind)} · ${position}`;
	return `${jackKindLabel(jack.kind)} · ${JACK_EDGE_NAMES[jack.edge]} · ${(jack.pos ?? 0.5).toFixed(2)}`;
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
