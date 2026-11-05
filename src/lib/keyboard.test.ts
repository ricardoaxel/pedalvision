import { describe, expect, it } from "vitest";
import { isTypingTarget } from "./keyboard";

function target(
	tagName: string,
	extra: Record<string, unknown> = {},
): EventTarget {
	return {
		tagName,
		type: "text",
		isContentEditable: false,
		...extra,
	} as unknown as EventTarget;
}

describe("keyboard shortcut text-field guard", () => {
	it("treats text controls as typing targets", () => {
		expect(isTypingTarget(target("INPUT"))).toBe(true);
		expect(isTypingTarget(target("INPUT", { type: "search" }))).toBe(true);
		expect(isTypingTarget(target("TEXTAREA"))).toBe(true);
		expect(isTypingTarget(target("SELECT"))).toBe(false);
		expect(isTypingTarget(target("SELECT"), true)).toBe(true);
		expect(isTypingTarget(target("DIV", { isContentEditable: true }))).toBe(
			true,
		);
	});

	it("lets shortcuts fire on non-text controls (radio/checkbox/range)", () => {
		expect(isTypingTarget(target("INPUT", { type: "radio" }))).toBe(false);
		expect(isTypingTarget(target("INPUT", { type: "checkbox" }))).toBe(false);
		expect(isTypingTarget(target("INPUT", { type: "range" }))).toBe(false);
		expect(isTypingTarget(target("BUTTON"))).toBe(false);
		expect(isTypingTarget(null)).toBe(false);
	});
});
