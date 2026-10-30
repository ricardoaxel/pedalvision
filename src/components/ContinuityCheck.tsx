import { useEffect, useMemo, useRef, useState } from "react";
import {
	type SignalIssue,
	type SignalReport,
	signalReportFor,
} from "../lib/signalFlow";
import { useReadOnly } from "../state/readOnly";
import { useScene } from "../state/scene";
import { useSelection } from "../state/selection";
import { useSettings } from "../state/settings";
import { CloseIcon } from "./icons";

/**
 * F-36 "Continuity Check" (owner-approved 2026-10-29).
 *
 * A compact chip in the Margin Rule strip opens a non-modal dock (desktop) /
 * tray (mobile) over the same slot as the Cable Schedule. The report is derived
 * from the patch graph only: nothing is stored, nothing is blocked, and assumed
 * fallback anchors are disclosed instead of becoming false errors.
 */

const TITLE_ID = "continuity-title";
const HINT_ID = "continuity-hint";

export function useSignalReport(): SignalReport {
	const boards = useScene((state) => state.boards);
	const items = useScene((state) => state.items);
	const customPedals = useScene((state) => state.customPedals);
	const endpoints = useScene((state) => state.endpoints);
	const cables = useScene((state) => state.cables);
	return useMemo(
		() =>
			signalReportFor({
				boards,
				items,
				customPedals,
				endpoints,
				cables,
			}),
		[boards, items, customPedals, endpoints, cables],
	);
}

function issueCount(report: SignalReport): number {
	return report.warningCount + report.infoCount;
}

export function ContinuityChip({
	open,
	onToggle,
}: {
	open: boolean;
	onToggle: () => void;
}) {
	const report = useSignalReport();
	const empty = report.checkedCables === 0;
	const clear = issueCount(report) === 0;
	const warnings = report.warningCount > 0;
	const state = empty ? "empty" : clear ? "clear" : "notes";
	const count = warnings ? report.warningCount : report.infoCount;
	const noun = warnings ? "warning" : "note";
	const label = empty
		? "No patch yet"
		: clear
			? "Clear"
			: `${count} ${count === 1 ? noun : `${noun}s`}`;
	return (
		<button
			type="button"
			className="continuity-chip"
			data-testid="continuity-toggle"
			data-continuity-trigger
			data-continuity-return
			data-state={state}
			data-dominant={warnings ? "warning" : clear || empty ? "quiet" : "info"}
			data-warnings={report.warningCount}
			data-notes={report.infoCount}
			data-open={open ? "true" : undefined}
			aria-haspopup="dialog"
			aria-expanded={open}
			aria-controls="continuity-check"
			aria-label={
				empty
					? "Continuity check — nothing patched yet"
					: clear
						? "Continuity check — clear"
						: `Continuity check — ${report.warningCount} warnings, ${report.infoCount} notes`
			}
			onClick={onToggle}
		>
			<span className="continuity-chip__glyph" aria-hidden="true">
				{empty ? "—" : clear ? "✓" : warnings ? "!" : "i"}
			</span>
			{empty || clear ? (
				<span className="continuity-chip__word">{label}</span>
			) : (
				<>
					<span className="continuity-chip__count">{count}</span>
					<span className="continuity-chip__word">
						{count === 1 ? noun : `${noun}s`}
					</span>
				</>
			)}
		</button>
	);
}

function hostItemUid(issue: SignalIssue): string | null {
	if (issue.itemUids[0]) return issue.itemUids[0];
	const cableUid = issue.cableUids[0];
	if (!cableUid) return null;
	const cable = useScene
		.getState()
		.cables.find((entry) => entry.uid === cableUid);
	if (!cable) return null;
	return "itemUid" in cable.from ? cable.from.itemUid : null;
}

function activateIssue(issue: SignalIssue, graphVisible: boolean): void {
	const selection = useSelection.getState();
	if (graphVisible && issue.cableUids[0]) {
		selection.selectCable(issue.cableUids[0]);
		return;
	}
	if (issue.itemUids[0]) {
		selection.selectItem(issue.itemUids[0]);
		return;
	}
	const host = hostItemUid(issue);
	if (host) {
		selection.selectItem(host);
		return;
	}
	if (graphVisible && issue.endpointUids[0]) {
		selection.selectEndpoint(issue.endpointUids[0]);
	}
}

function isIssueActive(
	issue: SignalIssue,
	selection: ReturnType<typeof useSelection.getState>["selection"],
): boolean {
	if (!selection) return false;
	if (selection.kind === "item") return issue.itemUids.includes(selection.uid);
	if (selection.kind === "cable")
		return issue.cableUids.includes(selection.uid);
	if (selection.kind === "endpoint") {
		return issue.endpointUids.includes(selection.uid);
	}
	return false;
}

function IssueRow({
	issue,
	active,
	onActivate,
	index,
}: {
	issue: SignalIssue;
	active: boolean;
	onActivate: () => void;
	index: number;
}) {
	return (
		<button
			type="button"
			className="continuity-row"
			data-testid={`continuity-row-${index}`}
			data-severity={issue.severity}
			aria-current={active ? "true" : undefined}
			onClick={onActivate}
		>
			<span className="continuity-row__dot" aria-hidden="true" />
			<span className="continuity-row__body">
				<span className="continuity-row__title">
					{issue.title}
					{issue.assumed ? (
						<span className="continuity-row__assumed">◇ Assumed</span>
					) : null}
				</span>
				<span className="continuity-row__detail">{issue.detail}</span>
			</span>
		</button>
	);
}

function IssueSection({
	title,
	issues,
	selection,
	graphVisible,
	offset,
}: {
	title: string;
	issues: SignalIssue[];
	selection: ReturnType<typeof useSelection.getState>["selection"];
	graphVisible: boolean;
	offset: number;
}) {
	if (issues.length === 0) return null;
	return (
		<section className="continuity-section">
			<h3 className="continuity-section__title">
				{title} ({issues.length})
			</h3>
			<div className="continuity-section__list">
				{issues.map((issue, index) => (
					<IssueRow
						key={`${issue.code}:${issue.itemUids.join("|")}:${issue.cableUids.join("|")}:${issue.endpointUids.join("|")}`}
						issue={issue}
						index={offset + index}
						active={isIssueActive(issue, selection)}
						onActivate={() => activateIssue(issue, graphVisible)}
					/>
				))}
			</div>
		</section>
	);
}

export function ContinuityPanel({ onClose }: { onClose: () => void }) {
	const panelRef = useRef<HTMLDivElement>(null);
	const report = useSignalReport();
	const showCables = useSettings((state) => state.showCables);
	const readOnly = useReadOnly((state) => state.readOnly);
	const selection = useSelection((state) => state.selection);
	const graphVisible = showCables || readOnly;
	const warnings = report.issues.filter(
		(issue) => issue.severity === "warning",
	);
	const notes = report.issues.filter((issue) => issue.severity === "info");
	const count = issueCount(report);

	useEffect(() => {
		panelRef.current?.focus();
	}, []);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return;
			event.preventDefault();
			onClose();
		};
		const onPointerDown = (event: PointerEvent) => {
			const target = event.target as Node | null;
			if (!target || panelRef.current?.contains(target)) return;
			if (
				target instanceof Element &&
				target.closest("[data-continuity-trigger]")
			) {
				return;
			}
			onClose();
		};
		window.addEventListener("keydown", onKeyDown);
		document.addEventListener("pointerdown", onPointerDown);
		return () => {
			window.removeEventListener("keydown", onKeyDown);
			document.removeEventListener("pointerdown", onPointerDown);
		};
	}, [onClose]);

	return (
		<div
			ref={panelRef}
			id="continuity-check"
			className="continuity-check"
			data-testid="continuity-panel"
			role="dialog"
			aria-modal="false"
			aria-labelledby={TITLE_ID}
			aria-describedby={HINT_ID}
			tabIndex={-1}
		>
			<header className="continuity-check__header">
				<div className="continuity-check__heading">
					<span className="continuity-check__eyebrow">Patch — continuity</span>
					<h2 id={TITLE_ID} className="continuity-check__title">
						Continuity check
					</h2>
					<p id={HINT_ID} className="continuity-check__hint">
						Derived from the patch graph — nothing is blocked.
					</p>
				</div>
				<button
					type="button"
					className="continuity-check__close"
					data-testid="continuity-close"
					aria-label="Close continuity check"
					onClick={onClose}
				>
					<CloseIcon />
				</button>
			</header>

			<div className="continuity-check__body">
				{report.checkedCables === 0 ? (
					<div className="continuity-check__empty">
						<p className="continuity-check__empty-title">
							Nothing patched yet.
						</p>
						<p className="continuity-check__empty-text">
							Add a pedal, an instrument and an amp, then patch them.
						</p>
					</div>
				) : count === 0 ? (
					<div className="continuity-check__empty">
						<p className="continuity-check__empty-title">
							Signal flow looks clear.
						</p>
						<p className="continuity-check__empty-text">
							Checked {report.checkedCables}{" "}
							{report.checkedCables === 1 ? "cable" : "cables"}.
						</p>
					</div>
				) : (
					<>
						<IssueSection
							title="Warnings"
							issues={warnings}
							selection={selection}
							graphVisible={graphVisible}
							offset={0}
						/>
						<IssueSection
							title="Notes"
							issues={notes}
							selection={selection}
							graphVisible={graphVisible}
							offset={warnings.length}
						/>
					</>
				)}

				{!report.endToEnd && report.checkedCables > 0 ? (
					<p className="continuity-check__note">
						Add an instrument and an amp to check the full chain.
					</p>
				) : null}

				{report.assumedEndCount > 0 ? (
					<p className="continuity-check__assumed-total">
						◇ {report.assumedEndCount} cable{" "}
						{report.assumedEndCount === 1 ? "end uses" : "ends use"} assumed
						jack positions.
					</p>
				) : null}
			</div>

			<footer className="continuity-check__footer">
				<span>
					{report.warningCount} warning{report.warningCount === 1 ? "" : "s"}
				</span>
				<span aria-hidden="true">·</span>
				<span>
					{report.infoCount} note{report.infoCount === 1 ? "" : "s"}
				</span>
				<span aria-hidden="true">·</span>
				<span>{report.checkedCables} checked</span>
			</footer>
		</div>
	);
}

/**
 * A single polite announcer for **summary transitions** only (never per row,
 * never per graph recompute), so patching does not spam a screen reader.
 */
export function ContinuityAnnouncer() {
	const report = useSignalReport();
	const key = `${report.warningCount}:${report.infoCount}:${report.checkedCables}`;
	const previous = useRef<string | null>(null);
	const [message, setMessage] = useState("");

	useEffect(() => {
		if (previous.current === null) {
			previous.current = key;
			return;
		}
		if (previous.current === key) return;
		previous.current = key;
		const timer = window.setTimeout(() => {
			if (report.warningCount > 0) {
				setMessage(
					`${report.warningCount} warning${report.warningCount === 1 ? "" : "s"} in signal flow`,
				);
			} else if (report.infoCount > 0) {
				setMessage(
					`${report.infoCount} note${report.infoCount === 1 ? "" : "s"} in signal flow`,
				);
			} else {
				setMessage("Signal flow clear");
			}
		}, 600);
		return () => window.clearTimeout(timer);
	}, [key, report.warningCount, report.infoCount]);

	return (
		<p
			className="visually-hidden"
			role="status"
			aria-live="polite"
			aria-atomic="true"
			data-testid="continuity-announcer"
		>
			{message}
		</p>
	);
}
