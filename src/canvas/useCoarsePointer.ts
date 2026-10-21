import { useEffect, useState } from "react";

/**
 * True for a coarse primary pointer (touch). Used to give jack sockets a 44px
 * target on phones while keeping a 28px target on desktop — a 44px disc on a
 * ~29px-wide pedal would otherwise swallow the pedal body and make dragging it
 * impossible (P4-02 review).
 */
export function useCoarsePointer(): boolean {
	const [coarse, setCoarse] = useState(false);
	useEffect(() => {
		const query = window.matchMedia("(pointer: coarse)");
		const update = () => setCoarse(query.matches);
		update();
		query.addEventListener("change", update);
		return () => query.removeEventListener("change", update);
	}, []);
	return coarse;
}
