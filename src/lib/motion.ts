import { useEffect, useState } from "react";

/**
 * F-05 motion system — the JS half of the "Straightedge Settle" language
 * (owner-approved 2026-10-28). The CSS custom properties in `styles/tokens.css`
 * are the source of truth for DOM surfaces; Konva cannot read CSS variables, so
 * canvas tweens use this tiny mirrored set. `motion.test.ts` keeps them in sync.
 */
export const MOTION = {
	fast: 120,
	base: 180,
	slow: 240,
	exit: 180,
	distance: 18,
	scaleIn: 0.985,
	scaleOut: 0.992,
} as const;

/** The single reduced-motion switch (matches the CSS media query). */
export const MOTION_REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

/** Read the OS preference at call time (SSR/test safe). */
export function prefersReducedMotion(): boolean {
	if (
		typeof window === "undefined" ||
		typeof window.matchMedia !== "function"
	) {
		return false;
	}
	return window.matchMedia(MOTION_REDUCED_QUERY).matches;
}

/** Resolve a duration; reduced motion means an instant state change. */
export function motionMs(ms: number, reduced = prefersReducedMotion()): number {
	return reduced ? 0 : Math.max(0, ms);
}

/** Reactive preference for React surfaces (presence, effects). */
export function usePrefersReducedMotion(): boolean {
	const [reduced, setReduced] = useState(prefersReducedMotion);
	useEffect(() => {
		if (
			typeof window === "undefined" ||
			typeof window.matchMedia !== "function"
		) {
			return;
		}
		const query = window.matchMedia(MOTION_REDUCED_QUERY);
		const update = () => setReduced(query.matches);
		update();
		query.addEventListener("change", update);
		return () => query.removeEventListener("change", update);
	}, []);
	return reduced;
}

/** Standard ease-out curve (mirrors `--ease-standard` in spirit). */
export function easeOutCubic(t: number): number {
	const clamped = Math.min(1, Math.max(0, t));
	return 1 - (1 - clamped) ** 3;
}

/** Gentle ease-in for an item arriving after the picker has left the screen. */
export function easeInCubic(t: number): number {
	const clamped = Math.min(1, Math.max(0, t));
	return clamped ** 3;
}

/** Linear interpolation helper for viewport tweens. */
export function lerp(from: number, to: number, t: number): number {
	return from + (to - from) * t;
}
