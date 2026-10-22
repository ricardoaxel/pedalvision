import { join } from "node:path";
import {
	type AssetCounts,
	scanAssetCountsAcross,
} from "../catalog-pipeline/caps.ts";
import { repoRoot } from "./repo.ts";
import { type BatchState, isActive, listStates } from "./state.ts";

/**
 * Caps are global across the main checkout + every active/complete batch
 * worktree. Counting only one worktree would let three parallel batches cross
 * the 2,000-pedal limit collectively.
 */
export async function runnerAssetCounts(
	root: string,
	extraRoots: string[] = [],
): Promise<AssetCounts> {
	const states = await listStates(root);
	const roots = new Set<string>([repoRoot(root), ...extraRoots]);
	for (const state of states) {
		if (isActive(state) || state.status === "complete") {
			roots.add(state.worktree);
		}
	}
	return scanAssetCountsAcross(
		[...roots].map((entry) => join(entry, "public/pedal-assets")),
	);
}

/** Remaining declared items for the active batches of one kind. */
export function remainingPlanned(
	states: BatchState[],
	kind: "pedals" | "boards",
): number {
	return states
		.filter((state) => state.kind === kind && isActive(state))
		.reduce((sum, state) => sum + Math.max(0, state.total - state.done), 0);
}

/** Conservative projected counts: on-disk assets + remaining declared items. */
export function withPlanned(
	counts: AssetCounts,
	planned: number,
	kind: "pedals" | "boards",
): AssetCounts {
	return {
		...counts,
		[kind]: {
			items: counts[kind].items + planned,
			files: counts[kind].files + planned * 2,
			bytes: counts[kind].bytes,
		},
	};
}
