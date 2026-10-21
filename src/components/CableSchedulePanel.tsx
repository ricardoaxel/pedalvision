import { useEffect, useMemo, useRef } from "react";
import {
	CABLE_SLACK_RATIO,
	PLUG_OVERHANG_CM,
	SOLD_CABLE_LENGTHS_CM,
} from "../lib/cableLength";
import {
	buildCableSchedule,
	CABLE_TYPE_LABEL,
	type CableSchedule,
	type CableScheduleRow,
	type CableScheduleTotal,
} from "../lib/cableSummary";
import { cmToDisplay, type DisplayUnits } from "../lib/geometry";
import { useReadOnly } from "../state/readOnly";
import { useScene } from "../state/scene";
import { useSettings } from "../state/settings";
import { CloseIcon } from "./icons";

/**
 * P4-03 "Cable Schedule" (owner-approved direction, 2026-10-21).
 *
 * A ruled ledger reached deliberately from the Patch surface — never auto-open,
 * never a toast. It is derived from the graph only (lengths are never stored)
 * and stays out of the export/share payload. Desktop = a non-modal dock in the
 * toolbar column; mobile = a content-sized tray above the tab bar.
 */

const TITLE_ID = "cable-schedule-title";
const HINT_ID = "cable-schedule-hint";

function formatLength(cm: number, units: DisplayUnits): string {
	return `${cmToDisplay(cm, units)} ${units}`;
}

function rowMethod(row: CableScheduleRow, units: DisplayUnits): string {
	if (row.unresolved) return "Unresolved — missing jack or endpoint.";
	const custom =
		row.lengthCm === null
			? `custom (${formatLength(
					row.customLengthCm ?? Math.ceil(row.requiredCm),
					units,
				)})`
			: formatLength(row.lengthCm, units);
	return `Straight-line ${formatLength(row.distanceCm, units)} + ${formatLength(
		PLUG_OVERHANG_CM * 2,
		units,
	)} plugs + ${Math.round(CABLE_SLACK_RATIO * 100)}% slack = ${formatLength(
		row.requiredCm,
		units,
	)} → ${custom}`;
}

function soldLengthLabel(row: CableScheduleRow, units: DisplayUnits): string {
	if (row.unresolved) return "Unresolved";
	if (row.lengthCm !== null) return formatLength(row.lengthCm, units);
	return `Custom ${formatLength(row.customLengthCm ?? Math.ceil(row.requiredCm), units)}`;
}

function totalLabel(total: CableScheduleTotal, units: DisplayUnits): string {
	const type = CABLE_TYPE_LABEL[total.type];
	if (total.lengthCm !== null) {
		return `${formatLength(total.lengthCm, units)} · ${type}`;
	}
	return `Custom ${formatLength(total.customLengthCm ?? 0, units)} · ${type}`;
}

function totalLengthLabel(totalCm: number, units: DisplayUnits): string {
	if (units === "in") {
		const inches = totalCm / 2.54;
		return inches >= 12
			? `${(inches / 12).toFixed(2)} ft`
			: `${cmToDisplay(totalCm, "in")} in`;
	}
	return totalCm >= 100
		? `${(totalCm / 100).toFixed(2)} m`
		: `${cmToDisplay(totalCm, "cm")} cm`;
}

function groupedLabels(
	labels: string[],
): Array<{ label: string; count: number }> {
	const counts = new Map<string, number>();
	for (const label of labels) {
		counts.set(label, (counts.get(label) ?? 0) + 1);
	}
	return [...counts.entries()].map(([label, count]) => ({ label, count }));
}

function ScheduleBody({
	schedule,
	units,
	graphVisible,
	onShowPatch,
}: {
	schedule: CableSchedule;
	units: DisplayUnits;
	graphVisible: boolean;
	onShowPatch: () => void;
}) {
	const unconnected = groupedLabels([
		...schedule.unconnectedItems,
		...schedule.unconnectedEndpoints,
	]);

	if (schedule.cableCount === 0) {
		if (schedule.rows.length === 0 && unconnected.length === 0) {
			return (
				<div className="cable-schedule__empty">
					<p className="cable-schedule__empty-title">Nothing to measure yet.</p>
					<p className="cable-schedule__empty-text">
						Add a pedal or a board first.
					</p>
				</div>
			);
		}
		return (
			<div className="cable-schedule__empty">
				<p className="cable-schedule__empty-title">Nothing patched yet.</p>
				<p className="cable-schedule__empty-text">
					Drag from one jack to another on the canvas.
				</p>
				{!graphVisible ? (
					<button
						type="button"
						className="cable-schedule__secondary"
						data-testid="cable-schedule-show-patch"
						onClick={onShowPatch}
					>
						Show patch
					</button>
				) : null}
			</div>
		);
	}

	return (
		<>
			<section className="cable-schedule__section">
				<h3 className="cable-schedule__section-title">Signal path</h3>
				<ol className="cable-schedule__list" data-testid="cable-schedule-rows">
					{schedule.rows.map((row) => (
						<li
							key={row.uid}
							className="cable-schedule__row"
							data-testid="cable-schedule-row"
							data-assumed={row.assumed ? "true" : undefined}
							data-unresolved={row.unresolved ? "true" : undefined}
						>
							<span className="cable-schedule__ordinal" aria-hidden="true">
								{String(row.order).padStart(2, "0")}
							</span>
							<span className="cable-schedule__route">
								<span className="cable-schedule__end">{row.fromLabel}</span>
								<span className="cable-schedule__arrow" aria-hidden="true">
									→
								</span>
								<span className="visually-hidden">to</span>
								<span className="cable-schedule__end">{row.toLabel}</span>
							</span>
							<span className="cable-schedule__measure">
								<span
									className="cable-schedule__length"
									title={rowMethod(row, units)}
								>
									{soldLengthLabel(row, units)}
								</span>
								<span className="cable-schedule__meta">
									{CABLE_TYPE_LABEL[row.type]}
								</span>
								{row.assumed ? (
									<span className="cable-schedule__assumed">◇ Assumed</span>
								) : null}
							</span>
						</li>
					))}
				</ol>
			</section>

			<section className="cable-schedule__section">
				<h3 className="cable-schedule__section-title">Totals</h3>
				<dl className="cable-schedule__totals">
					{schedule.totals.map((total) => (
						<div
							key={`${total.type}:${total.lengthCm ?? `custom-${total.customLengthCm}`}`}
							className="cable-schedule__total"
						>
							<dt className="cable-schedule__total-label">
								{totalLabel(total, units)}
							</dt>
							<dd className="cable-schedule__total-count">×{total.count}</dd>
						</div>
					))}
				</dl>
			</section>

			{unconnected.length > 0 ? (
				<section className="cable-schedule__section">
					<h3 className="cable-schedule__section-title">Unconnected</h3>
					<ul className="cable-schedule__flags">
						{unconnected.map(({ label, count }) => (
							<li key={label} className="cable-schedule__flag">
								<span className="cable-schedule__flag-dot" aria-hidden="true" />
								<span className="cable-schedule__flag-name">{label}</span>
								<span className="cable-schedule__flag-note">
									· no cable{count > 1 ? ` ×${count}` : ""}
								</span>
							</li>
						))}
					</ul>
				</section>
			) : null}

			{schedule.unresolvedCount > 0 ? (
				<p
					className="cable-schedule__dangling"
					data-testid="cable-schedule-dangling"
				>
					{schedule.unresolvedCount}{" "}
					{schedule.unresolvedCount === 1
						? "cable references"
						: "cables reference"}{" "}
					a missing jack or endpoint.
				</p>
			) : null}

			<p className="cable-schedule__legend">
				Rounded up to {SOLD_CABLE_LENGTHS_CM.join(" / ")} cm. ◇ Jack position
				assumed.
			</p>

			<footer className="cable-schedule__footer">
				<span className="cable-schedule__footer-label">
					Total {schedule.cableCount}{" "}
					{schedule.cableCount === 1 ? "cable" : "cables"}
				</span>
				<span className="cable-schedule__footer-value">
					{totalLengthLabel(schedule.totalLengthCm, units)}
				</span>
			</footer>
		</>
	);
}

export function CableSchedulePanel({ onClose }: { onClose: () => void }) {
	const panelRef = useRef<HTMLDivElement>(null);
	const boards = useScene((state) => state.boards);
	const items = useScene((state) => state.items);
	const customPedals = useScene((state) => state.customPedals);
	const endpoints = useScene((state) => state.endpoints);
	const cables = useScene((state) => state.cables);
	const units = useSettings((state) => state.units);
	const showCables = useSettings((state) => state.showCables);
	const setShowCables = useSettings((state) => state.setShowCables);
	const readOnly = useReadOnly((state) => state.readOnly);
	const graphVisible = showCables || readOnly;

	const schedule = useMemo(
		() =>
			buildCableSchedule({
				boards,
				items,
				customPedals,
				endpoints,
				cables,
			}),
		[boards, items, customPedals, endpoints, cables],
	);

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
				target.closest("[data-schedule-trigger]")
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

	const hint = `Straight-line + ${
		PLUG_OVERHANG_CM * 2
	} cm plugs + ${Math.round(CABLE_SLACK_RATIO * 100)}% slack.`;

	return (
		<div
			ref={panelRef}
			id="cable-schedule"
			className="cable-schedule"
			data-testid="cable-schedule"
			role="dialog"
			aria-modal="false"
			aria-labelledby={TITLE_ID}
			aria-describedby={HINT_ID}
			tabIndex={-1}
		>
			<header className="cable-schedule__header">
				<div className="cable-schedule__heading">
					<span className="cable-schedule__eyebrow">Patch — schedule</span>
					<h2 id={TITLE_ID} className="cable-schedule__title">
						Cable schedule
					</h2>
					<p id={HINT_ID} className="cable-schedule__hint">
						{hint}
					</p>
				</div>
				<button
					type="button"
					className="cable-schedule__close"
					data-testid="cable-schedule-close"
					aria-label="Close cable schedule"
					onClick={onClose}
				>
					<CloseIcon />
				</button>
			</header>

			<div className="cable-schedule__body">
				<ScheduleBody
					schedule={schedule}
					units={units}
					graphVisible={graphVisible}
					onShowPatch={() => {
						setShowCables(true);
						panelRef.current?.focus();
					}}
				/>
			</div>
		</div>
	);
}
