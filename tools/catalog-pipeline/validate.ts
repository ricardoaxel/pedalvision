import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import {
	type CatalogBoard,
	CatalogBoardSchema,
	type CatalogPedal,
	CatalogPedalSchema,
} from "../../src/catalog/schema.ts";
import { type AssetCounts, capIssues, scanAssetCounts } from "./caps.ts";

/**
 * Runtime catalog validation (P5-02). Catches the failures a batch can
 * introduce: bad schema/mandatory fields, duplicate ids, dangling or cyclic
 * variants, missing static renditions, implausible board footprints, and cap
 * overruns.
 */

export type ValidationIssue = {
	scope: "catalog" | "pedal" | "board" | "asset" | "cap";
	id?: string;
	message: string;
};

export type ValidationResult = {
	pedals: CatalogPedal[];
	boards: CatalogBoard[];
	issues: ValidationIssue[];
	counts?: AssetCounts;
};

export type ValidateOptions = {
	catalogDir: string;
	assetsDir: string;
	checkAssets?: boolean;
	checkCaps?: boolean;
};

const BOARD_MIN_CM = 10;
const BOARD_MAX_CM = 250;

function issue(
	scope: ValidationIssue["scope"],
	message: string,
	id?: string,
): ValidationIssue {
	return { scope, message, ...(id ? { id } : {}) };
}

async function readArray(
	path: string,
	issues: ValidationIssue[],
	label: "pedal" | "board",
): Promise<unknown[]> {
	try {
		const parsed = JSON.parse(await readFile(path, "utf8")) as unknown;
		if (!Array.isArray(parsed)) {
			issues.push(issue(label, `${path}: expected a JSON array`));
			return [];
		}
		return parsed;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		issues.push(issue(label, `${path}: ${message}`));
		return [];
	}
}

function assertUnique(
	items: Array<{ id: string }>,
	label: "pedal" | "board",
	issues: ValidationIssue[],
): void {
	const seen = new Set<string>();
	for (const item of items) {
		if (seen.has(item.id)) {
			issues.push(issue(label, `duplicate id "${item.id}"`, item.id));
		}
		seen.add(item.id);
	}
}

function assertVariants<T extends { id: string; variantOf?: string }>(
	items: T[],
	label: "pedal" | "board",
	issues: ValidationIssue[],
): void {
	const byId = new Map(items.map((item) => [item.id, item]));
	for (const item of items) {
		if (!item.variantOf) continue;
		if (item.variantOf === item.id) {
			issues.push(issue(label, `"${item.id}" is its own variantOf`, item.id));
			continue;
		}
		if (!byId.has(item.variantOf)) {
			issues.push(
				issue(
					label,
					`"${item.id}" references missing variantOf "${item.variantOf}"`,
					item.id,
				),
			);
			continue;
		}
		const seen = new Set<string>([item.id]);
		let current: T | undefined = item;
		while (current?.variantOf) {
			if (seen.has(current.variantOf)) {
				issues.push(
					issue(label, `variantOf cycle involving "${item.id}"`, item.id),
				);
				break;
			}
			seen.add(current.variantOf);
			current = byId.get(current.variantOf);
		}
	}
}

function assertBoardFootprints(
	boards: CatalogBoard[],
	issues: ValidationIssue[],
): void {
	for (const board of boards) {
		for (const [axis, value] of [
			["widthCm", board.widthCm],
			["heightCm", board.heightCm],
		] as const) {
			if (value < BOARD_MIN_CM || value > BOARD_MAX_CM) {
				issues.push(
					issue(
						"board",
						`"${board.id}" ${axis} ${value} cm is outside ${BOARD_MIN_CM}–${BOARD_MAX_CM} cm`,
						board.id,
					),
				);
			}
		}
	}
}

async function assertStaticAssets(
	items: Array<CatalogPedal | CatalogBoard>,
	assetsDir: string,
	kind: "pedals" | "boards",
	issues: ValidationIssue[],
): Promise<void> {
	for (const item of items) {
		if (item.imageSource !== "static") continue;
		for (const size of ["800", "350"]) {
			try {
				const info = await stat(join(assetsDir, kind, size, item.image));
				if (!info.isFile()) throw new Error("not a file");
			} catch {
				issues.push(
					issue("asset", `missing ${kind}/${size}/${item.image}`, item.id),
				);
			}
		}
	}
}

export async function validateCatalog(
	options: ValidateOptions,
): Promise<ValidationResult> {
	const issues: ValidationIssue[] = [];
	const rawPedals = await readArray(
		join(options.catalogDir, "pedals.json"),
		issues,
		"pedal",
	);
	const rawBoards = await readArray(
		join(options.catalogDir, "boards.json"),
		issues,
		"board",
	);

	const pedalParsed = CatalogPedalSchema.array().safeParse(rawPedals);
	const boardParsed = CatalogBoardSchema.array().safeParse(rawBoards);
	let pedals: CatalogPedal[] = [];
	let boards: CatalogBoard[] = [];

	if (!pedalParsed.success) {
		const first = pedalParsed.error.issues[0];
		issues.push(
			issue(
				"pedal",
				`invalid pedal at ${first?.path.join(".") || "<root>"}: ${first?.message}`,
			),
		);
	} else {
		pedals = pedalParsed.data;
	}

	if (!boardParsed.success) {
		const first = boardParsed.error.issues[0];
		issues.push(
			issue(
				"board",
				`invalid board at ${first?.path.join(".") || "<root>"}: ${first?.message}`,
			),
		);
	} else {
		boards = boardParsed.data;
	}

	assertUnique(pedals, "pedal", issues);
	assertUnique(boards, "board", issues);

	const allIds = new Map<string, "pedal" | "board">();
	for (const pedal of pedals) {
		if (allIds.has(pedal.id)) {
			issues.push(
				issue("catalog", `id "${pedal.id}" is used by more than one item`),
			);
		}
		allIds.set(pedal.id, "pedal");
	}
	for (const board of boards) {
		if (allIds.has(board.id)) {
			issues.push(
				issue("catalog", `id "${board.id}" is used by more than one item`),
			);
		}
		allIds.set(board.id, "board");
	}

	assertVariants(pedals, "pedal", issues);
	assertVariants(boards, "board", issues);
	assertBoardFootprints(boards, issues);

	if (options.checkAssets !== false) {
		await assertStaticAssets(pedals, options.assetsDir, "pedals", issues);
		await assertStaticAssets(boards, options.assetsDir, "boards", issues);
	}

	let counts: AssetCounts | undefined;
	if (options.checkCaps !== false) {
		counts = await scanAssetCounts(options.assetsDir);
		for (const cap of capIssues(counts)) {
			issues.push(issue("cap", cap.message));
		}
	}

	return { pedals, boards, issues, counts };
}

export function formatIssues(issues: ValidationIssue[]): string {
	return issues
		.map(
			(entry) =>
				`  ${entry.scope}${entry.id ? ` ${entry.id}` : ""}: ${entry.message}`,
		)
		.join("\n");
}
