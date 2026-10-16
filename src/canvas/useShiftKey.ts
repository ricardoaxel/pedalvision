import { useEffect, useState } from "react";

/**
 * Whether Shift is currently held. Used to gate the Transformer's 15° rotation
 * snap during a rotate drag (design.md §Canvas architecture → free rotation).
 * Tracks the key on every keydown so a focus change with Shift already down is
 * still picked up.
 */
export function useShiftKey(): boolean {
	const [down, setDown] = useState(false);
	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => setDown(event.shiftKey);
		const onKeyUp = (event: KeyboardEvent) => {
			if (event.key === "Shift") setDown(false);
		};
		const onBlur = () => setDown(false);
		window.addEventListener("keydown", onKeyDown);
		window.addEventListener("keyup", onKeyUp);
		window.addEventListener("blur", onBlur);
		return () => {
			window.removeEventListener("keydown", onKeyDown);
			window.removeEventListener("keyup", onKeyUp);
			window.removeEventListener("blur", onBlur);
		};
	}, []);
	return down;
}
