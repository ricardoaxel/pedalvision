import { create } from "zustand";
import type { DisplayUnits } from "../lib/geometry";
import { DEFAULT_GRID_STEP_CM, type GridStepCm } from "../lib/grid";
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
	/** Fixed dot-grid step (cm); the visible pitch respects the 16 px floor. */
	gridStepCm: GridStepCm;
	setGridStepCm: (gridStepCm: GridStepCm) => void;
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
	gridStepCm: DEFAULT_GRID_STEP_CM,
	setGridStepCm: (gridStepCm) => {
		set({ gridStepCm });
		writeSettings({ gridStepCm });
	},
}));

/** Load persisted settings before the first render. */
export function hydrateSettings(): void {
	const settings = readSettings();
	useSettings.setState({
		units: settings.units,
		showCables: settings.showCables,
		gridStepCm: settings.gridStepCm,
	});
}
