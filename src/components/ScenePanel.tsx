import {
	type KeyboardEvent as ReactKeyboardEvent,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { capacityStatus } from "../lib/capacity";
import type { SceneIndexEntry } from "../lib/sceneIndex";
import {
	MAX_SCENES,
	SCENE_NAME_MAX_LENGTH,
	sceneLibrary,
	useSceneLibrary,
} from "../state/library";
import { useScene } from "../state/scene";
import {
	CheckIcon,
	CloseIcon,
	PencilIcon,
	SceneIcon,
	TrashIcon,
} from "./icons";

const PANEL_TITLE_ID = "scene-panel-title";
const STATUS_ID = "scene-panel-status";
const CAPACITY_ID = "scene-panel-capacity";
const LAST_SCENE_HINT_ID = "scene-panel-last-hint";
const SCENE_LIMIT_HINT_ID = "scene-panel-limit-hint";

const timeFormat = new Intl.DateTimeFormat("en-US", {
	hour: "2-digit",
	minute: "2-digit",
});
const dayMonthFormat = new Intl.DateTimeFormat("en-US", {
	day: "numeric",
	month: "short",
});
const dayMonthYearFormat = new Intl.DateTimeFormat("en-US", {
	day: "numeric",
	month: "short",
	year: "numeric",
});

function sameDay(a: Date, b: Date): boolean {
	return (
		a.getFullYear() === b.getFullYear() &&
		a.getMonth() === b.getMonth() &&
		a.getDate() === b.getDate()
	);
}

/** `Updated 14:02` today / `Updated 12 Oct` this year / with the year older. */
export function formatUpdated(iso: string, now = new Date()): string {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return "Updated";
	if (sameDay(date, now)) return `Updated ${timeFormat.format(date)}`;
	if (date.getFullYear() === now.getFullYear()) {
		return `Updated ${dayMonthFormat.format(date)}`;
	}
	return `Updated ${dayMonthYearFormat.format(date)}`;
}

function plural(count: number, singular: string, pluralForm: string): string {
	return `${count} ${count === 1 ? singular : pluralForm}`;
}

function countsMeta(entry: SceneIndexEntry): string | null {
	const parts: string[] = [];
	if (entry.boardCount !== undefined) {
		parts.push(plural(entry.boardCount, "board", "boards"));
	}
	if (entry.itemCount !== undefined) {
		parts.push(plural(entry.itemCount, "part", "parts"));
	}
	return parts.length > 0 ? parts.join(" · ") : null;
}

/** Row meta: `Updated 14:02 · 2 boards · 14 parts`. */
export function sceneMeta(entry: SceneIndexEntry, now = new Date()): string {
	const counts = countsMeta(entry);
	const parts = [formatUpdated(entry.updatedAt, now)];
	if (counts) parts.push(counts);
	return parts.join(" · ");
}

/**
 * Mobile meta: counts only. The timestamp is what overflows the narrow row
 * (the desktop row keeps both), so dropping it avoids an inconsistent ellipsis.
 */
export function sceneMetaCompact(entry: SceneIndexEntry): string {
	return countsMeta(entry) ?? formatUpdated(entry.updatedAt);
}

function focusSceneButton(id: string | null) {
	requestAnimationFrame(() => {
		const target = id
			? document.querySelector<HTMLElement>(
					`[data-scene-open="${CSS.escape(id)}"]`,
				)
			: null;
		(
			target ??
			document.querySelector<HTMLElement>("[data-scene-open]") ??
			document.querySelector<HTMLElement>("[data-scene-new]")
		)?.focus();
	});
}

/** Trigger glyph + current scene name, shared by the toolbar plate. */
export function SceneTriggerContent() {
	const name = useSceneLibrary((state) => {
		const active = state.scenes.find((entry) => entry.id === state.activeId);
		return active?.name ?? "Untitled scene";
	});
	// The only cue while the register is closed: a small danger dot at hard /
	// over-cap. Soft stays silent in the chrome (owner: no needless noise).
	const atCapacity = useScene(
		(state) => capacityStatus(state).level === "hard",
	);
	return (
		<>
			<SceneIcon size={16} />
			<span className="scene-trigger__name">{name}</span>
			{atCapacity ? (
				<span className="scene-trigger__dot" aria-hidden="true" />
			) : null}
			<span className="scene-trigger__chevron" aria-hidden="true">
				<svg
					width="14"
					height="14"
					viewBox="0 0 24 24"
					aria-hidden="true"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
				>
					<path d="M6 9l6 6 6-6" />
				</svg>
			</span>
		</>
	);
}

interface ScenePanelProps {
	onClose: () => void;
}

/**
 * P3-02 scene manager — owner-approved **"Title Block"** direction
 * (2026-10-19). A non-modal **Sheet Register**: desktop dock top-left, mobile
 * sheet above the persistent tab bar. Scene switching keeps the register open,
 * rename is inline, and delete confirms inline (never `confirm()`). The current
 * scene name is always visible on the top-left plate.
 */
export function ScenePanel({ onClose }: ScenePanelProps) {
	const scenes = useSceneLibrary((state) => state.scenes);
	const activeId = useSceneLibrary((state) => state.activeId);
	const saving = useSceneLibrary((state) => state.saving);
	const storageAvailable = useSceneLibrary((state) => state.storageAvailable);
	const sessionOnly = useSceneLibrary((state) => state.sessionOnly);
	const boards = useScene((state) => state.boards);
	const items = useScene((state) => state.items);
	const customPedals = useScene((state) => state.customPedals);
	const endpoints = useScene((state) => state.endpoints);
	const cables = useScene((state) => state.cables);
	const capacity = useMemo(
		() => capacityStatus({ boards, items, customPedals, endpoints, cables }),
		[boards, items, customPedals, endpoints, cables],
	);
	const panelRef = useRef<HTMLDivElement>(null);
	const newSceneRef = useRef<HTMLButtonElement>(null);
	const renameInputRef = useRef<HTMLInputElement>(null);
	const keepButtonRef = useRef<HTMLButtonElement>(null);
	const [renamingId, setRenamingId] = useState<string | null>(null);
	const [renameValue, setRenameValue] = useState("");
	const [deletingId, setDeletingId] = useState<string | null>(null);

	// Place focus on the active sheet (fallback: the first sheet / New scene).
	useEffect(() => {
		focusSceneButton(activeId);
	}, [activeId]);

	// Focus the row's editor/confirmation without `autoFocus` (a11y lint).
	useEffect(() => {
		if (!renamingId) return;
		const frame = requestAnimationFrame(() => {
			renameInputRef.current?.focus();
			renameInputRef.current?.select();
		});
		return () => cancelAnimationFrame(frame);
	}, [renamingId]);

	useEffect(() => {
		if (!deletingId) return;
		const frame = requestAnimationFrame(() => keepButtonRef.current?.focus());
		return () => cancelAnimationFrame(frame);
	}, [deletingId]);

	// Non-modal dialog: outside pointerdown closes; the trigger is excluded so
	// its own click can toggle cleanly.
	useEffect(() => {
		const onPointerDown = (event: PointerEvent) => {
			const target = event.target as Node | null;
			if (!target || panelRef.current?.contains(target)) return;
			if (target instanceof Element && target.closest("[data-scene-trigger]")) {
				return;
			}
			onClose();
		};
		document.addEventListener("pointerdown", onPointerDown);
		return () => document.removeEventListener("pointerdown", onPointerDown);
	}, [onClose]);

	// Escape closes; while renaming/deleting it cancels that row first.
	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return;
			event.preventDefault();
			if (renamingId) {
				setRenamingId(null);
				focusSceneButton(renamingId);
				return;
			}
			if (deletingId) {
				const id = deletingId;
				setDeletingId(null);
				requestAnimationFrame(() => {
					document
						.querySelector<HTMLElement>(
							`[data-scene-delete="${CSS.escape(id)}"]`,
						)
						?.focus();
				});
				return;
			}
			onClose();
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [deletingId, onClose, renamingId]);

	const startRename = (entry: SceneIndexEntry) => {
		if (sessionOnly) return;
		setDeletingId(null);
		setRenamingId(entry.id);
		setRenameValue(entry.name);
	};

	const submitRename = async (id: string) => {
		const ok = await sceneLibrary.renameScene(id, renameValue);
		setRenamingId(null);
		if (ok) focusSceneButton(id);
		else {
			requestAnimationFrame(() => {
				document
					.querySelector<HTMLElement>(`[data-scene-rename="${CSS.escape(id)}"]`)
					?.focus();
			});
		}
	};

	const cancelRename = (id: string) => {
		setRenamingId(null);
		requestAnimationFrame(() => {
			document
				.querySelector<HTMLElement>(`[data-scene-rename="${CSS.escape(id)}"]`)
				?.focus();
		});
	};

	const confirmDelete = async (id: string) => {
		const ok = await sceneLibrary.deleteScene(id);
		setDeletingId(null);
		if (ok) focusSceneButton(null);
	};

	const openScene = async (id: string) => {
		if (id === activeId) return;
		await sceneLibrary.switchScene(id);
	};

	const createScene = async () => {
		await sceneLibrary.newScene();
		focusSceneButton(null);
	};

	// Up/Down moves between sheet open buttons (Tab still works).
	const onListKeyDown = (event: ReactKeyboardEvent<HTMLUListElement>) => {
		if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
		const buttons = [
			...event.currentTarget.querySelectorAll<HTMLElement>("[data-scene-open]"),
		];
		if (buttons.length === 0) return;
		const index = buttons.indexOf(document.activeElement as HTMLElement);
		if (index === -1) return;
		event.preventDefault();
		const next =
			event.key === "ArrowDown"
				? buttons[(index + 1) % buttons.length]
				: buttons[(index - 1 + buttons.length) % buttons.length];
		next.focus();
	};

	const hasOneScene = scenes.length <= 1;
	const atSceneLimit = scenes.length >= MAX_SCENES;

	return (
		<div
			ref={panelRef}
			id="scene-panel"
			className="scene-panel"
			data-testid="scene-panel"
			role="dialog"
			aria-modal="false"
			aria-labelledby={PANEL_TITLE_ID}
			aria-describedby={STATUS_ID}
		>
			<header className="scene-panel__header">
				<div className="scene-panel__heading">
					<span className="scene-panel__eyebrow">
						Scene register · {scenes.length}{" "}
						{scenes.length === 1 ? "scene" : "scenes"}
					</span>
					<h2 id={PANEL_TITLE_ID} className="scene-panel__title">
						Scenes
					</h2>
					{storageAvailable ? (
						<p
							id={STATUS_ID}
							className="scene-panel__status"
							role="status"
							aria-live="polite"
						>
							{saving ? "Saving…" : "Saved"}
						</p>
					) : (
						<p id={STATUS_ID} className="scene-panel__status" hidden />
					)}
					{/* Load Chart (P3-06): only appears once a budget is tight, so a
					 * healthy scene adds no chrome (owner instruction 2026-10-20). */}
					{capacity.warning ? (
						<p
							id={CAPACITY_ID}
							className="scene-panel__capacity"
							data-testid="scene-capacity"
							data-level={capacity.level}
						>
							<span className="scene-panel__capacity-label">Capacity</span>
							{capacity.warning}
						</p>
					) : null}
				</div>
				<button
					type="button"
					className="scene-panel__close"
					data-testid="scene-close"
					aria-label="Close scenes"
					onClick={onClose}
				>
					<CloseIcon />
				</button>
			</header>

			<ul
				className="scene-list"
				data-testid="scene-list"
				onKeyDown={onListKeyDown}
			>
				{scenes.map((entry, index) => {
					const active = entry.id === activeId;
					const ordinal = String(index + 1).padStart(2, "0");
					if (deletingId === entry.id) {
						return (
							<li
								key={entry.id}
								className="scene-row scene-row--confirm"
								data-testid="scene-delete-confirm"
							>
								<span className="scene-row__ordinal">{ordinal}</span>
								<div className="scene-delete">
									<p className="scene-delete__title">Delete “{entry.name}”?</p>
									<p className="scene-delete__body">
										Its boards and pedals will be gone for good.
									</p>
									<div className="scene-delete__actions">
										<button
											ref={keepButtonRef}
											type="button"
											className="scene-delete__keep"
											onClick={() => {
												setDeletingId(null);
												requestAnimationFrame(() => {
													document
														.querySelector<HTMLElement>(
															`[data-scene-delete="${CSS.escape(entry.id)}"]`,
														)
														?.focus();
												});
											}}
										>
											Keep
										</button>
										<button
											type="button"
											className="scene-delete__confirm"
											data-testid="scene-delete-confirm-button"
											onClick={() => confirmDelete(entry.id)}
										>
											Delete scene
										</button>
									</div>
								</div>
							</li>
						);
					}
					if (renamingId === entry.id) {
						return (
							<li
								key={entry.id}
								className="scene-row scene-row--editing"
								data-testid="scene-rename"
							>
								<span className="scene-row__ordinal">{ordinal}</span>
								<form
									className="scene-rename"
									onSubmit={(event) => {
										event.preventDefault();
										void submitRename(entry.id);
									}}
								>
									<input
										ref={renameInputRef}
										className="scene-rename__input"
										aria-label="Scene name"
										maxLength={SCENE_NAME_MAX_LENGTH}
										value={renameValue}
										onChange={(event) => setRenameValue(event.target.value)}
									/>
									<button
										type="submit"
										className="scene-rename__action"
										aria-label="Save name"
										disabled={!renameValue.trim()}
									>
										<CheckIcon />
									</button>
									<button
										type="button"
										className="scene-rename__action"
										aria-label="Cancel rename"
										onClick={() => cancelRename(entry.id)}
									>
										<CloseIcon />
									</button>
								</form>
							</li>
						);
					}
					return (
						<li
							key={entry.id}
							className={`scene-row${active ? " scene-row--active" : ""}`}
							data-active={active ? "true" : undefined}
						>
							<span className="scene-row__ordinal">{ordinal}</span>
							<button
								type="button"
								className="scene-row__open"
								data-scene-open={entry.id}
								aria-current={active ? "true" : undefined}
								aria-describedby={
									active && capacity.warning ? CAPACITY_ID : undefined
								}
								disabled={sessionOnly}
								onClick={() => void openScene(entry.id)}
							>
								<span className="scene-row__name">{entry.name}</span>
								<span className="scene-row__meta scene-row__meta--full">
									{sceneMeta(entry)}
								</span>
								<span className="scene-row__meta scene-row__meta--compact">
									{sceneMetaCompact(entry)}
								</span>
							</button>
							<button
								type="button"
								className="scene-row__action"
								data-scene-rename={entry.id}
								aria-label={`Rename ${entry.name}`}
								disabled={sessionOnly}
								onClick={() => startRename(entry)}
							>
								<PencilIcon size={16} />
							</button>
							<button
								type="button"
								className="scene-row__action scene-row__action--danger"
								data-scene-delete={entry.id}
								aria-label={`Delete ${entry.name}`}
								disabled={hasOneScene || sessionOnly}
								aria-describedby={hasOneScene ? LAST_SCENE_HINT_ID : undefined}
								onClick={() => {
									setRenamingId(null);
									setDeletingId(entry.id);
								}}
							>
								<TrashIcon size={16} />
							</button>
						</li>
					);
				})}
			</ul>

			<footer className="scene-panel__footer">
				<p id={LAST_SCENE_HINT_ID} className="visually-hidden">
					Keep at least one scene.
				</p>
				{atSceneLimit ? (
					<p
						id={SCENE_LIMIT_HINT_ID}
						className="scene-panel__limit"
						role="note"
						data-testid="scene-limit"
					>
						Scene limit reached — delete a scene to make room.
					</p>
				) : null}
				<button
					ref={newSceneRef}
					type="button"
					className="scene-panel__new"
					data-testid="scene-new"
					data-scene-new
					disabled={sessionOnly || atSceneLimit}
					aria-describedby={atSceneLimit ? SCENE_LIMIT_HINT_ID : undefined}
					onClick={() => void createScene()}
				>
					<span aria-hidden="true">+</span> New scene
				</button>
			</footer>
		</div>
	);
}
