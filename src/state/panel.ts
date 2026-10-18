import { create } from "zustand";

/**
 * Measured chrome metrics shared across HTML panels (P2-03). The mobile info
 * sheet and the item action bar are separate components that both reserve space
 * above the persistent tab bar; the sheet reports its real height here so the
 * bar can always clear it (a fixed guess was wrong once the name wraps).
 */
interface PanelMetrics {
	/** The info sheet's rendered height in px (0 when no panel/desktop). */
	sheetHeight: number;
	setSheetHeight: (height: number) => void;
}

export const usePanelMetrics = create<PanelMetrics>((set) => ({
	sheetHeight: 0,
	setSheetHeight: (sheetHeight) => set({ sheetHeight }),
}));
