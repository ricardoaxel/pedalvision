import type { Dirent } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import {
	RawBoardBatchSchema,
	RawPedalBatchSchema,
} from "../../src/catalog/rawSchema.ts";

/**
 * Image-provenance gate (P5; owner decision 2026-10-27).
 *
 * Every shipped image records its source in the private raw catalog. Planner is
 * allowed only as an explicit `last-resort` source above generated art, with a
 * recorded sourceUrl; the ledger counts it as a source gap. Legacy remains
 * `pending-replacement` until repaired. Official/retailer/community/archive
 * images require a recorded sourceUrl; own art requires a note. Anything else
 * is a hard error, so a future batch cannot quietly ship an unrecorded image.
 */

export type ImageProvenanceIssue = {
	file: string;
	id?: string;
	message: string;
	/** Aggregate gap categories (counted once per run, not per item). */
	category?: "legacy-pending" | "planner-last-resort" | "planner-pending";
	count?: number;
};

type ProvenanceRecord = {
	id?: string;
	imageCandidates?: Array<{ url?: string }>;
	sources?: Array<{ url?: string; kind?: string[] }>;
	imageProvenance?: {
		kind?: string;
		status?: string;
		sourceUrl?: string;
		referenceUrl?: string;
		note?: string;
	};
};

const PLANNER_HOST = "pedalplayground.com";

export function isPlannerUrl(url: string | undefined): boolean {
	if (!url) return false;
	try {
		const parsed = new URL(url);
		const hostname = parsed.hostname.toLowerCase();
		if (hostname === PLANNER_HOST || hostname.endsWith(`.${PLANNER_HOST}`)) {
			return true;
		}
		// The planner's assets are also mirrored on GitHub raw.
		if (
			(hostname === "github.com" || hostname === "raw.githubusercontent.com") &&
			/\/pedalplayground\//i.test(parsed.pathname)
		) {
			return true;
		}
		return false;
	} catch {
		return false;
	}
}

export function checkImageProvenance(
	records: ProvenanceRecord[],
	file = "<memory>",
): { issues: ImageProvenanceIssue[]; warnings: ImageProvenanceIssue[] } {
	const issues: ImageProvenanceIssue[] = [];
	const warnings: ImageProvenanceIssue[] = [];
	let legacyPending = 0;
	let plannerLastResort = 0;
	let plannerPending = 0;
	for (const record of records) {
		const urls = [
			...(record.imageCandidates ?? []).map((candidate) => candidate.url),
			...(record.sources ?? [])
				.filter((source) => (source.kind ?? []).includes("image"))
				.map((source) => source.url),
			...(record.imageProvenance?.sourceUrl
				? [record.imageProvenance.sourceUrl]
				: []),
		];
		const plannerUrls = [...new Set(urls.filter(isPlannerUrl))];
		const provenance = record.imageProvenance;
		const kind = provenance?.kind;
		const status = provenance?.status;

		if (!provenance) {
			issues.push({
				file,
				id: record.id,
				message:
					"missing imageProvenance; record the image source (kind + sourceUrl, or an own-art note) in the private raw catalog",
			});
			continue;
		}

		if (kind === "own") {
			// Generated/mock art is ours; the reference is metadata and is never
			// treated as the shipped image source.
			if (!provenance.note) {
				issues.push({
					file,
					id: record.id,
					message:
						"own/generated image must record a note (generator + reference)",
				});
			}
			if (plannerUrls.length > 0) {
				issues.push({
					file,
					id: record.id,
					message: "planner image URL but imageProvenance.kind=own",
				});
			}
			continue;
		}

		if (kind === "legacy") {
			if (status === "pending-replacement") {
				legacyPending++;
			} else if (status !== "owner-approved-edge-case") {
				issues.push({
					file,
					id: record.id,
					message: "legacy asset must be pending-replacement or replaced",
				});
			}
			continue;
		}

		if (kind === "planner") {
			if (status === "pending-replacement") {
				plannerPending++;
				continue;
			}
			if (status === "owner-approved-edge-case") continue;
			if (status !== "last-resort") {
				issues.push({
					file,
					id: record.id,
					message: `planner image must be status=last-resort (got ${status ?? "missing"}); improve the source or mark it pending-replacement`,
				});
				continue;
			}
			if (!provenance.sourceUrl) {
				issues.push({
					file,
					id: record.id,
					message:
						"planner last-resort image must record imageProvenance.sourceUrl",
				});
				continue;
			}
			if (!isPlannerUrl(provenance.sourceUrl)) {
				issues.push({
					file,
					id: record.id,
					message: "planner last-resort sourceUrl is not a planner image URL",
				});
				continue;
			}
			plannerLastResort++;
			continue;
		}

		if (
			kind === "official" ||
			kind === "retailer" ||
			kind === "community" ||
			kind === "archive"
		) {
			if (!provenance.sourceUrl) {
				issues.push({
					file,
					id: record.id,
					message: `${kind} image must record imageProvenance.sourceUrl in the private raw catalog`,
				});
			}
			if (plannerUrls.length > 0) {
				issues.push({
					file,
					id: record.id,
					message: `planner image URL but imageProvenance.kind=${kind}`,
				});
			}
			continue;
		}

		issues.push({
			file,
			id: record.id,
			message: `unknown imageProvenance.kind ${kind ?? "missing"}`,
		});
	}
	const addGap = (
		category: NonNullable<ImageProvenanceIssue["category"]>,
		count: number,
	) => {
		if (count === 0) return;
		warnings.push({
			file,
			category,
			count,
			message: `${count} ${category === "legacy-pending" ? "legacy image(s) pending replacement" : category === "planner-last-resort" ? "planner image(s) in use as a recorded last resort; improve when a better source exists" : "planner image(s) pending a better source"}`,
		});
	};
	addGap("legacy-pending", legacyPending);
	addGap("planner-last-resort", plannerLastResort);
	addGap("planner-pending", plannerPending);
	return { issues, warnings };
}

async function walkJson(dir: string): Promise<string[]> {
	let entries: Dirent[];
	try {
		entries = await readdir(dir, { withFileTypes: true });
	} catch {
		return [];
	}
	const files: string[] = [];
	for (const entry of entries) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) files.push(...(await walkJson(path)));
		else if (entry.isFile() && entry.name.endsWith(".json")) files.push(path);
	}
	return files;
}

export async function checkImageProvenanceFiles(root = process.cwd()): Promise<{
	issues: ImageProvenanceIssue[];
	warnings: ImageProvenanceIssue[];
	files: number;
}> {
	const issues: ImageProvenanceIssue[] = [];
	const warnings: ImageProvenanceIssue[] = [];
	let files = 0;
	for (const kind of ["pedals", "boards"] as const) {
		const base = join(root, "data/catalog/research", kind);
		for (const file of await walkJson(base)) {
			files++;
			let parsed: unknown;
			try {
				parsed = JSON.parse(await readFile(file, "utf8"));
			} catch (error) {
				issues.push({
					file,
					message: `invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
				});
				continue;
			}
			const schema =
				kind === "pedals" ? RawPedalBatchSchema : RawBoardBatchSchema;
			const result = schema.safeParse(parsed);
			if (!result.success) {
				issues.push({
					file,
					message: `invalid raw batch: ${result.error.issues[0]?.message ?? "schema error"}`,
				});
				continue;
			}
			const checked = checkImageProvenance(result.data, file);
			issues.push(...checked.issues);
			warnings.push(...checked.warnings);
		}
	}
	// Aggregate accepted last-resort/legacy gaps into one line per category.
	const counts = new Map<string, number>();
	const perItem: ImageProvenanceIssue[] = [];
	for (const warning of warnings) {
		if (warning.category && warning.count) {
			counts.set(
				warning.category,
				(counts.get(warning.category) ?? 0) + warning.count,
			);
		} else {
			perItem.push(warning);
		}
	}
	const merged: ImageProvenanceIssue[] = [...perItem];
	for (const [category, count] of counts) {
		merged.push({
			file: "<all>",
			category: category as ImageProvenanceIssue["category"],
			count,
			message: `${count} ${category === "legacy-pending" ? "legacy image(s) pending replacement" : category === "planner-last-resort" ? "planner image(s) in use as a recorded last resort; improve when a better source exists" : "planner image(s) pending a better source"}`,
		});
	}
	if (files === 0) {
		issues.push({
			file: join(root, "data/catalog/research"),
			message:
				"no raw batch files found; refusing to report a green image-provenance gate for an empty/missing directory",
		});
	}
	return { issues, warnings: merged, files };
}

export function formatImageProvenanceIssues(
	issues: ImageProvenanceIssue[],
): string {
	if (issues.length === 0) return "";
	return [
		"image-provenance check failed; replace planner art or record a deliberate imageProvenance:",
		...issues.map(
			(issue) =>
				`  - ${issue.file}${issue.id ? ` [${issue.id}]` : ""}: ${issue.message}`,
		),
	].join("\n");
}

export function formatImageProvenanceWarnings(
	warnings: ImageProvenanceIssue[],
): string {
	if (warnings.length === 0) return "";
	return [
		`image-provenance warnings (${warnings.length}):`,
		...warnings.map(
			(issue) =>
				`  - ${issue.file}${issue.id ? ` [${issue.id}]` : ""}: ${issue.message}`,
		),
	].join("\n");
}
