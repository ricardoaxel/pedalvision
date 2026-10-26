import type { Dirent } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

/**
 * Image licensing ledger (P5-03, owner decision 2026-10-26).
 *
 * One row per runtime pedal/board: where the image came from, whether it is
 * hosted/mock, and its licensing state. This is internal state (never rendered
 * in the app); it is regenerated from the runtime + raw archive + the
 * brand-level `data/catalog/image-licenses.json` request file.
 */

export const LICENSE_STATUSES = [
	"own",
	"licensed",
	"license-pending",
	"replacement-needed",
	"none",
] as const;

export type LicenseStatus = (typeof LICENSE_STATUSES)[number];
export type ImageHosting = "static" | "hotlinked" | "mock";
export type SourceKind = "official" | "legacy" | "own";

export type RuntimeItem = {
	id: string;
	brand: string;
	name: string;
	image: string;
	imageSource: "static" | "url" | "mock";
	source: string;
};

export type RawRecord = {
	id: string;
	imageCandidates?: Array<{ url?: string }>;
	sources?: Array<{ url?: string; kind?: string[] }>;
	imageProvenance?: { kind?: string; status?: string; note?: string };
};

export type BrandLicense = {
	displayName?: string;
	status?: "not-requested" | "pending" | "granted" | "denied";
	officialImages?: boolean;
	generatedArt?: boolean;
	officialImageSource?: string;
	contactPage?: string;
	pressEmail?: string | null;
	termsUrl?: string | null;
	licenseRef?: string | null;
	lastRequestedAt?: string | null;
	response?: string | null;
	notes?: string;
};

export type LicenseFile = {
	version: 1;
	contact: { name: string; email: string; siteUrl: string };
	brands: Record<string, BrandLicense>;
};

export type LedgerRow = {
	id: string;
	kind: "pedal" | "board";
	brand: string;
	name: string;
	asset: string;
	imageSource: string;
	imageHosting: ImageHosting;
	sourceKind: SourceKind;
	licenseStatus: LicenseStatus;
	licenseRef: string | null;
	replacementTarget: string | null;
	note: string;
};

export type Ledger = {
	version: 1;
	summary: {
		items: number;
		byStatus: Record<string, number>;
		byHosting: Record<string, number>;
		bySourceKind: Record<string, number>;
	};
	items: LedgerRow[];
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
		// The repo also carries the project via GitHub raw URLs.
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

function rawUrls(record: RawRecord | undefined): string[] {
	return [
		...(record?.imageCandidates ?? []).map((candidate) => candidate.url ?? ""),
		...(record?.sources ?? []).map((source) => source.url ?? ""),
	].filter(Boolean);
}

function increment(target: Record<string, number>, key: string): void {
	target[key] = (target[key] ?? 0) + 1;
}

export function classifyItem(
	item: RuntimeItem,
	kind: "pedal" | "board",
	raw: RawRecord | undefined,
	brands: Record<string, BrandLicense>,
): LedgerRow {
	const brand = brands[item.brand] ?? {};
	const granted = brand.status === "granted";
	const provenanceKind = raw?.imageProvenance?.kind;
	const plannerReferenced =
		(rawUrls(raw).some(isPlannerUrl) && !provenanceKind) ||
		provenanceKind === "planner";
	const legacy = provenanceKind === "legacy" || plannerReferenced;
	const mock =
		item.imageSource === "mock" ||
		(item.imageSource === "static" && item.source === "placeholder");
	const generatedBoard =
		kind === "board" &&
		item.source === "public-asset" &&
		provenanceKind === "own";

	let imageHosting: ImageHosting = "static";
	let sourceKind: SourceKind = "official";
	let licenseStatus: LicenseStatus = "license-pending";
	let replacementTarget: string | null = null;
	let note = "self-hosted official/authorized image";

	if (legacy) {
		imageHosting = "static";
		sourceKind = "legacy";
		licenseStatus = "replacement-needed";
		replacementTarget =
			item.brand === "BOSS"
				? "BOSS remaining batches (boss-4..boss-8)"
				: `${item.brand} batch`;
		note = "legacy asset; source not recorded; replacement pending";
	} else if (mock) {
		imageHosting = "mock";
		sourceKind = "own";
		licenseStatus = "own";
		replacementTarget = `${item.brand} batch`;
		note = "mock art; no real product image yet";
	} else if (generatedBoard) {
		imageHosting = "static";
		sourceKind = "own";
		licenseStatus = "own";
		note = "generated flat art; references only (no reference pixels)";
	} else if (item.imageSource === "url") {
		imageHosting = "hotlinked";
		sourceKind = "official";
		licenseStatus = granted ? "licensed" : "license-pending";
		replacementTarget = `${item.brand} batch`;
		note = "hotlinked legacy seed; replace with self-hosted in the brand batch";
	} else if (item.source === "public-asset") {
		imageHosting = "static";
		sourceKind = "official";
		licenseStatus = granted ? "licensed" : "license-pending";
		note = "self-hosted official/authorized image";
	} else {
		imageHosting = "static";
		sourceKind = "own";
		licenseStatus = "own";
		note = "own/local asset";
	}

	return {
		id: item.id,
		kind,
		brand: item.brand,
		name: item.name,
		asset: item.image,
		imageSource: item.imageSource,
		imageHosting,
		sourceKind,
		licenseStatus,
		licenseRef:
			licenseStatus === "licensed" ? (brand.licenseRef ?? null) : null,
		replacementTarget,
		note,
	};
}

export function buildLedger(
	runtime: { pedals: RuntimeItem[]; boards: RuntimeItem[] },
	raw: Map<string, RawRecord>,
	brands: Record<string, BrandLicense>,
): Ledger {
	const items = [
		...runtime.pedals.map((item) =>
			classifyItem(item, "pedal", raw.get(item.id), brands),
		),
		...runtime.boards.map((item) =>
			classifyItem(item, "board", raw.get(item.id), brands),
		),
	].sort((a, b) =>
		a.kind === b.kind
			? a.brand === b.brand
				? a.id.localeCompare(b.id)
				: a.brand.localeCompare(b.brand)
			: a.kind.localeCompare(b.kind),
	);
	const byStatus: Record<string, number> = {};
	const byHosting: Record<string, number> = {};
	const bySourceKind: Record<string, number> = {};
	for (const item of items) {
		increment(byStatus, item.licenseStatus);
		increment(byHosting, item.imageHosting);
		increment(bySourceKind, item.sourceKind);
	}
	return {
		version: 1,
		summary: { items: items.length, byStatus, byHosting, bySourceKind },
		items,
	};
}

function table(headers: string[], rows: string[][]): string[] {
	return [
		`| ${headers.join(" | ")} |`,
		`| ${headers.map(() => "---").join(" | ")} |`,
		...rows.map((row) => `| ${row.join(" | ")} |`),
	];
}

export function renderLedgerDoc(ledger: Ledger): string {
	const brands = [...new Set(ledger.items.map((item) => item.brand))].sort();
	const lines = [
		"# Asset license ledger",
		"",
		"> Generated by `pnpm catalog:asset-ledger`; do not edit by hand. Internal state, not shown in the app.",
		"",
		"## Summary",
		"",
		...table(
			["Status", "Items"],
			Object.entries(ledger.summary.byStatus)
				.sort()
				.map(([status, count]) => [status, String(count)]),
		),
		"",
		`Hosting: ${Object.entries(ledger.summary.byHosting)
			.sort()
			.map(([key, value]) => `${key} ${value}`)
			.join(" · ")}`,
		"",
		`Source kind: ${Object.entries(ledger.summary.bySourceKind)
			.sort()
			.map(([key, value]) => `${key} ${value}`)
			.join(" · ")}`,
		"",
	];
	for (const brand of brands) {
		const rows = ledger.items.filter((item) => item.brand === brand);
		lines.push(`## ${brand}`, "");
		lines.push(
			...table(
				["Id", "Name", "Status", "Hosting", "Source", "Replacement"],
				rows.map((item) => [
					`\`${item.id}\``,
					item.name,
					item.licenseStatus,
					item.imageHosting,
					item.sourceKind,
					item.replacementTarget ?? "—",
				]),
			),
		);
		lines.push("");
	}
	return `${lines.join("\n")}\n`;
}

export function renderLicensingDoc(ledger: Ledger, file: LicenseFile): string {
	const brands = Object.entries(file.brands).sort(([a], [b]) =>
		a.localeCompare(b),
	);
	const rows = brands.map(([name, brand]) => {
		const items = ledger.items.filter((item) => item.brand === name);
		const official = items.filter((item) => item.sourceKind === "official");
		const replacement = items.filter(
			(item) => item.licenseStatus === "replacement-needed",
		);
		const own = items.filter((item) => item.licenseStatus === "own");
		return [
			name,
			brand.status ?? "not-requested",
			String(official.length),
			String(replacement.length),
			String(own.length),
			brand.contactPage ? `[contact](${brand.contactPage})` : "—",
			brand.pressEmail ?? "—",
			brand.termsUrl ? `[terms](${brand.termsUrl})` : "—",
		];
	});
	const otherBrands = [...new Set(ledger.items.map((item) => item.brand))]
		.filter((brand) => !(brand in file.brands))
		.sort();
	const lines = [
		"# Image licensing & permission requests",
		"",
		"Internal working file for the owner. Catalog images are self-hosted and used for",
		"product identification / true-scale planning only. Pedalvision is independent and",
		"does not imply endorsement; removal requests are honoured (see `public/attribution.html`).",
		"",
		`Contact: **${file.contact.name}** · ${file.contact.email} · ${file.contact.siteUrl}`,
		"",
		"## Status meanings",
		"",
		"- **own** — our generated flat art / mock art (no third-party image licence needed).",
		"- **licensed** — written permission recorded (`licenseRef`).",
		"- **license-pending** — official/authorized image in use while permission is requested.",
		"- **replacement-needed** — legacy asset with no recorded source; replace with a permitted/generated image.",
		"- **none** — no image asset yet.",
		"",
		"## Brands with official images",
		"",
		...table(
			[
				"Brand",
				"Request",
				"Official",
				"Replace",
				"Own",
				"Contact",
				"Press email",
				"Terms",
			],
			rows,
		),
		"",
		"## Request log",
		"",
		...table(
			["Brand", "Status", "Last requested", "Response", "License ref"],
			brands.map(([name, brand]) => [
				name,
				brand.status ?? "not-requested",
				brand.lastRequestedAt ?? "—",
				brand.response ?? "—",
				brand.licenseRef ?? "—",
			]),
		),
		"",
		"Per-item list: [asset-ledger.md](./asset-ledger.md).",
		"",
		"## Official image sources",
		"",
		...brands.map(
			([name, brand]) =>
				`- **${name}** — ${brand.officialImageSource ?? "—"}${brand.notes ? ` — ${brand.notes}` : ""}`,
		),
		"",
		"## Permission email template",
		"",
		"```text",
		"Subject: Permission request — Pedalvision catalog images ({BRAND})",
		"",
		"Hello {BRAND} team,",
		"",
		`I run ${file.contact.name} (${file.contact.siteUrl}), an independent pedalboard planner.`,
		"We show product images only to help users identify gear and plan a board at true scale.",
		"The images are self-hosted, used for identification only, and we do not copy descriptions.",
		`The catalog is independent: it is not affiliated with or endorsed by ${"{BRAND}"}.`,
		"We credit sources and honour removal requests. We would like your written permission",
		"to use the official product images for these catalog items, or your preferred terms/credit.",
		"",
		"Items: {ITEM LIST / LINK}",
		"",
		`Kind regards,`,
		`${file.contact.name}`,
		file.contact.email,
		"```",
		"",
		"Update `data/catalog/image-licenses.json` after sending/response, then run",
		"`pnpm catalog:asset-ledger` to refresh the ledger and this file.",
		"",
	];
	if (otherBrands.length > 0) {
		lines.push(
			"## Mock-only brands (no official image yet)",
			"",
			"These brands currently use our own mock art; no image permission is needed until a real batch.",
			"",
			...otherBrands.map((brand) => {
				const count = ledger.items.filter(
					(item) => item.brand === brand,
				).length;
				return `- ${brand} (${count})`;
			}),
			"",
		);
	}
	return `${lines.join("\n")}\n`;
}

async function readJson<T>(path: string): Promise<T> {
	return JSON.parse(await readFile(path, "utf8")) as T;
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

async function readRaw(root: string): Promise<Map<string, RawRecord>> {
	const map = new Map<string, RawRecord>();
	for (const kind of ["pedals", "boards"] as const) {
		const dir = join(root, "data/catalog/research", kind);
		for (const file of await walkJson(dir)) {
			const parsed = await readJson<unknown>(file);
			if (!Array.isArray(parsed)) continue;
			for (const record of parsed as RawRecord[]) {
				if (record && typeof record.id === "string") map.set(record.id, record);
			}
		}
	}
	return map;
}

async function build(root: string): Promise<{
	ledger: Ledger;
	file: LicenseFile;
}> {
	const pedals = await readJson<RuntimeItem[]>(
		join(root, "src/catalog/data/pedals.json"),
	);
	const boards = await readJson<RuntimeItem[]>(
		join(root, "src/catalog/data/boards.json"),
	);
	const file = await readJson<LicenseFile>(
		join(root, "data/catalog/image-licenses.json"),
	);
	const raw = await readRaw(root);
	return { ledger: buildLedger({ pedals, boards }, raw, file.brands), file };
}

function render(ledger: Ledger): string {
	return `${JSON.stringify(ledger, null, 2)}\n`;
}

async function main(): Promise<void> {
	const command = process.argv[2] ?? "report";
	const root = resolve(process.cwd());
	const { ledger, file } = await build(root);
	const ledgerPath = join(root, "data/catalog/asset-ledger.json");
	const ledgerDocPath = join(root, "docs/catalog/asset-ledger.md");
	const licensingDocPath = join(root, "docs/catalog/image-licensing.md");

	if (command === "generate") {
		await mkdir(join(root, "docs/catalog"), { recursive: true });
		await writeFile(ledgerPath, render(ledger));
		await writeFile(ledgerDocPath, renderLedgerDoc(ledger));
		await writeFile(licensingDocPath, renderLicensingDoc(ledger, file));
		console.log(
			`asset ledger: ${ledger.summary.items} items · ${JSON.stringify(ledger.summary.byStatus)}`,
		);
		return;
	}
	if (command === "check") {
		const current = await readFile(ledgerPath, "utf8");
		if (current !== render(ledger)) {
			console.error(
				"asset ledger is stale — run `pnpm catalog:asset-ledger` and commit the result",
			);
			process.exitCode = 1;
			return;
		}
		const expectedDocs = [
			[ledgerDocPath, renderLedgerDoc(ledger)],
			[licensingDocPath, renderLicensingDoc(ledger, file)],
		] as const;
		for (const [path, expected] of expectedDocs) {
			const doc = await readFile(path, "utf8").catch(() => "");
			if (doc !== expected) {
				console.error(`${path} is stale — run \`pnpm catalog:asset-ledger\``);
				process.exitCode = 1;
				return;
			}
		}
		console.log(
			`asset ledger: current (${ledger.summary.items} items; ${JSON.stringify(ledger.summary.byStatus)})`,
		);
		return;
	}
	if (command === "report") {
		console.log(
			`asset ledger: ${ledger.summary.items} items · ${JSON.stringify(ledger.summary.byStatus)}`,
		);
		for (const [brand, count] of Object.entries(
			ledger.items.reduce<Record<string, number>>((acc, item) => {
				increment(acc, item.brand);
				return acc;
			}, {}),
		).sort()) {
			console.log(`  ${brand}: ${count}`);
		}
		return;
	}
	throw new Error(`unknown command "${command}" (use generate|check|report)`);
}

if (process.argv[1]?.endsWith("catalog-license/index.ts")) {
	main().catch((error: unknown) => {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	});
}
