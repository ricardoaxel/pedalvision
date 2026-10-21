import { create } from "zustand";
import type { DisplayUnits } from "../lib/geometry";
import { readSettings, writeSettings } from "../lib/sceneIndex";

/**
 * App-wide display settings (design.md §Data model `Settings`). Stored in
 * `localStorage` alongside the scene index; geometry stays cm.
 */
interface SettingsStore {
	units: DisplayUnits;
	setUnits: (units: DisplayUnits) => void;
	/** Canvas view preference: show cables, jack ticks and endpoints. */
	showCables: boolean;
	setShowCables: (showCables: boolean) => void;
}

export const useSettings = create<SettingsStore>((set) => ({
	units: "cm",
	setUnits: (units) => {
		set({ units });
		writeSettings({ units });
	},
	showCables: false,
	setShowCables: (showCables) => {
		set({ showCables });
		writeSettings({ showCables });
	},
}));

/** Load persisted settings before the first render. */
export function hydrateSettings(): void {
	const settings = readSettings();
	useSettings.setState({
		units: settings.units,
		showCables: settings.showCables,
	});
}
