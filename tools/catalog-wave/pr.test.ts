import { describe, expect, it } from "vitest";
import { summarizeChecks } from "./pr.ts";

describe("summarizeChecks", () => {
	it("reports failing and pending checks even when gh exits non-zero", () => {
		expect(
			summarizeChecks(
				JSON.stringify([
					{ name: "ci", state: "FAILURE", bucket: "fail" },
					{ name: "deploy", state: "SUCCESS", bucket: "pass" },
				]),
			),
		).toBe("fail (ci)");
		expect(
			summarizeChecks(
				JSON.stringify([{ name: "ci", state: "PENDING", bucket: "pending" }]),
			),
		).toBe("pending (1)");
	});

	it("reports pass, empty and malformed payloads", () => {
		expect(
			summarizeChecks(
				JSON.stringify([{ name: "ci", state: "SUCCESS", bucket: "pass" }]),
			),
		).toBe("pass");
		expect(summarizeChecks("[]")).toBe("no checks");
		expect(summarizeChecks("not json")).toBe("unknown");
	});
});
