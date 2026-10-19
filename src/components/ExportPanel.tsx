import { useEffect, useMemo, useRef, useState } from "react";
import { renderExportFile } from "../canvas/exportStage";
import { useCanvasTheme } from "../canvas/useCanvasTheme";
import {
	ExportError,
	type ExportFormat,
	type ExportPlan,
	type ExportScope,
	exportFileName,
	resolveExportPlan,
} from "../lib/exportScene";
import { cmToDisplay } from "../lib/geometry";
import {
	boardDefinition,
	boardFootprint,
	isCustomBoard,
	useScene,
} from "../state/scene";
import { selectSelectedBoardUid, useSelection } from "../state/selection";
import { BoardIcon, DownloadIcon } from "./icons";

type Status = "idle" | "preparing" | "success";

interface ExportPanelProps {
	onClose: () => void;
	onAddBoard: () => void;
	/** Lets the toolbar trigger stay disabled while a bounded export runs. */
	onBusyChange?: (busy: boolean) => void;
}

const PANEL_TITLE_ID = "export-title";
const PANEL_HINT_ID = "export-hint";

function formatCm(value: number): string {
	return String(cmToDisplay(value, "cm"));
}

function formatPx(value: number): string {
	return value.toLocaleString("en-US");
}

function boardLabel(
	boardUid: string,
	boards: ReturnType<typeof useScene.getState>["boards"],
): string | null {
	const board = boards.find((candidate) => candidate.uid === boardUid);
	if (!board) return null;
	if (isCustomBoard(board)) {
		return board.name?.trim() || board.brand?.trim() || "custom board";
	}
	const definition = boardDefinition(board);
	return definition ? `${definition.brand} ${definition.name}` : "board";
}

function errorMessage(error: unknown): string {
	if (error instanceof ExportError) {
		if (error.code === "image" || error.code === "tainted")
			return error.message;
		if (error.code === "empty") return "There is nothing to export yet.";
	}
	return "The export didn't finish. Try again.";
}

function noticeLines(plan: ExportPlan): string[] {
	const lines: string[] = [];
	if (plan.clampLimited) {
		lines.push("Resolution capped for iOS compatibility.");
		if (plan.scope === "all" && plan.boards.length > 1) {
			lines.push("Export a single board for more detail.");
		}
	}
	return lines;
}

function downloadDataUrl(dataUrl: string, filename: string): void {
	const link = document.createElement("a");
	link.href = dataUrl;
	link.download = filename;
	link.rel = "noopener";
	document.body.appendChild(link);
	link.click();
	link.remove();
}

function downloadBytes(
	bytes: Uint8Array,
	filename: string,
	mimeType: string,
): void {
	const buffer = bytes.buffer.slice(
		bytes.byteOffset,
		bytes.byteOffset + bytes.byteLength,
	) as ArrayBuffer;
	const url = URL.createObjectURL(new Blob([buffer], { type: mimeType }));
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	link.rel = "noopener";
	document.body.appendChild(link);
	link.click();
	link.remove();
	// Revoke after the browser has had a chance to start the download.
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * P3-01 export surface — owner-approved **"Print Ticket"** direction
 * (2026-10-19). A non-modal docked panel (desktop) / compact tray (mobile):
 * scope + live output spec + one accent download, with persistent inline
 * success/error states. The canvas stays interactive so the selected board can
 * drive the scope while the panel is open.
 */
export function ExportPanel({
	onClose,
	onAddBoard,
	onBusyChange,
}: ExportPanelProps) {
	const theme = useCanvasTheme();
	const boards = useScene((state) => state.boards);
	const items = useScene((state) => state.items);
	const customPedals = useScene((state) => state.customPedals);
	const selectedBoardUid = useSelection(selectSelectedBoardUid);

	const [scope, setScope] = useState<ExportScope>(
		selectedBoardUid ? "board" : "all",
	);
	const [format, setFormat] = useState<ExportFormat>("png");
	const [status, setStatus] = useState<Status>("idle");
	const [error, setError] = useState<string | null>(null);
	const [result, setResult] = useState<{
		filename: string;
		format: ExportFormat;
		widthPx: number;
		heightPx: number;
	} | null>(null);
	const panelRef = useRef<HTMLDivElement>(null);
	const ctaRef = useRef<HTMLButtonElement>(null);
	const doneRef = useRef<HTMLButtonElement>(null);

	const busy = status === "preparing";
	const isEmpty = boards.length === 0 && items.length === 0;

	useEffect(() => {
		onBusyChange?.(busy);
		// Release the trigger if the panel is unmounted mid-export (e.g. opening
		// the picker from the toolbar) — never leave it permanently disabled.
		return () => onBusyChange?.(false);
	}, [busy, onBusyChange]);

	// Place focus inside the non-modal dialog on open: the checked scope radio,
	// or the empty-state CTA. Focus is preserved (never dropped to <body>).
	useEffect(() => {
		const frame = requestAnimationFrame(() => {
			const checked = panelRef.current?.querySelector<HTMLInputElement>(
				'input[name="export-scope"]:checked:not(:disabled)',
			);
			const fallback = panelRef.current?.querySelector<HTMLElement>(
				"[data-export-autofocus]",
			);
			(checked ?? fallback)?.focus();
		});
		return () => cancelAnimationFrame(frame);
	}, []);

	// Selected-board scope is never left dangling: if the board selection goes
	// away while it is active, fall back to everything (a live CTA, never dead).
	useEffect(() => {
		if (scope === "board" && !selectedBoardUid) setScope("all");
	}, [scope, selectedBoardUid]);

	// Non-modal dialog: Escape closes from anywhere (unless a bounded export is
	// running), and focus returns to the trigger via the App's close handler.
	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape" && !busy) {
				event.preventDefault();
				onClose();
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [busy, onClose]);

	useEffect(() => {
		if (status === "success") doneRef.current?.focus();
	}, [status]);

	const plan = useMemo<ExportPlan | null>(() => {
		if (isEmpty) return null;
		try {
			return resolveExportPlan(
				{ boards, items, customPedals },
				{ scope, boardUid: selectedBoardUid },
			);
		} catch {
			return null;
		}
	}, [boards, items, customPedals, scope, selectedBoardUid, isEmpty]);

	const selectedBoard = selectedBoardUid
		? boards.find((board) => board.uid === selectedBoardUid)
		: undefined;
	const label = selectedBoardUid ? boardLabel(selectedBoardUid, boards) : null;
	const scopeHint = (() => {
		if (scope === "all") return "Everything on the canvas.";
		if (!selectedBoard || !plan) return "Select a board on the canvas.";
		const footprint = boardFootprint(selectedBoard);
		const parts = plan.items.length;
		const dims = `${formatCm(footprint.widthCm)} × ${formatCm(footprint.heightCm)} cm`;
		return parts === 0
			? `${label ?? "Board"} · empty board`
			: `${label ?? "Board"} · ${dims} · ${parts} ${parts === 1 ? "part" : "parts"}`;
	})();

	const handleExport = async () => {
		if (!plan || busy) return;
		setStatus("preparing");
		setError(null);
		setResult(null);
		// Let the busy state paint before the synchronous render starts.
		await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
		try {
			const rendered = await renderExportFile(plan, theme, format);
			const filename = exportFileName(plan, label, new Date(), format);
			if (rendered.format === "pdf") {
				downloadBytes(rendered.bytes, filename, "application/pdf");
			} else {
				downloadDataUrl(rendered.dataUrl, filename);
			}
			setResult({
				filename,
				format,
				widthPx: rendered.widthPx,
				heightPx: rendered.heightPx,
			});
			setStatus("success");
		} catch (cause) {
			setError(errorMessage(cause));
			setStatus("idle");
			requestAnimationFrame(() => ctaRef.current?.focus());
		}
	};

	const chooseFormat = (next: ExportFormat) => {
		setFormat(next);
		setError(null);
	};

	const chooseScope = (next: ExportScope) => {
		setScope(next);
		setError(null);
	};

	const exportAgain = () => {
		setStatus("idle");
		setError(null);
		setResult(null);
		requestAnimationFrame(() => ctaRef.current?.focus());
	};

	const notices = plan ? noticeLines(plan) : [];

	return (
		<div
			ref={panelRef}
			id="export-panel"
			className="export-panel"
			data-testid="export-panel"
			role="dialog"
			aria-modal="false"
			aria-labelledby={PANEL_TITLE_ID}
			aria-describedby={PANEL_HINT_ID}
			aria-busy={busy}
		>
			<header className="export-panel__header">
				<div className="export-panel__heading">
					<span className="export-panel__eyebrow">
						Output — {format.toUpperCase()}
					</span>
					<h2 id={PANEL_TITLE_ID} className="export-panel__title">
						{isEmpty ? "Nothing to export yet." : "Export plan"}
					</h2>
					<p id={PANEL_HINT_ID} className="export-panel__hint">
						{isEmpty
							? "Add a board or a pedal, then export it."
							: format === "pdf"
								? "True scale. Paper-light PDF."
								: "True scale. No grid."}
					</p>
				</div>
				<button
					type="button"
					className="export-panel__close"
					data-testid="export-close"
					aria-label="Close export"
					disabled={busy}
					onClick={onClose}
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
						<path d="M6 6l12 12M18 6 6 18" />
					</svg>
				</button>
			</header>

			{isEmpty ? (
				<div className="export-panel__body" data-testid="export-empty">
					<p className="export-panel__empty-body">
						Add a board or a pedal, then export it.
					</p>
					<button
						type="button"
						className="export-panel__secondary export-panel__empty-cta"
						data-testid="export-add-board"
						data-export-autofocus
						onClick={onAddBoard}
					>
						<BoardIcon size={16} />
						Add a board
					</button>
				</div>
			) : status === "success" && result ? (
				<div className="export-panel__success" role="status" aria-live="polite">
					<div className="export-panel__success-block">
						<span className="export-panel__success-icon" aria-hidden="true">
							<svg
								width="18"
								height="18"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
								strokeLinejoin="round"
								aria-hidden="true"
							>
								<path d="M4 12.5l5 5L20 6.5" />
							</svg>
						</span>
						<h3 className="export-panel__success-title">
							{result.format.toUpperCase()} saved
						</h3>
						<p className="export-panel__filename">{result.filename}</p>
						<p className="export-panel__success-meta">
							{formatPx(result.widthPx)} × {formatPx(result.heightPx)} px
						</p>
					</div>
					<div className="export-panel__footer export-panel__footer--split">
						<button
							type="button"
							className="export-panel__secondary"
							onClick={exportAgain}
						>
							Export again
						</button>
						<button
							ref={doneRef}
							type="button"
							className="export-panel__cta"
							data-testid="export-done"
							onClick={onClose}
						>
							Done
						</button>
					</div>
				</div>
			) : (
				<div className="export-panel__body">
					<fieldset className="export-choice" disabled={busy}>
						<legend className="export-label">Format</legend>
						<div className="export-scope__track">
							<label
								className={`export-scope__option${
									format === "png" ? " export-scope__option--active" : ""
								}`}
							>
								<input
									type="radio"
									name="export-format"
									value="png"
									checked={format === "png"}
									disabled={busy}
									onChange={() => chooseFormat("png")}
								/>
								<span>PNG</span>
							</label>
							<label
								className={`export-scope__option${
									format === "pdf" ? " export-scope__option--active" : ""
								}`}
							>
								<input
									type="radio"
									name="export-format"
									value="pdf"
									checked={format === "pdf"}
									disabled={busy}
									onChange={() => chooseFormat("pdf")}
								/>
								<span>PDF</span>
							</label>
						</div>
					</fieldset>

					<fieldset
						className="export-choice export-choice--spaced"
						disabled={busy}
					>
						<legend className="export-label">Scope</legend>
						<div className="export-scope__track">
							<label
								className={`export-scope__option${
									scope === "board" ? " export-scope__option--active" : ""
								}`}
							>
								<input
									type="radio"
									name="export-scope"
									value="board"
									checked={scope === "board"}
									disabled={!selectedBoardUid || busy}
									onChange={() => chooseScope("board")}
								/>
								<span>Selected board</span>
							</label>
							<label
								className={`export-scope__option${
									scope === "all" ? " export-scope__option--active" : ""
								}`}
							>
								<input
									type="radio"
									name="export-scope"
									value="all"
									checked={scope === "all"}
									disabled={busy}
									onChange={() => chooseScope("all")}
								/>
								<span>All content</span>
							</label>
						</div>
					</fieldset>
					<p className="export-panel__scope-hint" role="status">
						{scopeHint}
					</p>

					<div className="export-spec" data-testid="export-spec">
						<div className="export-spec__row">
							<span className="export-spec__label">Output</span>
							<span className="export-spec__value" data-testid="export-size">
								{plan
									? `${formatPx(plan.outputWidthPx)} × ${formatPx(plan.outputHeightPx)} px`
									: "—"}
							</span>
						</div>
						<div className="export-spec__meta">
							{plan
								? `${formatCm(plan.boundsCm.widthCm)} × ${formatCm(plan.boundsCm.heightCm)} cm · ${plan.pixelRatio === 2 ? "2×" : `${plan.pixelRatio.toFixed(1)}×`} · ${Math.round(plan.outputPpi)} PPI`
								: "—"}
						</div>
					</div>

					{notices.length > 0 ? (
						<div className="export-notice">
							{notices.map((line) => (
								<p key={line}>{line}</p>
							))}
						</div>
					) : null}

					{error ? (
						<div
							className="export-error"
							role="alert"
							data-testid="export-error"
						>
							<svg
								className="export-error__icon"
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="1.8"
								strokeLinecap="round"
								strokeLinejoin="round"
								aria-hidden="true"
							>
								<path d="M12 4.5 21 19H3z" />
								<path d="M12 10v4" />
								<path d="M12 16.6v.01" />
							</svg>
							<div>
								<p className="export-error__title">
									Couldn't create the {format.toUpperCase()}
								</p>
								<p className="export-error__body">{error}</p>
							</div>
						</div>
					) : null}

					<footer className="export-panel__footer">
						<button
							ref={ctaRef}
							type="button"
							className="export-panel__cta"
							data-testid="export-download"
							aria-disabled={busy}
							aria-busy={busy}
							onClick={handleExport}
						>
							{ctaLabel(busy, error, format)}
						</button>
					</footer>
				</div>
			)}
		</div>
	);
}

function ctaLabel(
	busy: boolean,
	error: string | null,
	format: ExportFormat,
): string {
	const name = format.toUpperCase();
	if (busy) return `Preparing ${name}…`;
	return error ? "Try again" : `Download ${name}`;
}

/** Trigger glyph + label, shared by the toolbar button. */
export function ExportTriggerContent() {
	return (
		<>
			<DownloadIcon size={16} />
			<span className="export-trigger__label">Export</span>
		</>
	);
}
