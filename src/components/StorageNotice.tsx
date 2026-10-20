import { useEffect, useRef, useState } from "react";
import { buildSceneBackup, downloadSceneBackup } from "../lib/sceneBackup";
import type { StorageHealth } from "../lib/storageHealth";
import { useSceneLibrary } from "../state/library";
import { useScene } from "../state/scene";

const LABEL_ID = "storage-note-label";
const TEXT_ID = "storage-note-text";

function quotaPercent(health: StorageHealth): number {
	const ratio = health.usageRatio ?? 0;
	return Math.min(100, Math.max(0, Math.round(ratio * 100)));
}

function announcement(health: StorageHealth): string {
	if (health.level === "unavailable") {
		return health.reason === "write"
			? "Not saving — the last save didn’t go through."
			: "Not saving — storage is blocked on this device.";
	}
	if (health.level === "low-quota") {
		return `Storage is about ${quotaPercent(health)}% full. Saving still works.`;
	}
	return "";
}

/**
 * Always-mounted polite announcer for storage health transitions (P3-05).
 * The visible card is a plain note; making it live would re-announce on every
 * autosave. This speaks only when the classified state changes.
 */
export function StorageAnnouncer({ readOnly }: { readOnly: boolean }) {
	const ready = useSceneLibrary((state) => state.ready);
	const health = useSceneLibrary((state) => state.storageHealth);
	const key = `${ready}:${readOnly}:${health.level}:${health.reason}:${quotaPercent(
		health,
	)}`;
	const previous = useRef<string | null>(null);
	const [message, setMessage] = useState("");

	useEffect(() => {
		if (previous.current === key) return;
		previous.current = key;
		setMessage(readOnly || !ready ? "" : announcement(health));
	}, [health, key, readOnly, ready]);

	return (
		<p
			className="visually-hidden"
			role="status"
			aria-live="polite"
			aria-atomic="true"
			data-testid="storage-announcer"
		>
			{message}
		</p>
	);
}

/**
 * "Margin Note" (P3-05, owner-approved 2026-10-20): a non-modal drafting note
 * pinned under the Title Block (desktop) / top row (mobile). Unavailable is
 * persistent because work is at risk; the low-quota advisory is dismissible for
 * the session. Styling is tokens-only; there is no toast or modal (N8).
 */
export function StorageNotice() {
	const ready = useSceneLibrary((state) => state.ready);
	const health = useSceneLibrary((state) => state.storageHealth);
	const activeId = useSceneLibrary((state) => state.activeId);
	const sceneName = useSceneLibrary((state) => {
		const active = state.scenes.find((entry) => entry.id === state.activeId);
		return active?.name ?? "Untitled scene";
	});
	const [dismissed, setDismissed] = useState(false);
	const [busy, setBusy] = useState(false);
	const [receipt, setReceipt] = useState<{
		tone: "ok" | "fail";
		text: string;
	} | null>(null);
	// One download at a time: never accumulate Blob object URLs on a fast
	// double-tap (each is kept alive for the iOS save sheet).
	const workingRef = useRef(false);

	if (!ready || health.level === "ok") return null;
	if (health.level === "low-quota" && dismissed) return null;

	const unavailable = health.level === "unavailable";
	const percent = quotaPercent(health);

	const handleBackup = () => {
		if (workingRef.current) return;
		workingRef.current = true;
		setBusy(true);
		setReceipt(null);
		try {
			// The live in-memory scene — never the last stored document.
			const scene = useScene.getState();
			const backup = buildSceneBackup({
				id: activeId ?? "session-backup",
				name: sceneName,
				snapshot: {
					boards: scene.boards,
					items: scene.items,
					customPedals: scene.customPedals,
				},
				now: new Date(),
			});
			downloadSceneBackup(backup);
			setReceipt({ tone: "ok", text: `Downloaded ${backup.filename}` });
		} catch {
			setReceipt({
				tone: "fail",
				text: "Couldn’t download the backup. Try again.",
			});
		} finally {
			workingRef.current = false;
			setBusy(false);
		}
	};

	const dismiss = () => {
		setDismissed(true);
		// Keep keyboard users off <body>: the scene plate is the next stop.
		requestAnimationFrame(() => {
			document.querySelector<HTMLElement>("[data-scene-trigger]")?.focus();
		});
	};

	return (
		<aside
			className="storage-note"
			role="note"
			aria-labelledby={LABEL_ID}
			aria-describedby={TEXT_ID}
			data-testid="storage-note"
			data-state={health.level}
			data-reason={health.reason}
		>
			<p className="storage-note__label" id={LABEL_ID}>
				{unavailable ? "Not saving" : "Storage almost full"}
			</p>
			<p className="storage-note__text" id={TEXT_ID}>
				{unavailable
					? health.reason === "write"
						? "The last save didn’t go through. Changes stay in this tab only."
						: "Storage is blocked in this browser. Changes stay in this tab only."
					: `Browser storage is about ${percent}% full. Saving still works.`}
			</p>
			{unavailable ? (
				<div className="storage-note__actions">
					<button
						type="button"
						className="storage-note__action"
						data-testid="storage-backup"
						aria-busy={busy}
						aria-disabled={busy}
						onClick={handleBackup}
					>
						{busy ? "Downloading…" : "Download backup"}
					</button>
				</div>
			) : null}
			{receipt ? (
				<p
					className="storage-note__receipt"
					data-tone={receipt.tone}
					data-testid="storage-receipt"
					role="status"
					aria-live="polite"
				>
					{receipt.text}
				</p>
			) : null}
			{unavailable ? null : (
				<button
					type="button"
					className="storage-note__dismiss"
					data-testid="storage-dismiss"
					aria-label="Dismiss storage advisory"
					onClick={dismiss}
				>
					<span aria-hidden="true">×</span>
				</button>
			)}
		</aside>
	);
}
