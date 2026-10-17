import { useState } from "react";
import { ItemActionBar } from "./canvas/ItemActionBar";
import { Stage } from "./canvas/Stage";
import { useSelectionShortcuts } from "./canvas/useSelectionShortcuts";
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
					<PedalGlyph />
					<PlusGlyph />
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
					<BoardGlyph />
					<PlusGlyph />
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

/** Pedal glyph (20px, currentColor) for the "Add pedal" toolbar button. */
function PedalGlyph() {
	return (
		<svg
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.8"
			strokeLinecap="round"
			aria-hidden="true"
		>
			<rect x="5" y="3" width="14" height="18" rx="2" />
			<circle cx="9.5" cy="8" r="1.4" />
			<circle cx="14.5" cy="8" r="1.4" />
			<path d="M9.5 13h5" />
		</svg>
	);
}

/** Board glyph (20px, currentColor) for the "Add board" toolbar button. */
function BoardGlyph() {
	return (
		<svg
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.8"
			strokeLinecap="round"
			aria-hidden="true"
		>
			<rect x="2.5" y="7" width="19" height="10" rx="2" />
			<path d="M6 7v10M18 7v10" opacity="0.5" />
		</svg>
	);
}

/** Small plus (12px) marking both toolbar buttons as "add". */
function PlusGlyph() {
	return (
		<svg
			width="12"
			height="12"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2.4"
			strokeLinecap="round"
			aria-hidden="true"
		>
			<path d="M12 5v14M5 12h14" />
		</svg>
	);
}

export default App;
