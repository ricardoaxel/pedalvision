import { useEffect, useMemo, useRef, useState } from "react";
import { capacityStatus } from "../lib/capacity";
import { useScene } from "../state/scene";
import {
	dismissShareError,
	exitSharedPreview,
	saveSharedCopy,
	useShare,
} from "../state/share";
import { CloseIcon, LockIcon, WarningIcon } from "./icons";

/**
 * P3-03 "Transmittal" read-only recipient surfaces. The shared scene lives in
 * the normal store (so canvas/export need no second path) but the editing
 * chrome is removed and every mutation is guarded by `state/readOnly.ts`.
 */

/** Desktop top-left stamp / mobile top banner. */
export function ShareStamp() {
	const name = useShare((state) => state.name) ?? "Shared scene";
	const boards = useScene((state) => state.boards);
	const items = useScene((state) => state.items);
	const customPedals = useScene((state) => state.customPedals);
	const status = useMemo(
		() => capacityStatus({ boards, items, customPedals }),
		[boards, items, customPedals],
	);
	// A review copy carries only the actionable hard/over-cap warning, never the
	// "approaching a limit" soft nudge.
	const overHard = status.level === "hard";

	return (
		<section
			className="share-stamp"
			data-testid="share-stamp"
			data-level={overHard ? "hard" : undefined}
			aria-labelledby="share-stamp-name"
		>
			<p className="share-stamp__eyebrow">
				<LockIcon size={14} />
				Review copy
			</p>
			<h2
				id="share-stamp-name"
				className="share-stamp__name"
				title={name}
				data-testid="share-name"
			>
				{name}
			</h2>
			<p className="share-stamp__trust">
				Read-only. Your own scenes are untouched.
			</p>
			{overHard ? (
				<p
					className="share-stamp__capacity"
					data-testid="share-capacity"
					data-level="hard"
				>
					<span className="share-stamp__capacity-label">Capacity</span>
					{status.warning}
				</p>
			) : null}
		</section>
	);
}

/**
 * Save a copy + return to the recipient's scenes. Desktop sits in the top-right
 * chrome cluster; mobile is a fixed bottom bar (56px, matching the tab bar).
 */
export function ShareActions() {
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const save = async () => {
		if (saving) return;
		setSaving(true);
		setError(null);
		const result = await saveSharedCopy();
		setSaving(false);
		if (!result.ok) setError(result.message);
	};

	const exit = async () => {
		if (saving) return;
		await exitSharedPreview();
	};

	return (
		<div className="share-actions">
			<button
				type="button"
				className="share-actions__save"
				data-testid="share-save-copy"
				aria-busy={saving}
				disabled={saving}
				onClick={() => void save()}
			>
				{saving ? "Saving…" : "Save a copy"}
			</button>
			<button
				type="button"
				className="share-actions__exit"
				data-testid="share-exit"
				disabled={saving}
				onClick={() => void exit()}
			>
				My scenes
			</button>
			{error ? (
				<p
					className="share-actions__error"
					data-testid="share-save-error"
					role="alert"
				>
					{error}
				</p>
			) : null}
		</div>
	);
}

/** Inline confirmation after a successful copy; replaces the stamp slot. */
export function ShareSavedNotice() {
	const savedAs = useShare((state) => state.savedAs);
	const dismiss = useShare((state) => state.dismissSaved);
	if (!savedAs) return null;
	return (
		<div
			className="share-saved"
			data-testid="share-saved"
			role="status"
			aria-live="polite"
		>
			<div className="share-saved__body">
				<strong className="share-saved__title">
					Saved as “{savedAs}”. You’re editing your copy.
				</strong>
			</div>
			<button
				type="button"
				className="share-saved__close"
				aria-label="Dismiss saved-copy message"
				onClick={dismiss}
			>
				<CloseIcon size={16} />
			</button>
		</div>
	);
}

const ERROR_COPY: Record<string, { title: string; body: string }> = {
	invalid: {
		title: "This share link didn’t work.",
		body: "It looks incomplete or damaged. Chat apps can cut long links — ask the sender to resend it as one line.",
	},
	corrupt: {
		title: "This share link didn’t work.",
		body: "It looks incomplete or damaged. Chat apps can cut long links — ask the sender to resend it as one line.",
	},
	"unsupported-version": {
		title: "This share link is from a newer version.",
		body: "Reload Pedalvision to get the latest version, or ask the sender to re-share it.",
	},
	"too-large": {
		title: "This share link is too big to open.",
		body: "It’s over the 200 KB share limit, so it wasn’t loaded.",
	},
};

/** Invalid/oversize link over the recipient's normal scene. Never destructive. */
export function ShareErrorNotice() {
	const error = useShare((state) => state.error);
	const headingRef = useRef<HTMLHeadingElement>(null);
	useEffect(() => {
		if (!error) return;
		headingRef.current?.focus();
	}, [error]);
	if (!error) return null;
	const copy = ERROR_COPY[error.reason] ?? ERROR_COPY.invalid;
	const dismiss = () => {
		dismissShareError();
		requestAnimationFrame(() => {
			document.querySelector<HTMLElement>("[data-scene-trigger]")?.focus();
		});
	};
	return (
		<div
			className="share-error"
			data-testid="share-error"
			data-reason={error.reason}
		>
			<p className="share-error__eyebrow">
				<WarningIcon size={14} />
				Link didn’t open
			</p>
			<h2
				ref={headingRef}
				tabIndex={-1}
				className="share-error__title"
				data-testid="share-error-title"
			>
				{copy.title}
			</h2>
			<div className="share-error__body" role="alert">
				<p>{copy.body}</p>
				<p className="share-error__trust">Your scene is unchanged.</p>
			</div>
			<button
				type="button"
				className="share-error__dismiss"
				data-testid="share-error-dismiss"
				onClick={dismiss}
			>
				Dismiss
			</button>
		</div>
	);
}
