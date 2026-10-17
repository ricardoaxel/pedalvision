import { useState } from "react";
import { ItemActionBar } from "./canvas/ItemActionBar";
import { Stage } from "./canvas/Stage";
import { useSelectionShortcuts } from "./canvas/useSelectionShortcuts";
import { BoardIcon, PedalIcon, PlusIcon } from "./components/icons";
import { Picker, type PickerTab } from "./components/Picker";

type Theme = "dark" | "light";

function App() {
	// TODO(P1): move to the persisted settings store. Kept minimal here so the
	// canvas theme map (Konva can't read CSS vars) can be verified live.
	const [theme, setTheme] = useState<Theme>("dark");
	// Picker (P2-01): desktop opens a modal from the toolbar; mobile raises the
	// sheet from the persistent bottom tab bar.
	const [pickerOpen, setPickerOpen] = useState(false);
	const [pickerTab, setPickerTab] = useState<PickerTab>("pedals");
	// Delete/duplicate shortcuts for the selected pedal (F6).
	useSelectionShortcuts();

	const toggleTheme = () => {
		const next: Theme = theme === "dark" ? "light" : "dark";
		document.documentElement.dataset.theme = next;
		setTheme(next);
	};

	const openPicker = (tab: PickerTab) => {
		setPickerTab(tab);
		setPickerOpen(true);
	};

	return (
		<main className="app">
			<h1 className="visually-hidden">Pedalvision</h1>
			<Stage />
			{/* HTML selection chrome (Konva can't host DOM). A sibling of the stage
			 * so its presses never reach the canvas gesture handler. */}
			<ItemActionBar />
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
			<Picker
				open={pickerOpen}
				tab={pickerTab}
				onOpen={openPicker}
				onTab={setPickerTab}
				onClose={() => setPickerOpen(false)}
			/>
		</main>
	);
}

export default App;
