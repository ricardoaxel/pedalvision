import { useLayoutEffect, useRef } from "react";
import { FOCUS_LOAD_MAX_SCALE } from "../lib/viewportFocus";
import { focusViewport } from "../state/focus";
import { useSceneLibrary } from "../state/library";
import { useReadOnly } from "../state/readOnly";
import { useViewport } from "../state/viewport";

/**
 * Frame the incoming document on every scene load (F-04): boot, switch, new,
 * delete-active, share-preview enter/exit and save-a-copy. This fixes the
 * "scene opens off-screen / with a stale pan" defect.
 *
 * Triggers are document-level only — `activeId` changes and read-only
 * enter/exit — never ordinary edits, selection, undo or autosave. The layout
 * effect runs before paint once the stage has a measured size, so a boot does
 * not visibly jump from the default transform. Load framing never magnifies
 * past 1× (owner decision 2026-10-28).
 */
export function useSceneAutoFrame(): void {
	const ready = useSceneLibrary((state) => state.ready);
	const activeId = useSceneLibrary((state) => state.activeId);
	const readOnly = useReadOnly((state) => state.readOnly);
	const width = useViewport((state) => state.size.width);
	const height = useViewport((state) => state.size.height);
	const lastKey = useRef<string | null>(null);

	useLayoutEffect(() => {
		if (!ready || width <= 0 || height <= 0) return;
		const key = `${activeId ?? "none"}|${readOnly ? "ro" : "rw"}`;
		if (lastKey.current === key) return;
		// F-05: the first document (boot) snaps; later loads ease the camera.
		const animate = lastKey.current !== null;
		lastKey.current = key;
		focusViewport({
			target: "scene",
			maxScale: FOCUS_LOAD_MAX_SCALE,
			resetOnEmpty: true,
			animate,
		});
	}, [activeId, height, readOnly, ready, width]);
}
