import { execFileSync } from "node:child_process";
import type { WavePr } from "./wave-state.ts";

/**
 * Best-effort PR/CI lookup. The wrapper never assumes a PR exists: a missing
 * `gh`, an unauthenticated environment or no PR yet return `undefined` and the
 * report says so (partial, not a silent success).
 */
export function resolvePr(branch: string, cwd: string): WavePr | undefined {
	const pr = gh(cwd, [
		"pr",
		"list",
		"--head",
		branch,
		"--state",
		"all",
		"--limit",
		"1",
		"--json",
		"number,url,state",
	]);
	if (!pr) return undefined;
	const list = JSON.parse(pr) as Array<{
		number: number;
		url: string;
		state: string;
	}>;
	const first = list[0];
	if (!first) return undefined;
	const checks = gh(cwd, [
		"pr",
		"checks",
		String(first.number),
		"--json",
		"name,state,bucket",
	]);
	return {
		number: first.number,
		url: first.url,
		state: first.state,
		checks: checks ? summarizeChecks(checks) : "unknown",
	};
}

function summarizeChecks(raw: string): string {
	try {
		const checks = JSON.parse(raw) as Array<{
			name?: string;
			state?: string;
			bucket?: string;
		}>;
		if (checks.length === 0) return "no checks";
		const failing = checks.filter(
			(check) =>
				check.bucket === "fail" ||
				check.state === "FAILURE" ||
				check.state === "ERROR",
		);
		const pending = checks.filter(
			(check) =>
				check.bucket === "pending" ||
				check.state === "PENDING" ||
				check.state === "QUEUED" ||
				check.state === "IN_PROGRESS",
		);
		if (failing.length > 0) {
			return `fail (${failing.map((check) => check.name ?? "check").join(", ")})`;
		}
		if (pending.length > 0) return `pending (${pending.length})`;
		return "pass";
	} catch {
		return "unknown";
	}
}

function gh(cwd: string, args: string[]): string | undefined {
	try {
		return execFileSync("gh", args, {
			cwd,
			encoding: "utf8",
			stdio: ["ignore", "pipe", "ignore"],
		}).trim();
	} catch {
		return undefined;
	}
}
