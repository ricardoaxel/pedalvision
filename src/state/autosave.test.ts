import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AUTOSAVE_DELAY_MS, createAutosave } from "./autosave";

describe("debounced autosave", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("writes once after the quiet window", async () => {
		const save = vi.fn();
		const autosave = createAutosave(save);
		autosave.schedule();
		autosave.schedule();
		autosave.schedule();
		expect(save).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS - 1);
		expect(save).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1);
		expect(save).toHaveBeenCalledTimes(1);
		expect(autosave.pending()).toBe(false);
	});

	it("flush writes immediately and cancels the pending timer", async () => {
		const save = vi.fn();
		const autosave = createAutosave(save);
		autosave.schedule();
		await autosave.flush();
		expect(save).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS * 2);
		expect(save).toHaveBeenCalledTimes(1);
	});

	it("flush is a no-op when nothing is dirty", async () => {
		const save = vi.fn();
		const autosave = createAutosave(save);
		await autosave.flush();
		expect(save).not.toHaveBeenCalled();
	});

	it("cancel drops pending work without writing", async () => {
		const save = vi.fn();
		const autosave = createAutosave(save);
		autosave.schedule();
		autosave.cancel();
		expect(autosave.pending()).toBe(false);
		await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS * 2);
		expect(save).not.toHaveBeenCalled();
	});

	it("swallows a failing write and keeps accepting changes", async () => {
		const save = vi.fn(() => {
			throw new Error("quota");
		});
		const autosave = createAutosave(save);
		autosave.schedule();
		await expect(autosave.flush()).resolves.toBeUndefined();
		expect(save).toHaveBeenCalledTimes(1);
		autosave.schedule();
		await autosave.flush();
		expect(save).toHaveBeenCalledTimes(2);
	});

	it("writes again when a change lands during an in-flight save", async () => {
		let release: (() => void) | null = null;
		const save = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					release = resolve;
				}),
		);
		const autosave = createAutosave(save);
		autosave.schedule();
		await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
		expect(save).toHaveBeenCalledTimes(1);
		autosave.schedule();
		await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
		(release as unknown as () => void)();
		await vi.advanceTimersByTimeAsync(0);
		expect(save).toHaveBeenCalledTimes(2);
	});
});
