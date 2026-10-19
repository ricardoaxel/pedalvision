import { afterEach, describe, expect, it, vi } from "vitest";
import {
	dismissFirstRun,
	FIRST_RUN_STORAGE_KEY,
	isFirstRunDismissed,
	shouldShowFirstRunHint,
} from "./firstRun";

function fakeStorage(initial: Record<string, string> = {}): Storage {
	const map = new Map(Object.entries(initial));
	return {
		get length() {
			return map.size;
		},
		clear: () => map.clear(),
		getItem: (key) => map.get(key) ?? null,
		key: (index) => [...map.keys()][index] ?? null,
		removeItem: (key) => {
			map.delete(key);
		},
		setItem: (key, value) => {
			map.set(key, value);
		},
	};
}

describe("first-run visibility", () => {
	it("shows only for an empty, undismissed scene", () => {
		expect(
			shouldShowFirstRunHint({ boardCount: 0, itemCount: 0, dismissed: false }),
		).toBe(true);
		expect(
			shouldShowFirstRunHint({ boardCount: 1, itemCount: 0, dismissed: false }),
		).toBe(false);
		expect(
			shouldShowFirstRunHint({ boardCount: 0, itemCount: 2, dismissed: false }),
		).toBe(false);
		expect(
			shouldShowFirstRunHint({ boardCount: 0, itemCount: 0, dismissed: true }),
		).toBe(false);
	});
});

describe("first-run dismissal storage", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("persists a dismissal and reads it back", () => {
		const storage = fakeStorage();
		expect(isFirstRunDismissed(storage)).toBe(false);
		dismissFirstRun(storage);
		expect(storage.getItem(FIRST_RUN_STORAGE_KEY)).toBe("dismissed");
		expect(isFirstRunDismissed(storage)).toBe(true);
	});

	it("fails soft when storage is unavailable", () => {
		vi.stubGlobal("localStorage", undefined);
		expect(isFirstRunDismissed()).toBe(false);
		expect(() => dismissFirstRun()).not.toThrow();
	});

	it("fails soft when reads and writes throw", () => {
		const blocked = {
			...fakeStorage(),
			getItem: () => {
				throw new Error("blocked");
			},
			setItem: () => {
				throw new Error("blocked");
			},
		} as Storage;
		expect(isFirstRunDismissed(blocked)).toBe(false);
		expect(() => dismissFirstRun(blocked)).not.toThrow();
	});
});
