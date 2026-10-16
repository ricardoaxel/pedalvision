import { useState } from "react";
import { ItemActionBar } from "./canvas/ItemActionBar";
import { Stage } from "./canvas/Stage";
import { useSelectionShortcuts } from "./canvas/useSelectionShortcuts";
import { BoardPicker } from "./components/BoardPicker";
import { PedalPicker } from "./components/PedalPicker";

type Theme = "dark" | "light";

function App() {
	// TODO(P1): move to the persisted settings store. Kept minimal here so the
	// canvas theme map (Konva can't read CSS vars) can be verified live.
	const [theme, setTheme] = useState<Theme>("dark");
	// Delete/duplicate shortcuts for the selected pedal (F6).
	useSelectionShortcuts();

	const toggleTheme = () => {
		const next: Theme = theme === "dark" ? "light" : "dark";
		document.documentElement.dataset.theme = next;
		setTheme(next);
	};

	return (
		<main className="app">
			<h1 className="visually-hidden">Pedalvision</h1>
			<Stage />
			<div className="picker-rail">
				<BoardPicker />
				<PedalPicker />
			</div>
			{/* HTML selection chrome (Konva can't host DOM). A sibling of the stage
			 * so its presses never reach the canvas gesture handler. */}
			<ItemActionBar />
			<button type="button" className="hud-button" onClick={toggleTheme}>
				{theme === "dark" ? "Light" : "Dark"} theme
			</button>
		</main>
	);
}

export default App;
