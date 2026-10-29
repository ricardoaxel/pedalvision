import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { loadPlannerCatalog } from "./catalog/planner";
import { bootScenePersistence } from "./state/persist";
import { hydrateSettings } from "./state/settings";
import { initSharePreview } from "./state/share";

const root = document.getElementById("root");
if (!root) {
	throw new Error("Root element #root not found");
}

async function start() {
	hydrateSettings();
	// Start the bulk overlay without blocking first paint. The picker reacts
	// through the planner store when it arrives; the curated catalog is local.
	const plannerLoad = loadPlannerCatalog();
	// P3-02: open IndexedDB, reconcile the multi-scene index, migrate the legacy
	// mirror once, then hydrate the active scene before the first render.
	// Boot never throws; a blocked store leaves the app running in memory.
	const runtime = await bootScenePersistence();
	// P3-03: a share link is decoded after the recipient's own scene is loaded,
	// then applied as a read-only preview. A damaged link is an inline error.
	await initSharePreview(runtime);
	createRoot(root as HTMLElement).render(
		<StrictMode>
			<App />
		</StrictMode>,
	);
	void plannerLoad;
}

void start();
