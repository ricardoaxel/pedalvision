import type { Dirent } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import {
	RawPedalBatchSchema,
	type RawPedalRecord,
} from "../../src/catalog/rawSchema.ts";

/**
 * Jack-edge provenance gate (P5 batch guardrail, 2026-10-25).
 *
 * An `edge` is only projected when a raw record declares a **verified**
 * `jackLayout` source. This prevents a batch from inferring a connector face
 * from “compact layout” or a sibling model (the Meris mistake). When the edge is
 * unknown, omit the edge: the app then uses its clearly-labelled fallback
 * anchors instead of a wrong edge.
 */

export type JackLayoutIssue = {
	file: string;
	id?: string;
	message: string;
};

export function checkJackLayouts(
	records: RawPedalRecord[],
	file = "<memory>",
): JackLayoutIssue[] {
	const issues: JackLayoutIssue[] = [];
	for (const record of records) {
		const edged = (record.jacks ?? []).filter(
			(jack) => jack.edge !== undefined,
		);
		if (edged.length === 0) continue;
		const layout = record.jackLayout;
		if (!layout?.source) {
			issues.push({
				file,
				id: record.id,
				message: `${edged.length} jack(s) declare an edge but the record has no jackLayout.source`,
			});
			continue;
		}
		if (layout.confidence !== "verified") {
			issues.push({
				file,
				id: record.id,
				message: `jack edges are not verified (jackLayout.confidence=${layout.confidence ?? "missing"}); omit the edges or provide a verified source`,
			});
		}
	}
	return issues;
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

export async function checkJackLayoutFiles(
	root = process.cwd(),
): Promise<{ issues: JackLayoutIssue[]; files: number }> {
	const base = join(root, "data/catalog/research/pedals");
	const files = await walkJson(base);
	const issues: JackLayoutIssue[] = [];
	for (const file of files) {
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
		const result = RawPedalBatchSchema.safeParse(parsed);
		if (!result.success) {
			issues.push({
				file,
				message: `invalid raw batch: ${result.error.issues[0]?.message ?? "schema error"}`,
			});
			continue;
		}
		issues.push(...checkJackLayouts(result.data, file));
	}
	return { issues, files: files.length };
}

export function formatJackLayoutIssues(issues: JackLayoutIssue[]): string {
	if (issues.length === 0) return "";
	return [
		"jack-edge provenance check failed; add a verified `jackLayout` or remove the edge:",
		...issues.map(
			(issue) =>
				`  - ${issue.file}${issue.id ? ` [${issue.id}]` : ""}: ${issue.message}`,
		),
	].join("\n");
}
