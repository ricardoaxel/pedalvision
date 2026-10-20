import { useEffect, useMemo, useRef, useState } from "react";
import { formatEstimatedBytes } from "../lib/capacity";
import {
	SHARE_DECODED_LIMIT_BYTES,
	SHARE_LONG_LINK_THRESHOLD,
} from "../lib/shareLink";
import { useSceneLibrary } from "../state/library";
import { useScene } from "../state/scene";
import { buildShareLink } from "../state/share";
import { CheckIcon, CloseIcon, CopyIcon, LinkIcon } from "./icons";

const TITLE_ID = "share-panel-title";
const HINT_ID = "share-panel-hint";
const STATUS_ID = "share-panel-status";

interface SharePanelProps {
	onClose: () => void;
	/** Empty-state shortcut: close Share and open the board picker. */
	onAddBoard: () => void;
}

function formatLinkSize(chars: number): string {
	if (chars >= 1_000_000) return `${(chars / 1_000_000).toFixed(1)} MB`;
	if (chars >= 1_000) return `${(chars / 1_000).toFixed(1)} KB`;
	return `${chars} B`;
}

/**
 * P3-03 "Transmittal" share panel (owner-approved direction, 2026-10-20).
 * A non-modal docked panel (desktop) / tray above the tab bar (mobile). It
 * generates a self-contained link for the active scene and shows every state
 * inline — never a toast (N8). The sender's address bar is never mutated.
 */
export function SharePanel({ onClose, onAddBoard }: SharePanelProps) {
	const panelRef = useRef<HTMLDivElement>(null);
	const linkRef = useRef<HTMLInputElement>(null);
	const [copied, setCopied] = useState(false);
	const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
	const [copyFailed, setCopyFailed] = useState(false);

	const sceneName = useSceneLibrary((state) => {
		const active = state.scenes.find((entry) => entry.id === state.activeId);
		return active?.name ?? "Untitled scene";
	});
	const boards = useScene((state) => state.boards);
	const items = useScene((state) => state.items);
	const customPedals = useScene((state) => state.customPedals);
	const empty = boards.length === 0 && items.length === 0;

	const result = useMemo(
		() => buildShareLink(sceneName, { boards, items, customPedals }),
		[sceneName, boards, items, customPedals],
	);
	const url = result.ok ? result.url : null;
	const changedSinceCopy =
		copiedUrl !== null && url !== null && copiedUrl !== url;

	// Non-modal dialog: focus the container (not the multi-KB field).
	useEffect(() => {
		panelRef.current?.focus();
	}, []);

	// Escape closes; a click outside closes unless it is the Share trigger.
	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return;
			event.preventDefault();
			onClose();
		};
		const onPointerDown = (event: PointerEvent) => {
			const target = event.target as Node | null;
			if (!target || panelRef.current?.contains(target)) return;
			if (target instanceof Element && target.closest("[data-share-trigger]")) {
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

	const selectLink = () => {
		const field = linkRef.current;
		if (!field) return;
		field.focus();
		field.select();
	};

	const copyLink = async () => {
		if (!url) return;
		setCopyFailed(false);
		try {
			await navigator.clipboard.writeText(url);
			setCopied(true);
			setCopiedUrl(url);
		} catch {
			// Clipboard can be denied (permissions, insecure context). Reveal the
			// selectable field instead of failing silently.
			setCopied(false);
			setCopyFailed(true);
			selectLink();
		}
	};

	const title = empty
		? "Nothing to share yet."
		: result.ok
			? `Share “${sceneName}”`
			: "This scene is too big to share.";

	return (
		<div
			ref={panelRef}
			id="share-panel"
			className="share-panel"
			data-testid="share-panel"
			role="dialog"
			aria-modal="false"
			aria-labelledby={TITLE_ID}
			aria-describedby={HINT_ID}
			tabIndex={-1}
		>
			<header className="share-panel__header">
				<div className="share-panel__heading">
					<span className="share-panel__eyebrow">Share — link</span>
					<h2 id={TITLE_ID} className="share-panel__title" title={title}>
						{title}
					</h2>
				</div>
				<button
					type="button"
					className="share-panel__close"
					data-testid="share-close"
					aria-label="Close share"
					onClick={onClose}
				>
					<CloseIcon />
				</button>
			</header>

			{empty ? (
				<div className="share-panel__body">
					<p id={HINT_ID} className="share-panel__hint">
						Add a board or a pedal, then share it.
					</p>
					<button
						type="button"
						className="share-panel__secondary"
						data-testid="share-add-board"
						onClick={() => {
							onAddBoard();
						}}
					>
						Add a board
					</button>
				</div>
			) : result.ok ? (
				<div className="share-panel__body">
					<p id={HINT_ID} className="share-panel__hint">
						Anyone with the link can view a read-only copy.
					</p>
					<input
						ref={linkRef}
						className="share-panel__link"
						data-testid="share-link"
						type="text"
						readOnly
						value={result.url}
						aria-label="Share link"
						spellCheck={false}
						autoCapitalize="off"
						inputMode="none"
						onFocus={(event) => event.currentTarget.select()}
					/>
					<p className="share-panel__meta">
						Link size {formatLinkSize(result.url.length)} · V1
					</p>
					{result.url.length > SHARE_LONG_LINK_THRESHOLD ? (
						<p className="share-panel__note">
							Long link — some chat apps split it. Paste it as one line.
						</p>
					) : null}
					{changedSinceCopy ? (
						<p
							id={STATUS_ID}
							className="share-panel__note"
							role="status"
							aria-live="polite"
						>
							The scene changed since you copied — copy the link again.
						</p>
					) : null}
					{copyFailed ? (
						<p
							id={STATUS_ID}
							className="share-panel__note share-panel__note--warning"
						>
							Couldn’t copy automatically. The link is selected — copy it from
							here.
						</p>
					) : null}
					<button
						type="button"
						className="share-panel__cta"
						data-testid="share-copy"
						onClick={() => void copyLink()}
					>
						{copied && !changedSinceCopy ? (
							<>
								<CheckIcon size={16} /> Copied
							</>
						) : (
							<>
								<CopyIcon size={16} /> Copy link
							</>
						)}
					</button>
					<p className="share-panel__trust">
						Includes this scene only — your other scenes stay private.
					</p>
					<p className="visually-hidden" role="status" aria-live="polite">
						{copied && !changedSinceCopy ? "Link copied" : ""}
					</p>
				</div>
			) : (
				<div className="share-panel__body">
					<p id={HINT_ID} className="share-panel__hint">
						Share links have a {formatEstimatedBytes(SHARE_DECODED_LIMIT_BYTES)}{" "}
						limit. This scene is {formatEstimatedBytes(result.decodedBytes)}.
						Remove custom parts or split it into two scenes.
					</p>
				</div>
			)}
		</div>
	);
}

/** Trigger glyph + label, shared by the toolbar button. */
export function ShareTriggerContent() {
	return (
		<>
			<LinkIcon size={16} />
			<span className="share-trigger__label">Share</span>
		</>
	);
}
