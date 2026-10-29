import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

type RawRecord = {
	id: string;
	brand: string;
	name: string;
	widthCm: number;
	heightCm: number;
};

type PublicPedal = {
	id: string;
	brand: string;
	name: string;
	widthCm: number;
	heightCm: number;
	image: string;
	imageSource: "static";
	effectTypes: ["utility"];
	category: "pedal";
	source: "public-asset";
	confidence: "unsure";
	notes: string;
};

const sourceDir = process.argv[2] ?? "data/catalog/planner-fill/pedals";
const output = process.argv[3] ?? "public/catalog/planner-pedals.json";
const files = (await readdir(sourceDir)).filter((file) => file.endsWith(".json"));
const records: RawRecord[] = [];
for (const file of files) {
	const rows = JSON.parse(await readFile(join(sourceDir, file), "utf8")) as RawRecord[];
	for (const row of rows) records.push(row);
}
const pedals: PublicPedal[] = records
	.map((row) => ({
		id: row.id,
		brand: row.brand,
		name: row.name,
		widthCm: row.widthCm,
		heightCm: row.heightCm,
		image: `${row.id}.avif`,
		imageSource: "static" as const,
		effectTypes: ["utility"] as ["utility"],
		category: "pedal" as const,
		source: "public-asset" as const,
		confidence: "unsure" as const,
		notes: "Planner placeholder — image pending replacement; specs unverified.",
	}))
	.sort((a, b) => a.brand.localeCompare(b.brand) || a.name.localeCompare(b.name));
await mkdir(join(output, ".."), { recursive: true });
await writeFile(output, JSON.stringify(pedals));
console.log(`planner public catalog: ${pedals.length} pedals -> ${output}`);
