import { create } from "zustand";

/** The endpoint kind being placed (owner-approved arm-then-click, P4-02). */
export type EndpointKind = "amp" | "instrument";

interface EndpointPlacementState {
	/** When set, the next canvas tap places this endpoint. */
	kind: EndpointKind | null;
	arm: (kind: EndpointKind) => void;
	disarm: () => void;
}

export const useEndpointPlacement = create<EndpointPlacementState>((set) => ({
	kind: null,
	arm: (kind) => set({ kind }),
	disarm: () => set({ kind: null }),
}));
