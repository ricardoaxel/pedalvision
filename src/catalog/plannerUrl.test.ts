import { describe, expect, it } from "vitest";
import { isPlannerUrl } from "./plannerUrl.ts";

describe("isPlannerUrl", () => {
	it("matches the planner host and subdomains", () => {
		expect(isPlannerUrl("https://pedalplayground.com/x.png")).toBe(true);
		expect(isPlannerUrl("https://WWW.PedalPlayground.com/x.png")).toBe(true);
		expect(
			isPlannerUrl(
				"https://pedalplayground.com/app/images/pedals/boss-ce2.png",
			),
		).toBe(true);
	});

	it("matches the official GitHub mirror", () => {
		expect(
			isPlannerUrl(
				"https://raw.githubusercontent.com/PedalPlayground/pedalplayground/master/app/images/pedals/boss-ce2.png",
			),
		).toBe(true);
		expect(
			isPlannerUrl(
				"https://github.com/PedalPlayground/pedalplayground/blob/master/x.png",
			),
		).toBe(true);
	});

	it("rejects near-miss mirrors and unrelated hosts", () => {
		expect(
			isPlannerUrl(
				"https://raw.githubusercontent.com/other/repo/master/pedalplayground/x.png",
			),
		).toBe(false);
		expect(isPlannerUrl("https://github.com/other/pedalplayground/x.png")).toBe(
			false,
		);
		expect(isPlannerUrl("https://static.roland.com/x.jpg")).toBe(false);
	});

	it("rejects missing/invalid values", () => {
		expect(isPlannerUrl(undefined)).toBe(false);
		expect(isPlannerUrl("not a url")).toBe(false);
	});
});
