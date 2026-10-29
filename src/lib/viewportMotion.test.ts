import { afterEach, describe, expect, it, vi } from "vitest";
import {
	animateViewport,
	cancelViewportTween,
	currentViewport,
	finishViewportTween,
	registerViewportTweenDriver,
} from "./viewportMotion";

describe("viewport motion", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("commits the target immediately when the duration is zero", () => {
		let committed: { scale: number; x: number; y: number } | null = null;
		let done = 0;
		const unregister = registerViewportTweenDriver({
			write: vi.fn(),
			read: () => ({ scale: 1, x: 0, y: 0 }),
			commit: (viewport) => {
				committed = viewport;
			},
		});

		const scheduled = animateViewport(
			{ scale: 2, x: 30, y: 40 },
			{ durationMs: 0, onDone: () => (done += 1) },
		);

		expect(scheduled).toBe(false);
		expect(committed).toEqual({ scale: 2, x: 30, y: 40 });
		expect(done).toBe(1);
		unregister();
	});

	it("reads the live transform through the registered driver", () => {
		let live = { scale: 1.5, x: 12, y: -8 };
		const unregister = registerViewportTweenDriver({
			write: (viewport) => {
				live = viewport;
			},
			read: () => live,
			commit: vi.fn(),
		});

		expect(currentViewport({ scale: 1, x: 0, y: 0 })).toEqual(live);
		live = { scale: 2, x: 0, y: 0 };
		expect(currentViewport({ scale: 1, x: 0, y: 0 })).toEqual(live);
		unregister();
	});

	it("cancel is a no-op when no tween is running", () => {
		const commit = vi.fn();
		const unregister = registerViewportTweenDriver({
			write: vi.fn(),
			read: () => ({ scale: 1, x: 0, y: 0 }),
			commit,
		});

		cancelViewportTween();
		expect(commit).not.toHaveBeenCalled();
		unregister();
	});

	it("cancel commits the live mid-tween transform and skips onDone", () => {
		let live = { scale: 1, x: 0, y: 0 };
		const raf = { callback: null as FrameRequestCallback | null };
		vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
			raf.callback = cb;
			return 1;
		});
		vi.stubGlobal("cancelAnimationFrame", vi.fn());
		const commit = vi.fn();
		const onDone = vi.fn();
		const unregister = registerViewportTweenDriver({
			write: (viewport) => {
				live = viewport;
			},
			read: () => live,
			commit,
		});

		animateViewport({ scale: 2, x: 100, y: 200 }, { durationMs: 100, onDone });
		expect(raf.callback).not.toBeNull();
		raf.callback?.(performance.now() + 50);
		expect(commit).not.toHaveBeenCalled();
		const mid = live;

		cancelViewportTween();
		expect(commit).toHaveBeenLastCalledWith(mid);
		expect(onDone).not.toHaveBeenCalled();
		unregister();
	});

	it("finish jumps to the target and runs onDone (the user took over)", () => {
		let live = { scale: 1, x: 0, y: 0 };
		const raf = { callback: null as FrameRequestCallback | null };
		vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
			raf.callback = cb;
			return 1;
		});
		vi.stubGlobal("cancelAnimationFrame", vi.fn());
		const commit = vi.fn();
		const onDone = vi.fn();
		const unregister = registerViewportTweenDriver({
			write: (viewport) => {
				live = viewport;
			},
			read: () => live,
			commit,
		});

		animateViewport({ scale: 2, x: 100, y: 200 }, { durationMs: 100, onDone });
		raf.callback?.(performance.now() + 50);
		finishViewportTween();

		expect(commit).toHaveBeenLastCalledWith({ scale: 2, x: 100, y: 200 });
		expect(onDone).toHaveBeenCalledTimes(1);
		unregister();
	});
});
