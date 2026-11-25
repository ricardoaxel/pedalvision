import { useBoardDrag } from "../state/boardDrag";
import { useCableDrag } from "../state/cableDrag";
import { useDrag } from "../state/drag";
import { useEndpointDrag } from "../state/endpointDrag";
import { useGesture } from "../state/gesture";
import { useJackProof } from "../state/jackProof";

/**
 * True while any canvas gesture owns the pointer (F-07). Konva does not capture
 * pointers, so live hit-testing keeps firing enter/leave mid-drag; hover must
 * stay silent until the gesture ends so the canvas does not flicker.
 */
export function isCanvasGestureActive(): boolean {
	return (
		useGesture.getState().navigating ||
		useDrag.getState().liftedUid !== null ||
		useBoardDrag.getState().uid !== "" ||
		useCableDrag.getState().source !== null ||
		useEndpointDrag.getState().uid !== null ||
		useJackProof.getState().drag !== null
	);
}
