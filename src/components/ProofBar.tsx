import { useEffect, useRef, useState } from "react";
import { JACK_KINDS, type JackKind } from "../catalog/schema";
import { jackKindLabel } from "../lib/customPedal";
import {
	formatJack,
	formatJackPosition,
	jackProvenance,
} from "../lib/partInfo";
import { useIsMobile } from "../lib/useMobile";
import { useJackProof } from "../state/jackProof";
import {
	baseItemJacks,
	resolveItem,
	resolveItemJacks,
	useScene,
} from "../state/scene";
import { useSettings } from "../state/settings";

/**
 * Mobile “Press Proof” chrome (F-33). The full InfoPanel sheet hides while
 * proofing so the pedal is visible; this bar above the tab bar always keeps
 * Done + the selected jack, and opens a compact inspector for kind/TRS/reset.
 */
function ProofFallback({ onDone }: { onDone: () => void }) {
	return (
		<div className="proof-bar" data-testid="proof-bar">
			<div className="proof-bar__row">
				<span className="proof-bar__eyebrow">Proofing</span>
				<span className="proof-bar__name">Part no longer available</span>
				<button
					type="button"
					className="proof-bar__done"
					data-testid="proof-done"
					onClick={onDone}
				>
					Done
				</button>
			</div>
		</div>
	);
}

export function ProofBar() {
	const isMobile = useIsMobile();
	const activeUid = useJackProof((state) => state.activeUid);
	const selectedJack = useJackProof((state) => state.selectedJack);
	const notice = useJackProof((state) => state.notice);
	const exit = useJackProof((state) => state.exit);
	const items = useScene((state) => state.items);
	const customPedals = useScene((state) => state.customPedals);
	const setJackOverride = useScene((state) => state.setJackOverride);
	const resetJackOverride = useScene((state) => state.resetJackOverride);
	const resetAllJackOverrides = useScene(
		(state) => state.resetAllJackOverrides,
	);
	const units = useSettings((state) => state.units);
	const [adjustOpen, setAdjustOpen] = useState(false);
	const [resetArmed, setResetArmed] = useState(false);
	const cancelRef = useRef<HTMLButtonElement>(null);

	useEffect(() => {
		if (!resetArmed) return;
		cancelRef.current?.focus();
	}, [resetArmed]);
	useEffect(() => {
		if (!activeUid) {
			setAdjustOpen(false);
			setResetArmed(false);
		}
	}, [activeUid]);

	if (!isMobile || !activeUid) return null;
	const item = items.find((candidate) => candidate.uid === activeUid);
	if (!item) return <ProofFallback onDone={exit} />;
	const resolved = resolveItem(item, customPedals);
	const jacks = resolveItemJacks(item, customPedals);
	if (!resolved.definition || jacks.length === 0) {
		return <ProofFallback onDone={exit} />;
	}
	const index =
		selectedJack !== null && selectedJack >= 0 && selectedJack < jacks.length
			? selectedJack
			: 0;
	const jack = jacks[index];
	if (!jack) return <ProofFallback onDone={exit} />;
	const base = baseItemJacks(item, customPedals)[index];
	const correctedCount = jacks.filter(
		(entry) => entry.corrected === true,
	).length;
	const provenance = jackProvenance(jack);
	const provenanceLabel =
		provenance === "corrected"
			? "Corrected"
			: provenance === "assumed"
				? "Assumed"
				: provenance === "approximate"
					? "Approx"
					: null;
	const position =
		formatJackPosition(jack, resolved.widthCm, resolved.heightCm, units) ||
		formatJack(jack);
	const commit = (patch: { kind?: JackKind; stereo?: boolean }) => {
		const result = setJackOverride(activeUid, index, patch);
		useJackProof
			.getState()
			.setNotice(result.ok ? null : (result.reason ?? "Couldn’t apply that."));
	};
	const resetOne = () => {
		const result = resetJackOverride(activeUid, index);
		useJackProof
			.getState()
			.setNotice(result.ok ? null : (result.reason ?? "Couldn’t reset that."));
	};
	const resetAll = () => {
		const result = resetAllJackOverrides(activeUid);
		setResetArmed(false);
		useJackProof
			.getState()
			.setNotice(result.ok ? null : (result.reason ?? "Couldn’t reset all."));
	};

	return (
		<div className="proof-bar" data-testid="proof-bar">
			<div className="proof-bar__row">
				<span className="proof-bar__eyebrow">Proofing</span>
				<span className="proof-bar__name">{resolved.name}</span>
				<span className="proof-bar__count">
					{index + 1} / {jacks.length}
				</span>
				<button
					type="button"
					className="proof-bar__done"
					data-testid="proof-done"
					onClick={exit}
				>
					Done
				</button>
			</div>
			<div className="proof-bar__row proof-bar__row--jack">
				<button
					type="button"
					className="proof-bar__chip"
					data-testid="proof-jack-chip"
					aria-expanded={adjustOpen}
					onClick={() => setAdjustOpen((value) => !value)}
				>
					<span className="proof-bar__kind">{jackKindLabel(jack.kind)}</span>
					<span className="proof-bar__position" data-testid="proof-position">
						{position}
					</span>
					{provenanceLabel ? (
						<span
							className="proof-bar__marker"
							data-testid={`proof-marker-${provenance}`}
						>
							{provenanceLabel}
						</span>
					) : null}
				</button>
				<button
					type="button"
					className="proof-bar__adjust"
					data-testid="proof-adjust"
					aria-expanded={adjustOpen}
					onClick={() => setAdjustOpen((value) => !value)}
				>
					Adjust
				</button>
			</div>

			{adjustOpen ? (
				<div className="proof-inspector" data-testid="proof-inspector">
					<label className="jack-correction__field">
						<span className="jack-correction__label">Kind</span>
						<select
							className="jack-correction__select"
							data-testid="proof-kind"
							value={jack.kind}
							onChange={(event) =>
								commit({ kind: event.target.value as JackKind })
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
							data-testid="proof-stereo"
							checked={jack.stereo === true}
							onChange={(event) => commit({ stereo: event.target.checked })}
						/>
						<span>TRS · 2 cables</span>
					</label>
					{base ? (
						<p className="jack-correction__baseline">
							Catalog {formatJack(base)}
						</p>
					) : null}
					{jack.corrected ? (
						<button
							type="button"
							className="jack-correction__reset"
							data-testid="proof-reset"
							onClick={resetOne}
						>
							Reset to catalog
						</button>
					) : null}
					{correctedCount > 0 ? (
						resetArmed ? (
							<div className="jack-correction__confirm">
								<span>Reset {correctedCount} jack corrections?</span>
								<div className="jack-correction__confirm-actions">
									<button
										ref={cancelRef}
										type="button"
										className="jack-correction__cancel"
										data-testid="proof-reset-all-cancel"
										onClick={() => setResetArmed(false)}
									>
										Cancel
									</button>
									<button
										type="button"
										className="jack-correction__reset jack-correction__reset--all"
										data-testid="proof-reset-all-confirm"
										onClick={resetAll}
									>
										Reset all
									</button>
								</div>
							</div>
						) : (
							<button
								type="button"
								className="jack-correction__reset-all"
								data-testid="proof-reset-all"
								onClick={() => setResetArmed(true)}
							>
								Reset all jacks
							</button>
						)
					) : null}
					{notice ? (
						<p className="jack-correction__refusal" role="alert">
							{notice}
						</p>
					) : null}
				</div>
			) : null}
		</div>
	);
}
