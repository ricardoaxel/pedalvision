import { useEffect, useRef, useState } from "react";
import { BoardActionBar } from "./canvas/BoardActionBar";
import { GraphActionBar } from "./canvas/GraphActionBar";
import { ItemActionBar } from "./canvas/ItemActionBar";
import { Stage } from "./canvas/Stage";
import { useHistoryShortcuts } from "./canvas/useHistoryShortcuts";
import { useReadOnlyEditCue } from "./canvas/useReadOnlyEditCue";
import { useSelectionShortcuts } from "./canvas/useSelectionShortcuts";
import { CapacityAnnouncer } from "./components/CapacityAnnouncer";
import {
	EndpointControl,
	EndpointPlacementOverlay,
	GraphStatusChip,
} from "./components/EndpointControls";
import { ExportPanel, ExportTriggerContent } from "./components/ExportPanel";
import { FirstRunHint } from "./components/FirstRunHint";
import { HistoryControls } from "./components/HistoryControls";
import { InfoPanel } from "./components/InfoPanel";
import {
	BoardIcon,
	MoonIcon,
	PedalIcon,
	PlusIcon,
	SunIcon,
} from "./components/icons";
import { Picker, type PickerTab } from "./components/Picker";
import { ScenePanel, SceneTriggerContent } from "./components/ScenePanel";
import { SharePanel, ShareTriggerContent } from "./components/SharePanel";
import {
	ShareActions,
	ShareEditCue,
	ShareErrorNotice,
	ShareSavedNotice,
	ShareStamp,
} from "./components/ShareView";
import { StorageAnnouncer, StorageNotice } from "./components/StorageNotice";
import { capacityStatus } from "./lib/capacity";
import { useCableDrag } from "./state/cableDrag";
import { useEndpointPlacement } from "./state/endpointPlacement";
import { useSceneLibrary } from "./state/library";
import { useReadOnly } from "./state/readOnly";
import { useScene } from "./state/scene";
import { selectSelectedItemUid, useSelection } from "./state/selection";
import { useSettings } from "./state/settings";
import { useShare } from "./state/share";

type Theme = "dark" | "light";

function App() {
	// TODO(P1): move to the persisted settings store. Kept minimal here so the
	// canvas theme map (Konva can't read CSS vars) can be verified live.
	const [theme, setTheme] = useState<Theme>("dark");
	// Picker (P2-01): desktop opens a modal from the toolbar; mobile raises the
	// sheet from the persistent bottom tab bar.
	const [pickerOpen, setPickerOpen] = useState(false);
	const [pickerTab, setPickerTab] = useState<PickerTab>("pedals");
	// P2-02 edit: when set, the picker opens on Custom in edit mode.
	const [editingCustomRefId, setEditingCustomRefId] = useState<string | null>(
		null,
	);
	// P2-05 edit: when set, the picker opens on Custom in board-edit mode.
	const [editingBoardUid, setEditingBoardUid] = useState<string | null>(null);
	// P3-01 export: a non-modal Print Ticket surface anchored to the toolbar.
	const [exportOpen, setExportOpen] = useState(false);
	const [exportBusy, setExportBusy] = useState(false);
	const exportTriggerRef = useRef<HTMLButtonElement>(null);
	// P3-02 scenes: an always-visible current-scene plate opening the register.
	const [scenesOpen, setScenesOpen] = useState(false);
	const sceneTriggerRef = useRef<HTMLButtonElement>(null);
	// P3-03: a share link opens a read-only preview; the Share panel is sender-only.
	const [shareOpen, setShareOpen] = useState(false);
	const shareTriggerRef = useRef<HTMLButtonElement>(null);
	const readOnly = useReadOnly((state) => state.readOnly);
	const shareStatus = useShare((state) => state.status);
	const showCables = useSettings((state) => state.showCables);
	const storageLevel = useSceneLibrary((state) => state.storageHealth.level);
	const previousReadOnly = useRef(readOnly);
	useEffect(() => {
		if (previousReadOnly.current && !readOnly) {
			requestAnimationFrame(() => sceneTriggerRef.current?.focus());
		}
		previousReadOnly.current = readOnly;
	}, [readOnly]);
	const activeSceneName = useSceneLibrary((state) => {
		const active = state.scenes.find((entry) => entry.id === state.activeId);
		return active?.name ?? "Untitled scene";
	});
	// Load Chart (P3-06): only hard/over-cap reaches the closed trigger, and only
	// in its accessible name (the dot is decorative). No noise at ok/soft.
	const sceneCapacitySuffix = useScene((state) => {
		const status = capacityStatus(state);
		if (status.level !== "hard") return "";
		const over =
			status.items.over ||
			status.images.over ||
			status.boards.over ||
			status.graph.over;
		return over ? " — over capacity, this scene still opens" : " — at capacity";
	});
	// P2-03: the info panel is a trailing push rail (desktop) / bottom sheet
	// (mobile), shown only while an item is selected.
	const selectedItemUid = useSelection(selectSelectedItemUid);
	// Delete/duplicate shortcuts for the selected pedal (F6).
	useSelectionShortcuts();
	// Undo/redo shortcuts (P3-04): Cmd/Ctrl+Z / Cmd/Ctrl+Shift+Z.
	useHistoryShortcuts();
	// Explain read-only drag attempts on a shared scene (P3-03).
	useReadOnlyEditCue();
	// Hiding the graph is a view-only preference: drop cable/endpoint edit state.
	useEffect(() => {
		if (showCables) return;
		const selection = useSelection.getState();
		if (
			selection.selection?.kind === "cable" ||
			selection.selection?.kind === "endpoint"
		) {
			selection.clearSelection();
		}
		useCableDrag.getState().cancel();
		useEndpointPlacement.getState().disarm();
	}, [showCables]);

	const toggleTheme = () => {
		const next: Theme = theme === "dark" ? "light" : "dark";
		document.documentElement.dataset.theme = next;
		setTheme(next);
	};

	const openPicker = (tab: PickerTab) => {
		useShare.getState().dismissSaved();
		useEndpointPlacement.getState().disarm();
		useCableDrag.getState().cancel();
		setExportOpen(false);
		setExportBusy(false);
		setScenesOpen(false);
		setShareOpen(false);
		setEditingCustomRefId(null);
		setEditingBoardUid(null);
		setPickerTab(tab);
		setPickerOpen(true);
	};

	const openExport = () => {
		useShare.getState().dismissSaved();
		useEndpointPlacement.getState().disarm();
		useCableDrag.getState().cancel();
		setPickerOpen(false);
		setEditingCustomRefId(null);
		setEditingBoardUid(null);
		setExportBusy(false);
		setScenesOpen(false);
		setShareOpen(false);
		setExportOpen(true);
	};

	const openScenes = () => {
		useShare.getState().dismissSaved();
		useEndpointPlacement.getState().disarm();
		useCableDrag.getState().cancel();
		setPickerOpen(false);
		setEditingCustomRefId(null);
		setEditingBoardUid(null);
		setExportOpen(false);
		setExportBusy(false);
		setShareOpen(false);
		setScenesOpen(true);
	};

	const openShare = () => {
		useEndpointPlacement.getState().disarm();
		useCableDrag.getState().cancel();
		setPickerOpen(false);
		setEditingCustomRefId(null);
		setEditingBoardUid(null);
		setExportOpen(false);
		setExportBusy(false);
		setScenesOpen(false);
		setShareOpen(true);
	};

	const closeShare = () => {
		setShareOpen(false);
		requestAnimationFrame(() => shareTriggerRef.current?.focus());
	};

	// Close + return focus to the trigger (the non-modal dialog's contract).
	const closeScenes = () => {
		setScenesOpen(false);
		requestAnimationFrame(() => sceneTriggerRef.current?.focus());
	};

	// Close + return focus to the trigger (the non-modal dialog's contract).
	const closeExport = () => {
		setExportOpen(false);
		setExportBusy(false);
		requestAnimationFrame(() => exportTriggerRef.current?.focus());
	};

	const openCustomEdit = (refId: string) => {
		setEditingCustomRefId(refId);
		setEditingBoardUid(null);
		setPickerTab("custom");
		setPickerOpen(true);
	};

	const openBoardEdit = (uid: string) => {
		setEditingBoardUid(uid);
		setEditingCustomRefId(null);
		setPickerTab("custom");
		setPickerOpen(true);
	};

	const closePicker = () => {
		setPickerOpen(false);
		setEditingCustomRefId(null);
		setEditingBoardUid(null);
	};

	return (
		<main
			className="app"
			data-panel={selectedItemUid ? "open" : undefined}
			data-export={exportOpen ? "open" : undefined}
			data-scenes={scenesOpen ? "open" : undefined}
			data-share={shareStatus === "none" ? undefined : shareStatus}
			data-readonly={readOnly ? "true" : undefined}
			data-storage={storageLevel}
		>
			<h1 className="visually-hidden">Pedalvision</h1>
			<CapacityAnnouncer />
			<StorageAnnouncer readOnly={readOnly} />
			<div className="app-canvas">
				<Stage />
				{/* HTML selection chrome (Konva can't host DOM). A sibling of the stage
				 * so its presses never reach the canvas gesture handler. Read-only
				 * shares keep selection + the info panel, but remove every edit affordance. */}
				{readOnly ? (
					<ShareStamp />
				) : (
					<>
						<ItemActionBar onEditCustom={openCustomEdit} />
						<BoardActionBar onEditBoard={openBoardEdit} />
						<GraphActionBar />
						{/* First-run "Bench Note" (P2-08): one notice at a time — the
						 * storage warning wins while saving is unavailable (P3-05). */}
						{storageLevel === "unavailable" ? null : (
							<FirstRunHint onAddBoard={() => openPicker("boards")} />
						)}
						{/* Storage fallback (P3-05): inline, non-modal, never a toast. */}
						<StorageNotice />
						<button
							ref={sceneTriggerRef}
							type="button"
							className="scene-trigger"
							data-testid="scene-open"
							data-scene-trigger
							aria-label={`Scenes — current: ${activeSceneName}${sceneCapacitySuffix}`}
							aria-haspopup="dialog"
							aria-expanded={scenesOpen}
							aria-controls="scene-panel"
							title={activeSceneName}
							onClick={scenesOpen ? closeScenes : openScenes}
						>
							<SceneTriggerContent />
						</button>
						{scenesOpen ? <ScenePanel onClose={closeScenes} /> : null}
					</>
				)}
				<div className="app-toolbar">
					{readOnly ? (
						<ShareActions />
					) : (
						<>
							<HistoryControls variant="toolbar" />
							<button
								type="button"
								className="app-toolbar__add"
								data-testid="picker-open"
								aria-label="Add pedal"
								aria-haspopup="dialog"
								title="Add pedal"
								onClick={() => openPicker("pedals")}
							>
								<PedalIcon />
								<PlusIcon />
							</button>
							<button
								type="button"
								id="toolbar-add-board"
								className="app-toolbar__add"
								data-testid="picker-open-board"
								aria-label="Add board"
								aria-haspopup="dialog"
								title="Add board"
								onClick={() => openPicker("boards")}
							>
								<BoardIcon />
								<PlusIcon />
							</button>
							<EndpointControl />
							<button
								ref={shareTriggerRef}
								type="button"
								className="hud-button share-trigger"
								data-testid="share-open"
								data-share-trigger
								aria-label="Share scene"
								title="Share scene"
								aria-haspopup="dialog"
								aria-expanded={shareOpen}
								aria-controls="share-panel"
								onClick={shareOpen ? closeShare : openShare}
							>
								<ShareTriggerContent />
							</button>
						</>
					)}
					<button
						ref={exportTriggerRef}
						type="button"
						className="hud-button export-trigger"
						data-testid="export-open"
						aria-label="Export PNG"
						title="Export PNG"
						aria-haspopup="dialog"
						aria-expanded={exportOpen}
						aria-controls="export-panel"
						disabled={exportBusy}
						onClick={exportOpen ? closeExport : openExport}
					>
						<ExportTriggerContent />
					</button>
					<button
						type="button"
						className="hud-button theme-toggle"
						aria-label={
							theme === "dark"
								? "Switch to light theme"
								: "Switch to dark theme"
						}
						title={
							theme === "dark"
								? "Switch to light theme"
								: "Switch to dark theme"
						}
						onClick={toggleTheme}
					>
						{theme === "dark" ? <SunIcon /> : <MoonIcon />}
						<span className="theme-toggle__label">
							{theme === "dark" ? "Light" : "Dark"} theme
						</span>
					</button>
				</div>
				{exportOpen ? (
					<ExportPanel
						onClose={closeExport}
						onAddBoard={() => openPicker("boards")}
						onBusyChange={setExportBusy}
					/>
				) : null}
				<EndpointPlacementOverlay />
				<GraphStatusChip />
				<ShareEditCue />
				{shareOpen && !readOnly ? (
					<SharePanel
						onClose={closeShare}
						onAddBoard={() => {
							setShareOpen(false);
							openPicker("boards");
						}}
					/>
				) : null}
			</div>
			{/* The selected part's readout + the space warning (P2-03). */}
			<InfoPanel />
			{!readOnly ? (
				<Picker
					open={pickerOpen}
					tab={pickerTab}
					editRefId={editingCustomRefId}
					editBoardUid={editingBoardUid}
					onOpen={openPicker}
					onTab={setPickerTab}
					onClearEdit={() => setEditingCustomRefId(null)}
					onClearEditBoard={() => setEditingBoardUid(null)}
					onClose={closePicker}
				/>
			) : null}
			<ShareSavedNotice />
			<ShareErrorNotice />
		</main>
	);
}

export default App;
