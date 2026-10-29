import { type ReactNode, useEffect, useRef, useState } from "react";
import { MOTION, usePrefersReducedMotion } from "../lib/motion";

interface MotionPresenceProps {
	open: boolean;
	/** Exit duration; defaults to the close token. */
	exitMs?: number;
	/** Called after the exiting node unmounts (never on a re-open). */
	onExited?: () => void;
	children: ReactNode;
}

/**
 * Keeps a panel mounted for its short exit motion (F-05). The *semantic* close
 * still happens on the same tick — state flips, `aria-expanded`, focus return
 * and the re-open path all use the live value; only the node lingers, inert,
 * for `exitMs`. Under reduced motion the node unmounts synchronously.
 *
 * The wrapper is `display: contents`, so it adds no layout box; panels stay
 * absolutely/fixed positioned exactly as before. Children are cached so the
 * exiting render still has a panel to animate (App passes `null` on close).
 */
export function MotionPresence({
	open,
	exitMs = MOTION.exit,
	onExited,
	children,
}: MotionPresenceProps) {
	const reduced = usePrefersReducedMotion();
	const [rendered, setRendered] = useState(open);
	const [exiting, setExiting] = useState(false);
	const [cycle, setCycle] = useState(0);
	const timer = useRef<number | null>(null);
	const lastChild = useRef<ReactNode>(children);
	const onExitedRef = useRef(onExited);
	onExitedRef.current = onExited;

	if (children !== null && children !== undefined) {
		lastChild.current = children;
	}

	useEffect(() => {
		if (open) {
			if (timer.current !== null) {
				window.clearTimeout(timer.current);
				timer.current = null;
			}
			// A reopen during the exit window remounts (cycle) so the panel's own
			// mount effects — focus placement, draft reset — run again. The first
			// open (and a reopen after a full unmount) is already a fresh mount.
			if (exiting) setCycle((value) => value + 1);
			setRendered(true);
			setExiting(false);
			return;
		}

		if (!rendered || exiting) return;

		const duration = reduced ? 0 : Math.max(0, exitMs);
		if (duration <= 0) {
			setRendered(false);
			setExiting(false);
			onExitedRef.current?.();
			return;
		}
		setExiting(true);
		timer.current = window.setTimeout(() => {
			timer.current = null;
			setRendered(false);
			setExiting(false);
			onExitedRef.current?.();
		}, duration);
	}, [open, exitMs, reduced, rendered, exiting]);

	useEffect(
		() => () => {
			if (timer.current !== null) window.clearTimeout(timer.current);
		},
		[],
	);

	// Render the child on the same open render (focus/effects must not wait a
	// frame); keep it for the exit duration after the semantic close. `leaving`
	// is derived during render so the node is inert on the same commit as the
	// close — shortcut guards must not see the exiting panel as an open dialog.
	if (!open && !rendered) return null;
	const child = children ?? lastChild.current;
	if (child === null || child === undefined) return null;
	const leaving = !open && rendered;

	return (
		<div
			key={cycle}
			className="motion-presence"
			data-motion-state={leaving ? "exiting" : "entering"}
			// React 19 exposes the boolean `inert` attribute; the exiting node is
			// visually present but unreachable and non-interactive.
			inert={leaving || undefined}
		>
			{child}
		</div>
	);
}
