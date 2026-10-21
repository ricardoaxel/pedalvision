import { create } from "zustand";

/**
 * Transient board transform while the board is dragged/rotated (P4-02 bug fix).
 * The board group moves natively in Konva and only commits to the scene on
 * release; incident cables must follow it frame-by-frame, so the live world
 * origin + rotation lives here (never in the scene store, never in history).
 */
export interface BoardDragTransform {
	uid: string;
	x: number;
	y: number;
	rotationDeg: number;
	/** "drag" = board translation (hide the rotate handle); "transform" = rotate. */
	kind: "drag" | "transform";
}

interface BoardDragState extends BoardDragTransform {
	begin: (transform: BoardDragTransform) => void;
	set: (transform: Omit<BoardDragTransform, "uid">) => void;
	clear: () => void;
}

export const useBoardDrag = create<BoardDragState>((set) => ({
	uid: "",
	x: 0,
	y: 0,
	rotationDeg: 0,
	kind: "drag",
	begin: (transform) => set(transform),
	set: (transform) => set(transform),
	clear: () => set({ uid: "", x: 0, y: 0, rotationDeg: 0, kind: "drag" }),
}));
