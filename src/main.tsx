import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { hydrateScene, startScenePersistence } from "./state/persist";

const root = document.getElementById("root");
if (!root) {
	throw new Error("Root element #root not found");
}

// Temporary v1 save (P1-06; full save system is P3-02): load any saved scene
// before the first render, then mirror further changes to localStorage.
hydrateScene();
startScenePersistence();

createRoot(root).render(
	<StrictMode>
		<App />
	</StrictMode>,
);
