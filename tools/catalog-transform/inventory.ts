import { inchesToCm } from "./convert.ts";
import {
	CATALOG_LIMITS,
	TIER_A_BOARD_BRANDS,
	TIER_A_PEDAL_BRANDS,
} from "./limits.ts";
import { toSlug, VARIANT_SUFFIX } from "./slug.ts";

/**
 * Master inventory builder (P5-01). Turns the two discovery lists into our own
 * normalized candidate list: stable slugs, dedupe, colorway collapse and
 * Tier A/B/C assignment. Input rows are the generic discovery shape
 * `{ Brand, Name, Width, Height }` (inches); output is cm-only.
 *
 * The inventory is off-runtime (`data/catalog/inventory.json`). It never stores
 * external image filenames; image candidates live in the raw research archive.
 */

export type DiscoveryRow = {
	Brand?: unknown;
	Name?: unknown;
	Width?: unknown;
	Height?: unknown;
	Image?: unknown;
};

export type InventoryTier = "A" | "B" | "C";

export type InventoryItem = {
	id: string;
	brand: string;
	name: string;
	widthCm: number;
	heightCm: number;
	tier: InventoryTier;
	/** Base model id for a colorway/edition with a present base. */
	variantOf?: string;
	/** True when the item also exists in the committed seed. */
	seed?: true;
	/**
	 * The committed seed's catalog id when it differs from `id` (legacy slug).
	 * P5-03 must reuse this id so saved `PlacedItem.refId`s keep resolving.
	 */
	seedId?: string;
};

export type InventoryBrand = {
	brand: string;
	key: string;
	tier: InventoryTier;
	items: number;
	tierA: number;
	tierB: number;
	tierC: number;
};

export type Inventory = {
	version: 1;
	generatedAt: string;
	policy: {
		hostedPedals: number;
		hostedPedalImageFiles: number;
		hostedPedalImageMb: number;
		firstBatchItems: number;
		tierAPedals: number;
		tierABoards: number;
		boardImageFiles: number;
		boardImageMb: number;
		minLaunchPedals: number;
		minLaunchBrands: number;
		minLaunchBoards: number;
	};
	summary: {
		pedals: InventorySummary;
		boards: InventorySummary;
	};
	brands: {
		pedals: InventoryBrand[];
		boards: InventoryBrand[];
	};
	pedals: InventoryItem[];
	boards: InventoryItem[];
};

export type InventorySummary = {
	discovered: number;
	skipped: number;
	duplicatesRemoved: number;
	variants: number;
	orphanVariants: number;
	unique: number;
	brands: number;
	tierA: number;
	tierB: number;
	tierC: number;
	seedOverlap: number;
};

export type BuildInventoryOptions = {
	generatedAt: string;
	/** The committed seed, for the overlap flag (ids/names are normalized). */
	seedPedals?: Array<{ id: string; brand: string; name: string }>;
	seedBoards?: Array<{ id: string; brand: string; name: string }>;
};

/**
 * Conservative colorway/finish tokens. A parenthetical suffix is linked via
 * `variantOf` only when it reads as a finish/edition, never for a distinct
 * model, revision or size (`(Bass)`, `(V2)`, `(Deluxe)`, `(18x12)` stay their
 * own products).
 */
const COLORWAY_TOKENS = new Set([
	"black",
	"white",
	"blue",
	"red",
	"green",
	"orange",
	"yellow",
	"purple",
	"pink",
	"gray",
	"grey",
	"silver",
	"gold",
	"brown",
	"tan",
	"cream",
	"teal",
	"cyan",
	"magenta",
	"amber",
	"violet",
	"indigo",
	"navy",
	"burgundy",
	"crimson",
	"scarlet",
	"olive",
	"khaki",
	"mint",
	"salmon",
	"lavender",
	"ivory",
	"copper",
	"bronze",
	"chrome",
	"nickel",
	"graphite",
	"charcoal",
	"smoke",
	"clear",
	"transparent",
	"translucent",
	"natural",
	"sunburst",
	"sparkle",
	"glitter",
	"matte",
	"gloss",
	"satin",
	"relic",
	"aged",
	"blackout",
	"whiteout",
	"fractured",
	"chibi",
	"rainbow",
	"pride",
	"crystal",
	"saccharine",
	"alt",
	"universe",
	"anniversary",
	"limited",
	"exclusive",
	"edition",
]);

function isColorwaySuffix(suffix: string): boolean {
	const tokens = suffix
		.toLowerCase()
		.split(/[^a-z0-9]+/)
		.filter(Boolean);
	return tokens.some((token) => COLORWAY_TOKENS.has(token));
}

/** Board-brand display aliases → the priority-brand key. */
const BRAND_ALIASES: Record<string, string> = {
	templeboards: "temple-audio",
	"creation-music-co": "creation-music",
	"morton-pedalboards": "morton",
	"rockboard-by-warwick": "rockboard",
	"vertex-effects": "vertex",
	"skb-cases": "skb",
	// The discovery brand is "GFI System"; the plan's Tier A list says "GFI".
	gfi: "gfi-system",
};

/** Canonical brand key used for grouping/tier matching (aliases collapse). */
export function brandKey(brand: string): string {
	const slug = toSlug(brand);
	return BRAND_ALIASES[slug] ?? slug;
}

function seedKey(brand: string, name: string): string {
	return `${brandKey(brand)}|${toSlug(name)}`;
}

function compare(a: string, b: string): number {
	return a < b ? -1 : a > b ? 1 : 0;
}

function asTrimmedString(value: unknown): string {
	return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function isPositiveNumber(value: unknown): value is number {
	return typeof value === "number" && Number.isFinite(value) && value > 0;
}

type RawItem = Omit<InventoryItem, "tier" | "seed">;

type ParsedItems = {
	items: RawItem[];
	skipped: number;
	duplicatesRemoved: number;
	variants: number;
	orphanVariants: number;
};

function buildPedals(rows: DiscoveryRow[]): ParsedItems {
	const items: RawItem[] = [];
	const byId = new Map<string, RawItem>();
	let skipped = 0;
	let duplicatesRemoved = 0;
	let variants = 0;

	for (const row of rows) {
		if (!row || typeof row !== "object") {
			skipped++;
			continue;
		}
		const brand = asTrimmedString(row.Brand);
		const name = asTrimmedString(row.Name);
		if (
			!brand ||
			!name ||
			!isPositiveNumber(row.Width) ||
			!isPositiveNumber(row.Height)
		) {
			skipped++;
			continue;
		}
		const variantMatch = name.match(VARIANT_SUFFIX);
		const baseName = variantMatch ? variantMatch[1].trim() : name;
		const baseId = toSlug(`${brand} ${baseName}`);
		const variantSlug = variantMatch ? toSlug(variantMatch[2]) : "";
		const id = variantMatch ? `${baseId}-${variantSlug}` : baseId;
		const colorway = variantMatch ? isColorwaySuffix(variantMatch[2]) : false;
		if (!baseId || (variantMatch && !variantSlug)) {
			skipped++;
			continue;
		}
		if (byId.has(id)) {
			duplicatesRemoved++;
			continue;
		}
		if (colorway) variants++;
		const item: RawItem = {
			id,
			brand,
			name,
			widthCm: inchesToCm(row.Width),
			heightCm: inchesToCm(row.Height),
			...(colorway ? { variantOf: baseId } : {}),
		};
		byId.set(id, item);
		items.push(item);
	}

	// Only keep `variantOf` for a colorway whose base model is actually present;
	// a variant whose base is absent stays a real standalone candidate.
	let orphanVariants = 0;
	const ids = new Set(items.map((item) => item.id));
	for (const item of items) {
		if (item.variantOf && !ids.has(item.variantOf)) {
			orphanVariants++;
			item.variantOf = undefined;
		}
	}

	return { items, skipped, duplicatesRemoved, variants, orphanVariants };
}

function buildBoards(rows: DiscoveryRow[]): ParsedItems {
	const items: RawItem[] = [];
	const seen = new Set<string>();
	let skipped = 0;
	let duplicatesRemoved = 0;

	for (const row of rows) {
		if (!row || typeof row !== "object") {
			skipped++;
			continue;
		}
		const brand = asTrimmedString(row.Brand);
		const name = asTrimmedString(row.Name);
		if (
			!brand ||
			!name ||
			!isPositiveNumber(row.Width) ||
			!isPositiveNumber(row.Height)
		) {
			skipped++;
			continue;
		}
		const id = toSlug(`${brand} ${name}`);
		if (!id) {
			skipped++;
			continue;
		}
		if (seen.has(id)) {
			duplicatesRemoved++;
			continue;
		}
		seen.add(id);
		items.push({
			id,
			brand,
			name,
			widthCm: inchesToCm(row.Width),
			heightCm: inchesToCm(row.Height),
		});
	}

	return { items, skipped, duplicatesRemoved, variants: 0, orphanVariants: 0 };
}

type BrandGroup = {
	key: string;
	brand: string;
	items: RawItem[];
};

function groupBrands(items: RawItem[]): Map<string, BrandGroup> {
	const groups = new Map<string, BrandGroup>();
	const displayCounts = new Map<string, Map<string, number>>();
	for (const item of items) {
		const key = brandKey(item.brand);
		const group = groups.get(key);
		if (group) group.items.push(item);
		else groups.set(key, { key, brand: item.brand, items: [item] });
		const counts = displayCounts.get(key) ?? new Map<string, number>();
		counts.set(item.brand, (counts.get(item.brand) ?? 0) + 1);
		displayCounts.set(key, counts);
	}
	// Choose the most frequent raw display per canonical key (deterministic).
	for (const [key, group] of groups) {
		const counts = displayCounts.get(key);
		if (!counts) continue;
		const [display] = [...counts.entries()].sort(
			(a, b) => b[1] - a[1] || compare(a[0], b[0]),
		)[0] ?? [group.brand];
		group.brand = display;
		for (const item of group.items) item.brand = display;
	}
	return groups;
}

function byTierOrder(a: RawItem, b: RawItem): number {
	// Base models before their colorways, then stable name/id order.
	const aVariant = a.variantOf ? 1 : 0;
	const bVariant = b.variantOf ? 1 : 0;
	return aVariant - bVariant || compare(a.name, b.name) || compare(a.id, b.id);
}

type TierAssignment = {
	brands: InventoryBrand[];
	tierOf: Map<RawItem, InventoryTier>;
};

function assignTiers(
	items: RawItem[],
	priorityBrands: readonly string[],
	cap: number,
	tierBBrandCount: number,
): TierAssignment {
	const groups = groupBrands(items);
	const priorityKeys = new Set(priorityBrands.map((brand) => brandKey(brand)));
	const tierOf = new Map<RawItem, InventoryTier>();
	let tierACount = 0;

	const takeBrand = (group: BrandGroup) => {
		for (const item of [...group.items].sort(byTierOrder)) {
			if (tierACount >= cap) break;
			if (tierOf.has(item)) continue;
			tierOf.set(item, "A");
			tierACount++;
		}
	};

	for (const brand of priorityBrands) {
		const group = groups.get(brandKey(brand));
		if (group) takeBrand(group);
	}
	// Top up to the cap from the largest remaining brands (only if priority
	// brands run out; keeps Tier A at the hard cap).
	if (tierACount < cap) {
		const remaining = [...groups.values()]
			.filter((group) => !priorityKeys.has(group.key))
			.sort(
				(a, b) => b.items.length - a.items.length || compare(a.brand, b.brand),
			);
		for (const group of remaining) {
			if (tierACount >= cap) break;
			takeBrand(group);
		}
	}

	const tierBBrands = [...groups.values()]
		.filter((group) => !priorityKeys.has(group.key))
		.sort(
			(a, b) => b.items.length - a.items.length || compare(a.brand, b.brand),
		)
		.slice(0, tierBBrandCount);
	for (const key of priorityKeys) {
		const group = groups.get(key);
		if (group) tierBBrands.push(group);
	}
	const tierBKeys = new Set(tierBBrands.map((group) => group.key));

	for (const item of items) {
		if (tierOf.has(item)) continue;
		tierOf.set(item, tierBKeys.has(brandKey(item.brand)) ? "B" : "C");
	}

	const brands: InventoryBrand[] = [...groups.values()]
		.map((group) => {
			const counts = { A: 0, B: 0, C: 0 };
			for (const item of group.items) {
				const tier = tierOf.get(item) ?? "C";
				counts[tier]++;
			}
			const tier: InventoryTier = counts.A > 0 ? "A" : counts.B > 0 ? "B" : "C";
			return {
				brand: group.brand,
				key: group.key,
				tier,
				items: group.items.length,
				tierA: counts.A,
				tierB: counts.B,
				tierC: counts.C,
			};
		})
		.sort(
			(a, b) =>
				compare(a.tier, b.tier) ||
				b.items - a.items ||
				compare(a.brand, b.brand),
		);

	return { brands, tierOf };
}

function toInventoryItems(
	items: RawItem[],
	tierOf: Map<RawItem, InventoryTier>,
	seedIds: Map<string, string>,
): InventoryItem[] {
	return [...items]
		.sort(
			(a, b) =>
				compare(tierOf.get(a) ?? "C", tierOf.get(b) ?? "C") ||
				compare(a.brand, b.brand) ||
				byTierOrder(a, b),
		)
		.map((item) => {
			const seedId = seedIds.get(seedKey(item.brand, item.name));
			return {
				...item,
				tier: tierOf.get(item) ?? "C",
				...(seedId ? { seed: true, seedId } : {}),
			};
		});
}

function summarize(
	parsed: ParsedItems,
	items: InventoryItem[],
): InventorySummary {
	const countTier = (tier: InventoryTier) =>
		items.filter((item) => item.tier === tier).length;
	return {
		discovered: items.length + parsed.skipped + parsed.duplicatesRemoved,
		skipped: parsed.skipped,
		duplicatesRemoved: parsed.duplicatesRemoved,
		variants: parsed.variants,
		orphanVariants: parsed.orphanVariants,
		unique: items.length,
		brands: new Set(items.map((item) => brandKey(item.brand))).size,
		tierA: countTier("A"),
		tierB: countTier("B"),
		tierC: countTier("C"),
		seedOverlap: items.filter((item) => item.seed === true).length,
	};
}

/**
 * Build the deterministic master inventory from discovery rows. Duplicates are
 * removed (first wins); colorway variants stay as their own catalog items with
 * `variantOf` when the base is present; tiers follow the plan's priority order
 * and hard caps.
 */
export function buildInventory(
	pedalRows: DiscoveryRow[],
	boardRows: DiscoveryRow[],
	options: BuildInventoryOptions,
): Inventory {
	const pedals = buildPedals(pedalRows);
	const boards = buildBoards(boardRows);
	const seedPedalIds = new Map(
		(options.seedPedals ?? []).map((item) => [
			seedKey(item.brand, item.name),
			item.id,
		]),
	);
	const seedBoardIds = new Map(
		(options.seedBoards ?? []).map((item) => [
			seedKey(item.brand, item.name),
			item.id,
		]),
	);

	const pedalTiers = assignTiers(
		pedals.items,
		TIER_A_PEDAL_BRANDS,
		CATALOG_LIMITS.tierAPedals,
		30,
	);
	const boardTiers = assignTiers(
		boards.items,
		TIER_A_BOARD_BRANDS,
		CATALOG_LIMITS.tierABoards,
		10,
	);
	const pedalItems = toInventoryItems(
		pedals.items,
		pedalTiers.tierOf,
		seedPedalIds,
	);
	const boardItems = toInventoryItems(
		boards.items,
		boardTiers.tierOf,
		seedBoardIds,
	);

	return {
		version: 1,
		generatedAt: options.generatedAt,
		policy: {
			hostedPedals: CATALOG_LIMITS.hostedPedals,
			hostedPedalImageFiles: CATALOG_LIMITS.hostedPedalImageFiles,
			hostedPedalImageMb: CATALOG_LIMITS.hostedPedalImageMb,
			firstBatchItems: CATALOG_LIMITS.firstBatchItems,
			tierAPedals: CATALOG_LIMITS.tierAPedals,
			tierABoards: CATALOG_LIMITS.tierABoards,
			boardImageFiles: CATALOG_LIMITS.boardImageFiles,
			boardImageMb: CATALOG_LIMITS.boardImageMb,
			minLaunchPedals: CATALOG_LIMITS.minLaunchPedals,
			minLaunchBrands: CATALOG_LIMITS.minLaunchBrands,
			minLaunchBoards: CATALOG_LIMITS.minLaunchBoards,
		},
		summary: {
			pedals: summarize(pedals, pedalItems),
			boards: summarize(boards, boardItems),
		},
		brands: { pedals: pedalTiers.brands, boards: boardTiers.brands },
		pedals: pedalItems,
		boards: boardItems,
	};
}
