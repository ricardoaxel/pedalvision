/**
 * Pedalvision docs/legal hub — tiny, dependency-free theme switch (F-41).
 * Pages are fully readable without JS; the toggle only appears once this runs.
 */
const STORAGE_KEY = "pedalvision.hubTheme.v1";
const root = document.documentElement;

try {
	const saved = localStorage.getItem(STORAGE_KEY);
	if (saved === "light" || saved === "dark") root.dataset.theme = saved;
} catch {
	// Storage may be blocked; the default dark theme is still fine.
}

const button = document.querySelector("[data-theme-toggle]");

if (button) {
	root.dataset.js = "ready";

	const sync = () => {
		const dark = root.dataset.theme !== "light";
		button.textContent = dark ? "Light" : "Dark";
		button.setAttribute(
			"aria-label",
			dark ? "Switch to light theme" : "Switch to dark theme",
		);
	};

	sync();

	button.addEventListener("click", () => {
		const next = root.dataset.theme === "light" ? "dark" : "light";
		root.dataset.theme = next;
		try {
			localStorage.setItem(STORAGE_KEY, next);
		} catch {
			// A blocked store only loses the preference for the next page.
		}
		sync();
	});
}
