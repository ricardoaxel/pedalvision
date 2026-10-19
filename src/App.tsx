import { useRef, useState } from "react";
import { BoardActionBar } from "./canvas/BoardActionBar";
import { ItemActionBar } from "./canvas/ItemActionBar";
import { Stage } from "./canvas/Stage";
import { useSelectionShortcuts } from "./canvas/useSelectionShortcuts";
import { ExportPanel, ExportTriggerContent } from "./components/ExportPanel";
import { FirstRunHint } from "./components/FirstRunHint";
import { InfoPanel } from "./components/InfoPanel";
import { BoardIcon, PedalIcon, PlusIcon } from "./components/icons";
import { Picker, type PickerTab } from "./components/Picker";
import { selectSelectedItemUid, useSelection } from "./state/selection";

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
	// P2-03: the info panel is a trailing push rail (desktop) / bottom sheet
	// (mobile), shown only while an item is selected.
	const selectedItemUid = useSelection(selectSelectedItemUid);
	// Delete/duplicate shortcuts for the selected pedal (F6).
	useSelectionShortcuts();

	const toggleTheme = () => {
		const next: Theme = theme === "dark" ? "light" : "dark";
		document.documentElement.dataset.theme = next;
		setTheme(next);
	};

	const openPicker = (tab: PickerTab) => {
		setExportOpen(false);
		setExportBusy(false);
		setEditingCustomRefId(null);
		setEditingBoardUid(null);
		setPickerTab(tab);
		setPickerOpen(true);
	};

	const openExport = () => {
		setPickerOpen(false);
		setEditingCustomRefId(null);
		setEditingBoardUid(null);
		setExportBusy(false);
		setExportOpen(true);
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
		>
			<h1 className="visually-hidden">Pedalvision</h1>
			<div className="app-canvas">
				<Stage />
				{/* HTML selection chrome (Konva can't host DOM). A sibling of the stage
				 * so its presses never reach the canvas gesture handler. */}
				<ItemActionBar onEditCustom={openCustomEdit} />
				<BoardActionBar onEditBoard={openBoardEdit} />
				{/* First-run "Bench Note" (P2-08): small, dismissible, non-modal. */}
				<FirstRunHint onAddBoard={() => openPicker("boards")} />
				<div className="app-toolbar">
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
					<button type="button" className="hud-button" onClick={toggleTheme}>
						{theme === "dark" ? "Light" : "Dark"} theme
					</button>
				</div>
				{exportOpen ? (
					<ExportPanel
						onClose={closeExport}
						onAddBoard={() => openPicker("boards")}
						onBusyChange={setExportBusy}
					/>
				) : null}
			</div>
			{/* The selected part's readout + the space warning (P2-03). */}
			<InfoPanel />
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
		</main>
	);
}

export default App;
