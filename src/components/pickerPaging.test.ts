import { describe, expect, it } from "vitest";
import { nextPageCount, PICKER_PAGE, visibleCountFor } from "./pickerPaging";

describe("picker paging", () => {
	it("resets to the first page when the filter key changes", () => {
		expect(visibleCountFor("new", { key: "old", count: 900 })).toBe(
			PICKER_PAGE,
		);
	});

	it("keeps the loaded count for the current filter key", () => {
		expect(visibleCountFor("same", { key: "same", count: 900 })).toBe(900);
	});

	it("adds one page per request", () => {
		expect(nextPageCount(PICKER_PAGE)).toBe(PICKER_PAGE * 2);
	});
});
