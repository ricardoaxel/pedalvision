import { describe, expect, it } from "vitest";
import { nextEnabledIndex } from "./toolbarNav";

describe("nextEnabledIndex", () => {
	it("wraps forward/back over the enabled set, skipping disabled buttons", () => {
		// Buttons 0 and 1 disabled; enabled are 2,3,4,5,6.
		const enabled = [2, 3, 4, 5, 6];
		expect(nextEnabledIndex(enabled, 2, "ArrowRight")).toBe(3);
		expect(nextEnabledIndex(enabled, 6, "ArrowRight")).toBe(2);
		expect(nextEnabledIndex(enabled, 2, "ArrowLeft")).toBe(6);
		expect(nextEnabledIndex(enabled, 3, "ArrowUp")).toBe(2);
		expect(nextEnabledIndex(enabled, 5, "ArrowDown")).toBe(6);
	});

	it("jumps to the first/last enabled on Home/End", () => {
		expect(nextEnabledIndex([1, 2, 5], 2, "Home")).toBe(1);
		expect(nextEnabledIndex([1, 2, 5], 2, "End")).toBe(5);
	});

	it("returns null for an unknown key, an inactive active, or no enabled", () => {
		expect(nextEnabledIndex([0, 1], 0, "Enter")).toBeNull();
		expect(nextEnabledIndex([0, 1], 9, "ArrowRight")).toBeNull();
		expect(nextEnabledIndex([], 0, "ArrowRight")).toBeNull();
	});
});
