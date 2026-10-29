import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { renderRenditions } from "../asset-pipeline/render.ts";
import { imageFilename, outputPath } from "../asset-pipeline/naming.ts";
import { toSlug } from "../catalog-transform/slug.ts";

type Row = {
	Brand: string;
	Name: string;
	Width: number;
	Height: number;
	Image: string;
};

type Options = {
	input: string;
	sourceBaseUrl: string;
	assetsDir: string;
	researchDir: string;
	catalogFile: string;
	downloadDir: string;
	reportFile: string;
	concurrency: number;
	limit?: number;
	write: boolean;
};

function parseArgs(argv: string[]): Options {
	const args: Options = {
		input: "",
		sourceBaseUrl: "",
		assetsDir: "public/pedal-assets",
		researchDir: "data/catalog/research/pedals",
		catalogFile: "src/catalog/data/pedals.json",
		downloadDir: "work/catalog/planner-fill/raw",
		reportFile: "work/catalog/planner-fill/report.json",
		concurrency: 4,
		write: false,
	};
	for (let i = 0; i < argv.length; i++) {
		const flag = argv[i];
		const value = argv[i + 1];
		switch (flag) {
			case "--input":
				args.input = value;
				i++;
				break;
			case "--source-base-url":
				args.sourceBaseUrl = value;
				i++;
				break;
			case "--assets-dir":
				args.assetsDir = value;
				i++;
				break;
			case "--research-dir":
				args.researchDir = value;
				i++;
				break;
			case "--catalog-file":
				args.catalogFile = value;
				i++;
				break;
			case "--download-dir":
				args.downloadDir = value;
				i++;
				break;
			case "--report":
				args.reportFile = value;
				i++;
				break;
			case "--concurrency":
				args.concurrency = Number(value);
				i++;
				break;
			case "--limit":
				args.limit = Number(value);
				i++;
				break;
			case "--write":
				args.write = true;
				break;
			default:
				throw new Error(`unknown argument: ${flag}`);
		}
	}
	if (!args.input || !args.sourceBaseUrl) {
		throw new Error("--input and --source-base-url are required");
	}
	if (!args.sourceBaseUrl.endsWith("/")) args.sourceBaseUrl += "/";
	return args;
}

function norm(value: string): string {
	return value
		.toLowerCase()
		.replace(/&/g, " and ")
		.replace(/[^a-z0-9]+/g, " ")
		.trim();
}

async function readJson<T>(path: string): Promise<T> {
	return JSON.parse(await readFile(path, "utf8")) as T;
}

async function existingIds(catalogFile: string): Promise<{
	ids: Set<string>;
	names: Set<string>;
}> {
	const rows = await readJson<Array<{ id: string; brand: string; name: string }>>(
		catalogFile,
	);
	return {
		ids: new Set(rows.map((row) => row.id)),
		names: new Set(rows.map((row) => `${norm(row.brand)}|${norm(row.name)}`)),
	};
}

type RawRecord = {
	id: string;
	brand: string;
	name: string;
	category: "pedal";
	effectTypes: ["utility"];
	widthCm: number;
	heightCm: number;
	dimensionsSource: string;
	imageFormat: "avif";
	sources: Array<{ url: string; kind: ["image"] }>;
	imageProvenance: {
		kind: "planner";
		sourceUrl: string;
		status: "pending-replacement";
		note: string;
	};
	confidence: "unsure";
	lastVerified: string;
	notes: string;
	extra: { plannerFill: true };
};

function makeRecord(row: Row, sourceUrl: string, id: string): RawRecord {
	const widthCm = Math.round(Number(row.Width) * 2.54 * 100) / 100;
	const heightCm = Math.round(Number(row.Height) * 2.54 * 100) / 100;
	return {
		id,
		brand: String(row.Brand).trim(),
		name: String(row.Name).trim(),
		category: "pedal",
		effectTypes: ["utility"],
		widthCm,
		heightCm,
		dimensionsSource: "planner footprint (includes jacks/protrusions)",
		imageFormat: "avif",
		sources: [{ url: sourceUrl, kind: ["image"] }],
		imageProvenance: {
			kind: "planner",
			sourceUrl,
			status: "pending-replacement",
			note: "Planner placeholder; replace with an official/authorized image.",
		},
		confidence: "unsure",
		lastVerified: "2026-10-29",
		notes: "Planner fallback import; specs unverified; image pending replacement.",
		extra: { plannerFill: true },
	};
}

async function writeBytes(path: string, data: Buffer): Promise<void> {
	await mkdir(join(path, ".."), { recursive: true });
	await writeFile(path, data);
}

async function main(): Promise<void> {
	const options = parseArgs(process.argv.slice(2));
	const rows = await readJson<Row[]>(options.input);
	const existing = await existingIds(options.catalogFile);
	const today = "2026-10-29";

	const selected: Array<{ row: Row; id: string; sourceUrl: string }> = [];
	const seenIds = new Set<string>();
	const seenNames = new Set<string>();
	for (const row of rows) {
		const rawId = toSlug(basename(String(row.Image), extname(String(row.Image))));
		if (!rawId || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(rawId)) continue;
		if (existing.ids.has(rawId) || seenIds.has(rawId)) continue;
		const nameKey = `${norm(row.Brand)}|${norm(row.Name)}`;
		if (existing.names.has(nameKey) || seenNames.has(nameKey)) continue;
		if (!Number.isFinite(Number(row.Width)) || Number(row.Width) <= 0) continue;
		if (!Number.isFinite(Number(row.Height)) || Number(row.Height) <= 0) continue;
		seenIds.add(rawId);
		seenNames.add(nameKey);
		selected.push({
			row,
			id: rawId,
			sourceUrl: `${options.sourceBaseUrl}${encodeURIComponent(String(row.Image))}`,
		});
	}

	const queue = options.limit ? selected.slice(0, options.limit) : selected;
	const total = queue.length;
	const started = Date.now();
	const records: RawRecord[] = [];
	const failures: Array<{ id: string; error: string }> = [];
	let done = 0;
	let bytes = 0;

	const workers = Array.from(
		{ length: Math.max(1, Math.min(options.concurrency, queue.length)) },
		async () => {
			for (;;) {
				const item = queue.shift();
				if (!item) return;
				try {
					const downloadPath = join(options.downloadDir, String(item.row.Image));
					let source: Buffer;
					try {
						source = await readFile(downloadPath);
					} catch {
						const response = await fetch(item.sourceUrl);
						if (!response.ok) {
							throw new Error(`download ${response.status}`);
						}
						source = Buffer.from(await response.arrayBuffer());
						if (options.write) await writeBytes(downloadPath, source);
					}
					const renditions = await renderRenditions(source, {
						matte: "none",
						format: "avif",
						quality: 70,
					});
					if (options.write) {
						for (const size of [800, 350] as const) {
							const file = imageFilename(item.id, "avif");
							await writeBytes(
								outputPath(options.assetsDir, "pedal", size, file),
								renditions[size],
							);
						}
					}
					const record = makeRecord(item.row, item.sourceUrl, item.id);
					records.push(record);
					bytes += renditions[800].length + renditions[350].length;
				} catch (error) {
					failures.push({
						id: item.id,
						error: error instanceof Error ? error.message : String(error),
					});
				}
				done++;
				if (done % 50 === 0 || done === total) {
					console.log(
						`${done}/${total} ok=${records.length} fail=${failures.length} bytes=${bytes}`,
					);
				}
			}
		},
	);
	await Promise.all(workers);

	if (options.write) {
		const byBrand = new Map<string, RawRecord[]>();
		for (const record of records) {
			const folder = toSlug(record.brand) || "unknown";
			const list = byBrand.get(folder) ?? [];
			list.push(record);
			byBrand.set(folder, list);
		}
		for (const [folder, list] of byBrand) {
			const path = join(options.researchDir, folder, "planner-fill.json");
			let existingRows: RawRecord[] = [];
			try {
				existingRows = await readJson<RawRecord[]>(path);
			} catch {
				existingRows = [];
			}
			const merged = new Map(existingRows.map((record) => [record.id, record]));
			for (const record of list) merged.set(record.id, record);
			const output = [...merged.values()].sort((a, b) =>
				a.id.localeCompare(b.id),
			);
			await writeBytes(path, Buffer.from(`${JSON.stringify(output, null, "\t")}\n`));
		}
	}

	const report = {
		generatedAt: new Date().toISOString(),
		today,
		input: options.input,
		totalRows: rows.length,
		eligible: selected.length,
		processed: total,
		written: records.length,
		failed: failures.length,
		avifBytes: bytes,
		elapsedMs: Date.now() - started,
		failures,
	};
	await writeBytes(options.reportFile, Buffer.from(`${JSON.stringify(report, null, 2)}\n`));
	console.log(JSON.stringify(report, null, 2));
}

await main();
