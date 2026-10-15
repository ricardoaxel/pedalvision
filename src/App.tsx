import { useState } from "react";
import { Stage } from "./canvas/Stage";
import { BoardPicker } from "./components/BoardPicker";
import { PedalPicker } from "./components/PedalPicker";

type Theme = "dark" | "light";

function App() {
	// TODO(P1): move to the persisted settings store. Kept minimal here so the
	// canvas theme map (Konva can't read CSS vars) can be verified live.
	const [theme, setTheme] = useState<Theme>("dark");

	const toggleTheme = () => {
		const next: Theme = theme === "dark" ? "light" : "dark";
		document.documentElement.dataset.theme = next;
		setTheme(next);
	};

	return (
		<main className="app">
			<h1 className="visually-hidden">Pedalvision</h1>
			<Stage />
			<BoardPicker />
			<PedalPicker />
			<button type="button" className="hud-button" onClick={toggleTheme}>
				{theme === "dark" ? "Light" : "Dark"} theme
			</button>
		</main>
	);
}

export default App;
