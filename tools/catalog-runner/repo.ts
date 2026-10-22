import { execFileSync } from "node:child_process";
import { basename, dirname, join, resolve } from "node:path";

/**
 * Resolve the shared repository root even when a batch runs in a linked git
 * worktree. `git rev-parse --git-common-dir` points at the main checkout's
 * `.git`, so every worktree shares one control plane and one cap counter.
 */
const cache = new Map<string, string>();

export function repoRoot(root: string): string {
	const override = process.env.CATALOG_REPO_ROOT;
	if (override) return resolve(root, override);
	const cached = cache.get(resolve(root));
	if (cached) return cached;
	try {
		const common = execFileSync("git", ["rev-parse", "--git-common-dir"], {
			cwd: root,
			encoding: "utf8",
			stdio: ["ignore", "pipe", "ignore"],
		}).trim();
		const absolute = resolve(root, common);
		const resolved =
			basename(absolute) === ".git" ? dirname(absolute) : absolute;
		cache.set(resolve(root), resolved);
		return resolved;
	} catch {
		const resolved = resolve(root);
		cache.set(resolved, resolved);
		return resolved;
	}
}

export function sharedAssetsDir(root: string): string {
	return join(repoRoot(root), "public/pedal-assets");
}
