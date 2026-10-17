import { describe, expect, it } from "vitest";
import {
	clearImageStatus,
	imageStatusSummary,
	reportImageStatus,
} from "./imageStatus";

describe("imageStatus registry", () => {
	it("summarizes loaded/failed and prunes cleared identities", () => {
		reportImageStatus("a", "loading");
		reportImageStatus("b", "loaded");
		expect(imageStatusSummary()).toBe("loaded:1 failed:0");

		reportImageStatus("a", "failed");
		expect(imageStatusSummary()).toBe("loaded:1 failed:1");

		clearImageStatus("a");
		expect(imageStatusSummary()).toBe("loaded:1 failed:0");

		clearImageStatus("b");
		expect(imageStatusSummary()).toBe("loaded:0 failed:0");
	});

	it("keys by identity (two nodes sharing a src count twice)", () => {
		reportImageStatus("uid-1", "loaded");
		reportImageStatus("uid-2", "loaded");
		expect(imageStatusSummary()).toBe("loaded:2 failed:0");
		clearImageStatus("uid-1");
		clearImageStatus("uid-2");
	});
});
