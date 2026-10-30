import { create } from "zustand";

type PlannerCatalogState = {
	version: number;
	ready: boolean;
	bump: () => void;
};

export const usePlannerCatalog = create<PlannerCatalogState>((set) => ({
	version: 0,
	ready: false,
	bump: () => set((state) => ({ version: state.version + 1, ready: true })),
}));
