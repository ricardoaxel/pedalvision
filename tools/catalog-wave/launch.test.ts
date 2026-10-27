import { describe, expect, it } from "vitest";
import { detachArgs } from "./launch.ts";

describe("detached wave args", () => {
	it("keeps the deprecated --allow-third and propagates resume to the child", () => {
		expect(detachArgs("index.ts", "plan.json", true, true)).toEqual([
			"--experimental-strip-types",
			"index.ts",
			"run",
			"--plan",
			"plan.json",
			"--foreground",
			"--allow-third",
			"--resume",
		]);
		expect(detachArgs("index.ts", "plan.json", false, false)).toEqual([
			"--experimental-strip-types",
			"index.ts",
			"run",
			"--plan",
			"plan.json",
			"--foreground",
		]);
	});
});
