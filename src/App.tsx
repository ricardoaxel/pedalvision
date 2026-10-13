import { useState } from "react";

type Theme = "dark" | "light";

function App() {
	const [theme, setTheme] = useState<Theme>("dark");

	// TODO(P1): replace with the real theme switcher (persisted settings store).
	// Temporary; exists only to prove the variables-only `data-theme` override.
	const toggleTheme = () => {
		const next: Theme = theme === "dark" ? "light" : "dark";
		document.documentElement.dataset.theme = next;
		setTheme(next);
	};

	return (
		<main className="app dot-grid">
			<section className="panel">
				<p className="panel__eyebrow">True-scale planner</p>
				<h1 className="panel__title">Pedalvision</h1>
				<p className="panel__text">2D true-scale guitar pedalboard planner.</p>
				<div className="badges">
					<span className="badge badge--accent">Accent</span>
					<span className="badge badge--warning">Warning</span>
					<span className="badge badge--danger">Danger</span>
				</div>
				<button type="button" className="button" onClick={toggleTheme}>
					Switch to {theme === "dark" ? "light" : "dark"} theme
				</button>
			</section>
		</main>
	);
}

export default App;
