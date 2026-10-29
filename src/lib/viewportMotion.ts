import { easeOutCubic, lerp, MOTION, motionMs } from "./motion";

/**
 * Viewport camera tween for scene loads (F-05). The canvas host registers a
 * driver that writes the Konva stage transform imperatively, so the 240 ms
 * camera move never re-renders the React tree per frame. A user pan/zoom (or a
 * new focus) cancels the tween; the cancel path commits the live transform to
 * the viewport store first, so the next gesture starts from what is on screen.
 */

export interface ViewportLike {
	scale: number;
	x: number;
	y: number;
}

export interface ViewportTweenDriver {
	/** Write the live stage transform (no React state update). */
	write: (viewport: ViewportLike) => void;
	/** Read the live stage transform. */
	read: () => ViewportLike;
	/** Commit the settled transform to the viewport store. */
	commit: (viewport: ViewportLike) => void;
	/** Called once when a tween starts (debug/telemetry, optional). */
	start?: () => void;
}

let driver: ViewportTweenDriver | null = null;
let frame = 0;
let activeTween: {
	host: ViewportTweenDriver;
	target: ViewportLike;
	onDone?: () => void;
} | null = null;

export function registerViewportTweenDriver(
	next: ViewportTweenDriver | null,
): () => void {
	if (driver && driver !== next) cancelViewportTween();
	driver = next;
	return () => {
		if (driver === next) {
			cancelViewportTween();
			driver = null;
		}
	};
}

/** The live transform when tweening, else the store fallback. */
export function currentViewport(fallback: ViewportLike): ViewportLike {
	return driver ? driver.read() : fallback;
}

export interface AnimateViewportOptions {
	durationMs?: number;
	onDone?: () => void;
}

/**
 * Ease the camera to `target`. Returns true when a tween was scheduled; false
 * when it resolved instantly (reduced motion, no host, or zero duration).
 */
export function animateViewport(
	target: ViewportLike,
	options: AnimateViewportOptions = {},
): boolean {
	const duration = motionMs(options.durationMs ?? MOTION.slow);
	if (!driver || duration <= 0) {
		driver?.commit(target);
		options.onDone?.();
		return false;
	}

	// Interrupt any in-flight tween without committing: the new tween starts
	// from the transform currently on screen.
	cancelViewportTween(false);
	const host = driver;
	const from = host.read();
	const started = performance.now();
	activeTween = { host, target, onDone: options.onDone };
	host.start?.();

	const tick = (now: number) => {
		const t = Math.min(1, (now - started) / duration);
		const eased = easeOutCubic(t);
		host.write({
			scale: lerp(from.scale, target.scale, eased),
			x: lerp(from.x, target.x, eased),
			y: lerp(from.y, target.y, eased),
		});
		if (t < 1) {
			frame = requestAnimationFrame(tick);
			return;
		}
		frame = 0;
		const finished = activeTween;
		activeTween = null;
		host.commit(target);
		finished?.onDone?.();
	};

	frame = requestAnimationFrame(tick);
	return true;
}

/**
 * Finish an in-flight tween at its **target** (the user took over the camera:
 * pointer, wheel or an explicit focus). This marks the F-04 frame so the scene
 * is not left half-framed. No-op when idle.
 */
export function finishViewportTween(): void {
	const tween = activeTween;
	if (!tween) return;
	if (frame) {
		cancelAnimationFrame(frame);
		frame = 0;
	}
	activeTween = null;
	tween.host.commit(tween.target);
	tween.onDone?.();
}

/** Stop the tween and (by default) commit the live transform to the store. */
export function cancelViewportTween(commit = true): void {
	const wasTweening = frame !== 0;
	if (frame) {
		cancelAnimationFrame(frame);
		frame = 0;
	}
	activeTween = null;
	// No-op when idle: never re-commit the same transform on every pointerdown.
	if (wasTweening && commit && driver) driver.commit(driver.read());
}
