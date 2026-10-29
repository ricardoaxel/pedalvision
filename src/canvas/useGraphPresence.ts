import { useEffect, useRef, useState } from "react";
import { MOTION, motionMs, usePrefersReducedMotion } from "../lib/motion";
import { useReadOnly } from "../state/readOnly";
import { useSettings } from "../state/settings";

/**
 * F-05 "Press Fit" graph presence. `showCables` (or a read-only recipient)
 * mounts the cable/endpoint layers; hiding keeps them mounted for the 120 ms
 * fade-out. Both layers use the same booleans so they leave together.
 */
export function useGraphPresence(): {
	mounted: boolean;
	exiting: boolean;
	reduced: boolean;
	visible: boolean;
} {
	const showCables = useSettings((state) => state.showCables);
	const readOnly = useReadOnly((state) => state.readOnly);
	const reduced = usePrefersReducedMotion();
	const visible = showCables || readOnly;
	const [mounted, setMounted] = useState(visible);
	const [exiting, setExiting] = useState(false);
	const timer = useRef<number | null>(null);

	useEffect(() => {
		if (visible) {
			if (timer.current !== null) {
				window.clearTimeout(timer.current);
				timer.current = null;
			}
			setMounted(true);
			setExiting(false);
			return;
		}
		if (!mounted) return;
		const duration = motionMs(MOTION.fast, reduced);
		if (duration <= 0) {
			setMounted(false);
			setExiting(false);
			return;
		}
		setExiting(true);
		timer.current = window.setTimeout(() => {
			timer.current = null;
			setMounted(false);
			setExiting(false);
		}, duration);
	}, [visible, mounted, reduced]);

	useEffect(
		() => () => {
			if (timer.current !== null) window.clearTimeout(timer.current);
		},
		[],
	);

	return { mounted, exiting, reduced, visible };
}
