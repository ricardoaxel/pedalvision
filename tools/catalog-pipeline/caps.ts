import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { CATALOG_LIMITS } from "../catalog-transform/limits.ts";

/**
 * Hosted-image cap accounting (P5-02). Pedals and boards have independent
 * budgets: boards never count toward the 2,000 hosted-pedal cap.
 */

export type AssetBudget = {
	/** Distinct catalog ids with an 800 rendition (the hosted-item count). */
	items: number;
	/** All files in both rendition folders. */
	files: number;
	bytes: number;
};

export type AssetCounts = {
	pedals: AssetBudget;
	boards: AssetBudget;
};

export type CapIssue = {
	kind: "pedal" | "board";
	limit: number;
	actual: number;
	unit: "items" | "files" | "mb";
	message: string;
};

const MB = 1024 * 1024;

function emptyBudget(): AssetBudget {
	return { items: 0, files: 0, bytes: 0 };
}

type FileBudget = {
	/** Per-rendition max bytes, keyed `<size>:<ext>` (dedupes across worktrees). */
	renditions: Map<string, number>;
};

/**
 * Count hosted assets across one or more roots. The same catalog id in two
 * worktrees is counted once (max file size), so baseline assets are not
 * multiplied by the number of worktrees.
 */
export async function scanAssetCountsAcross(
	assetsDirs: string[],
): Promise<AssetCounts> {
	const files = new Map<string, FileBudget>();
	for (const assetsDir of [...new Set(assetsDirs)]) {
		for (const kind of ["pedals", "boards"] as const) {
			for (const size of ["800", "350"] as const) {
				const dir = join(assetsDir, kind, size);
				let entries: string[];
				try {
					entries = await readdir(dir);
				} catch (error) {
					if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
					throw error;
				}
				for (const entry of entries.sort()) {
					const match = entry.match(/\.(png|avif)$/);
					if (!match) continue;
					const info = await stat(join(dir, entry));
					if (!info.isFile()) continue;
					const key = `${kind}:${entry.slice(0, -match[0].length)}`;
					const budget = files.get(key) ?? { renditions: new Map() };
					const renditionKey = `${size}:${match[1]}`;
					budget.renditions.set(
						renditionKey,
						Math.max(budget.renditions.get(renditionKey) ?? 0, info.size),
					);
					files.set(key, budget);
				}
			}
		}
	}

	const counts: AssetCounts = {
		pedals: emptyBudget(),
		boards: emptyBudget(),
	};
	for (const [key, budget] of files) {
		const [kind] = key.split(":");
		const target = kind === "pedals" ? counts.pedals : counts.boards;
		const has800 = [...budget.renditions.keys()].some((rendition) =>
			rendition.startsWith("800:"),
		);
		if (has800) target.items++;
		target.files += budget.renditions.size;
		for (const bytes of budget.renditions.values()) target.bytes += bytes;
	}
	return counts;
}

export async function scanAssetCounts(assetsDir: string): Promise<AssetCounts> {
	return scanAssetCountsAcross([assetsDir]);
}

function issue(
	kind: "pedal" | "board",
	limit: number,
	actual: number,
	unit: "items" | "files" | "mb",
): CapIssue {
	const label = unit === "mb" ? `${(actual / MB).toFixed(1)} MB` : `${actual}`;
	const limitLabel = unit === "mb" ? `${limit} MB` : `${limit}`;
	return {
		kind,
		limit,
		actual,
		unit,
		message: `${kind} ${unit} cap: ${label} exceeds ${limitLabel}`,
	};
}

/** Current-budget violations (used after a batch). */
export function capIssues(counts: AssetCounts): CapIssue[] {
	const issues: CapIssue[] = [];
	const pedal = counts.pedals;
	if (pedal.items > CATALOG_LIMITS.hostedPedals) {
		issues.push(
			issue("pedal", CATALOG_LIMITS.hostedPedals, pedal.items, "items"),
		);
	}
	if (pedal.files > CATALOG_LIMITS.hostedPedalImageFiles) {
		issues.push(
			issue(
				"pedal",
				CATALOG_LIMITS.hostedPedalImageFiles,
				pedal.files,
				"files",
			),
		);
	}
	if (pedal.bytes > CATALOG_LIMITS.hostedPedalImageMb * MB) {
		issues.push(
			issue("pedal", CATALOG_LIMITS.hostedPedalImageMb, pedal.bytes, "mb"),
		);
	}

	const board = counts.boards;
	if (board.items > CATALOG_LIMITS.hostedBoards) {
		issues.push(
			issue("board", CATALOG_LIMITS.hostedBoards, board.items, "items"),
		);
	}
	if (board.files > CATALOG_LIMITS.boardImageFiles) {
		issues.push(
			issue("board", CATALOG_LIMITS.boardImageFiles, board.files, "files"),
		);
	}
	if (board.bytes > CATALOG_LIMITS.boardImageMb * MB) {
		issues.push(issue("board", CATALOG_LIMITS.boardImageMb, board.bytes, "mb"));
	}
	return issues;
}

export type StartCheck = {
	ok: boolean;
	reason?: string;
	issues: CapIssue[];
};

/**
 * Refuse a batch before it starts when its declared item count would cross a
 * cap. `plannedItems` is the batch's item count (a replacement of an existing
 * id still counts conservatively).
 */
export function canStartBatch(
	kind: "pedals" | "boards",
	plannedItems: number,
	counts: AssetCounts,
): StartCheck {
	const budget = kind === "pedals" ? counts.pedals : counts.boards;
	const itemLimit =
		kind === "pedals"
			? CATALOG_LIMITS.hostedPedals
			: CATALOG_LIMITS.hostedBoards;
	const fileLimit =
		kind === "pedals"
			? CATALOG_LIMITS.hostedPedalImageFiles
			: CATALOG_LIMITS.boardImageFiles;
	const mbLimit =
		kind === "pedals"
			? CATALOG_LIMITS.hostedPedalImageMb
			: CATALOG_LIMITS.boardImageMb;
	const issues: CapIssue[] = [];

	if (budget.items + plannedItems > itemLimit) {
		issues.push(
			issue(
				kind === "pedals" ? "pedal" : "board",
				itemLimit,
				budget.items + plannedItems,
				"items",
			),
		);
	}
	if (budget.files + plannedItems * 2 > fileLimit) {
		issues.push(
			issue(
				kind === "pedals" ? "pedal" : "board",
				fileLimit,
				budget.files + plannedItems * 2,
				"files",
			),
		);
	}
	if (budget.bytes > mbLimit * MB) {
		issues.push(
			issue(kind === "pedals" ? "pedal" : "board", mbLimit, budget.bytes, "mb"),
		);
	}

	if (issues.length === 0) return { ok: true, issues };
	return {
		ok: false,
		reason: issues.map((entry) => entry.message).join("; "),
		issues,
	};
}

export function formatCounts(counts: AssetCounts): string {
	return `pedals ${counts.pedals.items} items / ${counts.pedals.files} files / ${(counts.pedals.bytes / MB).toFixed(1)} MB · boards ${counts.boards.items} items / ${counts.boards.files} files / ${(counts.boards.bytes / MB).toFixed(1)} MB`;
}
