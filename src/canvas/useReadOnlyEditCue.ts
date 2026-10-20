import { useEffect } from "react";
import { useReadOnly } from "../state/readOnly";

/** Screen px a read-only press may travel before it counts as an edit attempt. */
export const READ_ONLY_ATTEMPT_THRESHOLD_PX = 4;

/**
 * Read-only share cue (P3-03). A press on a board/pedal can still select and
 * open the info panel, so we only explain "can't edit" once the pointer has
 * actually moved like a drag. The object-specific red outline + inline message
 * are driven by `readOnly.cue`; this hook only upgrades an attempt to a cue.
 */
export function useReadOnlyEditCue(): void {
	useEffect(() => {
		const onMove = (event: PointerEvent) => {
			const attempt = useReadOnly.getState().attempt;
			if (!attempt) return;
			const moved = Math.hypot(
				event.clientX - attempt.startClient.x,
				event.clientY - attempt.startClient.y,
			);
			if (moved >= READ_ONLY_ATTEMPT_THRESHOLD_PX) {
				useReadOnly.getState().showCue();
			}
		};
		const onEnd = () => useReadOnly.getState().cancelAttempt();
		window.addEventListener("pointermove", onMove);
		window.addEventListener("pointerup", onEnd);
		window.addEventListener("pointercancel", onEnd);
		return () => {
			window.removeEventListener("pointermove", onMove);
			window.removeEventListener("pointerup", onEnd);
			window.removeEventListener("pointercancel", onEnd);
		};
	}, []);
}
