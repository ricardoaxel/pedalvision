import type { Dirent } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import {
	RawBoardBatchSchema,
	RawPedalBatchSchema,
} from "../../src/catalog/rawSchema.ts";

/**
 * Image-provenance gate (P5, owner decision 2026-10-26).
 *
 * Planner/Pedalplayground pixels are never shipped. A raw record that still
 * references planner art must carry `imageProvenance.kind: "planner"` plus a
 * deliberate status: `pending-replacement` (a known, temporary gap) or
 * `owner-approved-edge-case`. Anything else is a hard error, so a future batch
 * cannot quietly fall back to planner art.
 */

export type ImageProvenanceIssue = {
	file: string;
	id?: string;
	message: string;
};

type ProvenanceRecord = {
	id?: string;
	imageCandidates?: Array<{ url?: string }>;
	sources?: Array<{ url?: string; kind?: string[] }>;
	imageProvenance?: {
		kind?: string;
		status?: string;
		sourceUrl?: string;
		note?: string;
	};
};

const PLANNER_HOST = "pedalplayground.com";

export function isPlannerUrl(url: string | undefined): boolean {
	if (!url) return false;
	try {
		const hostname = new URL(url).hostname.toLowerCase();
		return hostname === PLANNER_HOST || hostname.endsWith(`.${PLANNER_HOST}`);
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
		if (plannerUrls.length === 0) {
			if (provenance?.kind === "planner") {
				warnings.push({
					file,
					id: record.id,
					message:
						"imageProvenance.kind=planner but no planner URL is referenced; update the provenance",
				});
			}
			continue;
		}
		if (!provenance) {
			issues.push({
				file,
				id: record.id,
				message:
					"planner image URL without imageProvenance; declare kind=planner + a status (pending-replacement or owner-approved-edge-case)",
			});
			continue;
		}
		if (provenance.kind !== "planner") {
			issues.push({
				file,
				id: record.id,
				message: `planner image URL but imageProvenance.kind=${provenance.kind ?? "missing"}`,
			});
			continue;
		}
		if (provenance.status === "owner-approved-edge-case") continue;
		if (provenance.status === "pending-replacement") {
			warnings.push({
				file,
				id: record.id,
				message:
					"planner image is pending replacement (no usable official/authorized/user top-down yet)",
			});
			continue;
		}
		issues.push({
			file,
			id: record.id,
			message: `planner image is not an approved edge case (status=${provenance.status ?? "missing"}); replace it or mark it pending-replacement`,
		});
	}
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
	if (files === 0) {
		issues.push({
			file: join(root, "data/catalog/research"),
			message:
				"no raw batch files found; refusing to report a green image-provenance gate for an empty/missing directory",
		});
	}
	return { issues, warnings, files };
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
