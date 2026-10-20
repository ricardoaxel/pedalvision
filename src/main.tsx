import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { bootScenePersistence } from "./state/persist";
import { hydrateSettings } from "./state/settings";

const root = document.getElementById("root");
if (!root) {
	throw new Error("Root element #root not found");
}

async function start() {
	hydrateSettings();
	// P3-02: open IndexedDB, reconcile the multi-scene index, migrate the legacy
	// mirror once, then hydrate the active scene before the first render.
	// Boot never throws; a blocked store leaves the app running in memory.
	await bootScenePersistence();
	createRoot(root as HTMLElement).render(
		<StrictMode>
			<App />
		</StrictMode>,
	);
}

void start();
