import { useState } from "react";
import { ItemActionBar } from "./canvas/ItemActionBar";
import { Stage } from "./canvas/Stage";
import { useSelectionShortcuts } from "./canvas/useSelectionShortcuts";
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
		setEditingCustomRefId(null);
		setPickerTab(tab);
		setPickerOpen(true);
	};

	const openCustomEdit = (refId: string) => {
		setEditingCustomRefId(refId);
		setPickerTab("custom");
		setPickerOpen(true);
	};

	const closePicker = () => {
		setPickerOpen(false);
		setEditingCustomRefId(null);
	};

	return (
		<main className="app" data-panel={selectedItemUid ? "open" : undefined}>
			<h1 className="visually-hidden">Pedalvision</h1>
			<div className="app-canvas">
				<Stage />
				{/* HTML selection chrome (Konva can't host DOM). A sibling of the stage
				 * so its presses never reach the canvas gesture handler. */}
				<ItemActionBar onEditCustom={openCustomEdit} />
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
					<button type="button" className="hud-button" onClick={toggleTheme}>
						{theme === "dark" ? "Light" : "Dark"} theme
					</button>
				</div>
			</div>
			{/* The selected part's readout + the space warning (P2-03). */}
			<InfoPanel />
			<Picker
				open={pickerOpen}
				tab={pickerTab}
				editRefId={editingCustomRefId}
				onOpen={openPicker}
				onTab={setPickerTab}
				onClearEdit={() => setEditingCustomRefId(null)}
				onClose={closePicker}
			/>
		</main>
	);
}

export default App;
