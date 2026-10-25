import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
	type CatalogBoard,
	CatalogBoardSchema,
	type CatalogPedal,
	CatalogPedalSchema,
} from "../../src/catalog/schema.ts";
import { encodeDemoHash } from "./encode.ts";
import {
	boardRowSnapshots,
	boardSnapshot,
	cablePlan,
	chooseBoard,
	type DemoItem,
	type DemoSnapshot,
	itemSnapshots,
} from "./layout.ts";

/**
 * Build a demo share scene for a catalog batch (P5 batch guardrail,
 * 2026-10-25). One board, every batch item, illustrative patch cables between
 * consecutive items. Prints the read-only `?share=1#s=…` URL for the PR
 * description. This is deliberately not a real audio-routing model.
 */

const USAGE = `catalog-demo-link — build a batch demo share link

Usage:
  catalog-demo-link --batch <brand>/<batch> [--kind pedals|boards]
                    [--board <board-id>] [--name <scene-name>]
                    [--origin <origin-url>] [--out <file>]
  catalog-demo-link --ids <id,id,...> [same options]

Examples:
  pnpm catalog:demo-link --batch meris/meris-1 \\
    --origin https://my-branch.pedalvision.pages.dev

Run pnpm catalog:ci first: this CLI reads the uncommitted runtime for dimensions
and jack order (a fresh batch is not in the committed runtime yet). Board batches
produce a board-only demo scene. The linked scene is read-only until saved.`;

type Args = {
	batch?: string;
	kind?: "pedals" | "boards";
	ids?: string[];
	board?: string;
	name?: string;
	origin: string;
	out?: string;
	help: boolean;
};

function parseArgs(argv: string[]): Args {
	const args: Args = { origin: "https://pedalvision.pages.dev", help: false };
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		switch (arg) {
			case "--batch":
				args.batch = argv[++i];
				break;
			case "--kind": {
				const value = argv[++i];
				if (value !== "pedals" && value !== "boards") {
					throw new Error(`--kind must be pedals|boards (got "${value}")`);
				}
				args.kind = value;
				break;
			}
			case "--ids":
				args.ids = (argv[++i] ?? "")
					.split(",")
					.map((id) => id.trim())
					.filter(Boolean);
				break;
			case "--board":
				args.board = argv[++i];
				break;
			case "--name":
				args.name = argv[++i];
				break;
			case "--origin":
				args.origin = argv[++i] ?? args.origin;
				break;
			case "--out":
				args.out = argv[++i];
				break;
			case "--help":
			case "-h":
				args.help = true;
				break;
			default:
				throw new Error(`unknown argument "${arg}"`);
		}
	}
	return args;
}

async function readJson(path: string): Promise<unknown> {
	return JSON.parse(await readFile(resolve(process.cwd(), path), "utf8"));
}

type RawRecord = { id: string };

async function rawBatch(
	kind: "pedals" | "boards",
	batch: string,
): Promise<RawRecord[]> {
	if (!/^[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9-]*$/.test(batch)) {
		throw new Error(`--batch must be "<brand>/<batch>" (got "${batch}")`);
	}
	const raw = await readJson(`data/catalog/research/${kind}/${batch}.json`);
	if (!Array.isArray(raw))
		throw new Error(`raw ${kind} batch ${batch} is not an array`);
	return raw.map((record) => {
		if (
			typeof record !== "object" ||
			record === null ||
			typeof record.id !== "string"
		) {
			throw new Error(
				`raw ${kind} batch ${batch} has a record without a string id`,
			);
		}
		return record as RawRecord;
	});
}

async function batchKind(batch: string): Promise<"pedals" | "boards"> {
	try {
		await readFile(
			resolve(process.cwd(), `data/catalog/research/pedals/${batch}.json`),
			"utf8",
		);
		return "pedals";
	} catch {
		return "boards";
	}
}

async function main(): Promise<void> {
	const args = parseArgs(process.argv.slice(2));
	if (args.help) {
		console.log(USAGE);
		return;
	}
	const kind =
		args.kind ?? (args.batch ? await batchKind(args.batch) : "pedals");
	if (args.batch && kind === "boards") {
		const records = await rawBatch("boards", args.batch);
		const ids = records.map((record) => record.id);
		const boards = CatalogBoardSchema.array().parse(
			await readJson("src/catalog/data/boards.json"),
		) as CatalogBoard[];
		const byId = new Map(boards.map((board) => [board.id, board]));
		const missing = ids.filter((id) => !byId.has(id));
		if (missing.length > 0) {
			throw new Error(
				`not in the runtime catalog: ${missing.join(", ")} (run pnpm catalog:ci first)`,
			);
		}
		const boardRows = boardRowSnapshots(
			ids.map((id) => {
				const board = byId.get(id);
				if (!board) throw new Error(`missing board ${id}`);
				return {
					id: board.id,
					widthCm: board.widthCm,
					heightCm: board.heightCm,
				};
			}),
		);
		const boardWord = boardRows.length === 1 ? "board" : "boards";
		const name = args.name ?? `Board demo — ${boardRows.length} ${boardWord}`;
		const snapshot: DemoSnapshot = {
			boards: boardRows,
			items: [],
			customPedals: [],
			endpoints: [],
			cables: [],
		};
		const hash = encodeDemoHash(name, snapshot);
		if (hash.length > 32_000) {
			throw new Error(
				`share link too long (${hash.length} chars; limit 32,000)`,
			);
		}
		const origin = args.origin.replace(/\/+$/, "");
		const url = `${origin}/?share=1${hash}`;
		const summary = {
			name,
			kind,
			boards: boardRows.length,
			items: 0,
			cables: 0,
			hashChars: hash.length,
			url,
		};
		if (args.out)
			await writeFile(resolve(process.cwd(), args.out), `${url}\n`, "utf8");
		console.log(JSON.stringify(summary, null, 2));
		return;
	}

	const ids =
		args.ids ??
		(args.batch
			? (await rawBatch("pedals", args.batch)).map((record) => record.id)
			: undefined);
	if (!ids || ids.length === 0) {
		throw new Error("provide --batch <brand>/<batch> or --ids <id,id,...>");
	}

	const pedals = CatalogPedalSchema.array().parse(
		await readJson("src/catalog/data/pedals.json"),
	) as CatalogPedal[];
	const boards = CatalogBoardSchema.array().parse(
		await readJson("src/catalog/data/boards.json"),
	) as CatalogBoard[];
	const byId = new Map(pedals.map((pedal) => [pedal.id, pedal]));
	const missing = ids.filter((id) => !byId.has(id));
	if (missing.length > 0) {
		throw new Error(
			`not in the runtime catalog: ${missing.join(", ")} (run pnpm catalog:ci first)`,
		);
	}

	const items: DemoItem[] = ids.map((id) => {
		const pedal = byId.get(id);
		if (!pedal) throw new Error(`missing pedal ${id}`);
		return {
			id: pedal.id,
			widthCm: pedal.widthCm,
			heightCm: pedal.heightCm,
			category: pedal.category,
			jacks: pedal.jacks,
		};
	});

	const { board, pack } = chooseBoard(
		items,
		boards.map((entry) => ({
			id: entry.id,
			widthCm: entry.widthCm,
			heightCm: entry.heightCm,
		})),
		args.board,
	);
	const boardUid = "demo-board-1";
	const plan = cablePlan(items);
	const snapshot: DemoSnapshot = {
		boards: [boardSnapshot(board, boardUid)],
		items: itemSnapshots(items, pack, boardUid),
		customPedals: [],
		endpoints: [],
		cables: plan.cables,
	};
	const name = args.name ?? `Batch demo — ${ids.length} items`;
	const hash = encodeDemoHash(name, snapshot);
	if (hash.length > 32_000) {
		throw new Error(`share link too long (${hash.length} chars; limit 32,000)`);
	}
	const origin = args.origin.replace(/\/+$/, "");
	const url = `${origin}/?share=1${hash}`;
	const summary = {
		name,
		kind,
		board: board.boardRefId ?? `custom ${board.widthCm}×${board.heightCm} cm`,
		items: snapshot.items.length,
		cables: snapshot.cables.length,
		unconnected: plan.unconnected,
		hashChars: hash.length,
		url,
	};
	if (plan.unconnected.length > 0) {
		console.error(
			`warning: no audio in/out cable anchors for: ${plan.unconnected.join(", ")}`,
		);
	}
	if (args.out)
		await writeFile(resolve(process.cwd(), args.out), `${url}\n`, "utf8");
	console.log(JSON.stringify(summary, null, 2));
}

main().catch((error: unknown) => {
	console.error(`error: ${error instanceof Error ? error.message : error}`);
	process.exitCode = 1;
});
