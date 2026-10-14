import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import type {
	CatalogBoard,
	CatalogPedal,
	Jack,
	SourceTag,
} from "../../src/catalog/schema.ts";
import { toSlug } from "./convert.ts";
import { hashString } from "./hash.ts";
import { type RenditionSize, renderPng } from "./image.ts";

/**
 * Deterministic, license-clean synthetic seed (B3/N1/S2): fictional brands and
 * pedals only — every item gets `source: "synthetic"`. This is what fresh clones
 * and CI run against; the dataset-derived placeholder is a local-only overlay.
 *
 * Everything derives from fixed literals + a pure hash, so two runs produce
 * identical JSON and identical PNG bytes.
 */

export type SeedResult = {
	pedals: CatalogPedal[];
	boards: CatalogBoard[];
};

type SeedPedalInput = {
	brand: string;
	name: string;
	effects: string[];
	category?: "pedal" | "supply";
};

type SeedBoardInput = {
	brand: string;
	name: string;
	widthCm: number;
	heightCm: number;
};

const PEDAL_INPUTS: SeedPedalInput[] = [
	{ brand: "Voltstead", name: "Warmdrive", effects: ["overdrive"] },
	{ brand: "Ironbark Audio", name: "Flatline OD", effects: ["overdrive"] },
	{ brand: "Cinder", name: "Steelhorse", effects: ["overdrive"] },
	{ brand: "Northgate FX", name: "Ironclad Dist", effects: ["distortion"] },
	{ brand: "Tidewater Electronics", name: "Redsmith", effects: ["distortion"] },
	{ brand: "Rustline", name: "Highwire", effects: ["distortion"] },
	{ brand: "Glasshouse Labs", name: "Wooly Fuzz", effects: ["fuzz"] },
	{ brand: "Aurelia Audio", name: "Nebula Fuzz", effects: ["fuzz"] },
	{ brand: "Mobius Sound", name: "Beehive", effects: ["fuzz"] },
	{ brand: "Copperfield", name: "Tapewell", effects: ["delay"] },
	{ brand: "Voltstead", name: "Echo Garden", effects: ["delay"] },
	{ brand: "Ironbark Audio", name: "Longway", effects: ["delay"] },
	{ brand: "Cinder", name: "Cathedral", effects: ["reverb"] },
	{ brand: "Northgate FX", name: "Shimmerwell", effects: ["reverb"] },
	{ brand: "Tidewater Electronics", name: "Deep Space", effects: ["reverb"] },
	{ brand: "Rustline", name: "Seafoam Chorus", effects: ["chorus"] },
	{ brand: "Glasshouse Labs", name: "Vintage Tide", effects: ["chorus"] },
	{ brand: "Aurelia Audio", name: "Pulsar", effects: ["tremolo"] },
	{ brand: "Mobius Sound", name: "Wobblebox", effects: ["tremolo"] },
	{ brand: "Copperfield", name: "Jetstream", effects: ["phaser"] },
	{ brand: "Voltstead", name: "Stone Phase", effects: ["phaser"] },
	{ brand: "Ironbark Audio", name: "Aircurtain", effects: ["flanger"] },
	{ brand: "Cinder", name: "Squeeze", effects: ["compressor"] },
	{ brand: "Northgate FX", name: "Levelbest", effects: ["compressor"] },
	{ brand: "Tidewater Electronics", name: "Tone Stack", effects: ["eq"] },
	{ brand: "Rustline", name: "Sculptor", effects: ["eq"] },
	{ brand: "Glasshouse Labs", name: "Pure Boost", effects: ["boost"] },
	{ brand: "Aurelia Audio", name: "Liftoff", effects: ["boost"] },
	{ brand: "Mobius Sound", name: "Pitchlock", effects: ["tuner"] },
	{ brand: "Copperfield", name: "Accutune", effects: ["tuner"] },
	{ brand: "Voltstead", name: "Crywave", effects: ["wah"] },
	{ brand: "Ironbark Audio", name: "Sweepmaster", effects: ["wah"] },
	{ brand: "Cinder", name: "Loopwell", effects: ["looper"] },
	{ brand: "Northgate FX", name: "Echoloop", effects: ["looper"] },
	{ brand: "Tidewater Electronics", name: "Submerge", effects: ["octave"] },
	{ brand: "Rustline", name: "Octafuzz", effects: ["octave"] },
	{ brand: "Glasshouse Labs", name: "Shiftwell", effects: ["pitch"] },
	{ brand: "Aurelia Audio", name: "Silence Gate", effects: ["gate"] },
	{ brand: "Mobius Sound", name: "Bloom", effects: ["overdrive"] },
	{ brand: "Copperfield", name: "Ember", effects: ["distortion"] },
	{ brand: "Voltstead", name: "Quarry", effects: ["fuzz"] },
	{ brand: "Ironbark Audio", name: "Cascade", effects: ["delay"] },
	{ brand: "Cinder", name: "Halcyon", effects: ["reverb"] },
	{ brand: "Northgate FX", name: "Drift", effects: ["chorus"] },
	{ brand: "Tidewater Electronics", name: "Nomad", effects: ["phaser"] },
	{ brand: "Rustline", name: "Anvil", effects: ["compressor"] },
	{ brand: "Glasshouse Labs", name: "Beacon", effects: ["boost"] },
	{
		brand: "Aurelia Audio",
		name: "Powerbrick 9",
		effects: ["power"],
		category: "supply",
	},
	{
		brand: "Mobius Sound",
		name: "Isolated 12",
		effects: ["power"],
		category: "supply",
	},
	{
		brand: "Copperfield",
		name: "Volt Station",
		effects: ["power"],
		category: "supply",
	},
];

/** A small set of colorway variants to exercise `variantOf`. */
const PEDAL_VARIANTS: { baseName: string; variant: string }[] = [
	{ baseName: "Wooly Fuzz", variant: "Black" },
	{ baseName: "Bloom", variant: "Aqua" },
];

const BOARD_INPUTS: SeedBoardInput[] = [
	{ brand: "Voltstead", name: "Terra 24", widthCm: 60, heightCm: 30 },
	{ brand: "Ironbark Audio", name: "Timber 36", widthCm: 90, heightCm: 36 },
	{ brand: "Northgate FX", name: "Nano", widthCm: 32, heightCm: 20 },
	{
		brand: "Tidewater Electronics",
		name: "Coast 17",
		widthCm: 43,
		heightCm: 31,
	},
	{ brand: "Rustline", name: "Flat 30", widthCm: 76, heightCm: 30 },
	{ brand: "Glasshouse Labs", name: "Pane 40", widthCm: 100, heightCm: 40 },
	{ brand: "Aurelia Audio", name: "Aria 22", widthCm: 56, heightCm: 32 },
	{ brand: "Mobius Sound", name: "Loop 12", widthCm: 31, heightCm: 24 },
	{ brand: "Copperfield", name: "Bench 28", widthCm: 71, heightCm: 28 },
	{ brand: "Cinder", name: "Ember 15", widthCm: 38, heightCm: 29 },
];

function round2(value: number): number {
	return Math.round((value + Number.EPSILON) * 100) / 100;
}

function pedalJacks(category: "pedal" | "supply"): Jack[] {
	if (category === "supply") {
		return [{ kind: "power", edge: "top", pos: 0.5 }];
	}
	return [
		{ kind: "in", edge: "top", pos: 0.3 },
		{ kind: "out", edge: "top", pos: 0.7 },
	];
}

function pedalDims(id: string, category: "pedal" | "supply") {
	const h = hashString(id);
	if (category === "supply") {
		return {
			widthCm: round2(8.5 + (h % 30) / 10),
			heightCm: round2(4.5 + (h % 20) / 10),
		};
	}
	return {
		widthCm: round2(5.8 + (h % 17) / 10),
		heightCm: round2(10.8 + (h % 16) / 10),
	};
}

function buildPedal(
	input: SeedPedalInput,
	overrides?: { id: string; name: string; variantOf: string },
): CatalogPedal {
	const category = input.category ?? "pedal";
	const id = overrides?.id ?? toSlug(`${input.brand} ${input.name}`);
	const name = overrides?.name ?? input.name;
	// A colorway is the same physical pedal, so it shares the base's footprint
	// and power (design.md: variantOf = "model id for colorways").
	const specId = overrides?.variantOf ?? id;
	const { widthCm, heightCm } = pedalDims(specId, category);
	const power =
		category === "supply"
			? {
					voltage: 9,
					acDc: "DC" as const,
					currentMa: 1000 + (hashString(specId) % 3000),
				}
			: {
					voltage: 9,
					acDc: "DC" as const,
					currentMa: 8 + (hashString(specId) % 120),
				};

	return {
		id,
		brand: input.brand,
		name,
		widthCm,
		heightCm,
		image: `${id}.png`,
		effectTypes: input.effects,
		category,
		jacks: pedalJacks(category),
		power,
		variantOf: overrides?.variantOf,
		source: "synthetic" as SourceTag,
	};
}

function buildBoard(input: SeedBoardInput): CatalogBoard {
	const id = toSlug(`${input.brand} ${input.name}`);
	return {
		id,
		brand: input.brand,
		name: input.name,
		widthCm: input.widthCm,
		heightCm: input.heightCm,
		image: `${id}.png`,
		source: "synthetic" as SourceTag,
	};
}

/** Build the whole seed in memory (no I/O). Deterministic. */
export function generateSeed(): SeedResult {
	const pedals = PEDAL_INPUTS.map((input) => buildPedal(input));
	for (const variant of PEDAL_VARIANTS) {
		const base = PEDAL_INPUTS.find((input) => input.name === variant.baseName);
		if (!base)
			throw new Error(`seed variant base "${variant.baseName}" not found`);
		const baseId = toSlug(`${base.brand} ${base.name}`);
		pedals.push(
			buildPedal(base, {
				id: `${baseId}-${toSlug(variant.variant)}`,
				name: `${base.name} (${variant.variant})`,
				variantOf: baseId,
			}),
		);
	}
	return { pedals, boards: BOARD_INPUTS.map(buildBoard) };
}

/** Short, human-distinguishable label for the placeholder art. */
export function labelFor(name: string): string {
	const code = name
		.replace(/\(.*?\)/g, "")
		.replace(/\s+/g, "")
		.toUpperCase()
		.slice(0, 8);
	return code || "PEDAL";
}

export type SeedImage = { path: string; buffer: Buffer };

/**
 * Render every seed image (pedals + boards, both renditions) into buffers keyed
 * by their repo-relative path under `assetsDir`.
 */
export async function renderSeedImages(
	seed: SeedResult,
	assetsDir: string,
): Promise<SeedImage[]> {
	const sizes: RenditionSize[] = [800, 350];
	const images: SeedImage[] = [];

	for (const pedal of seed.pedals) {
		for (const size of sizes) {
			images.push({
				path: join(assetsDir, "pedals", String(size), pedal.image),
				buffer: await renderPng({
					id: pedal.id,
					label: labelFor(pedal.name),
					widthCm: pedal.widthCm,
					heightCm: pedal.heightCm,
					size,
				}),
			});
		}
	}

	for (const board of seed.boards) {
		for (const size of sizes) {
			images.push({
				path: join(assetsDir, "boards", String(size), board.image),
				buffer: await renderPng({
					id: board.id,
					label: labelFor(board.name),
					widthCm: board.widthCm,
					heightCm: board.heightCm,
					size,
				}),
			});
		}
	}

	return images;
}

/** Write the seed JSON + PNGs to disk. */
export async function writeSeed(
	outDir: string,
	assetsDir: string,
): Promise<{ pedals: number; boards: number; images: number }> {
	const seed = generateSeed();
	await mkdir(outDir, { recursive: true });
	await writeFile(
		join(outDir, "pedals.json"),
		`${JSON.stringify(seed.pedals, null, 2)}\n`,
	);
	await writeFile(
		join(outDir, "boards.json"),
		`${JSON.stringify(seed.boards, null, 2)}\n`,
	);

	const images = await renderSeedImages(seed, assetsDir);
	for (const image of images) {
		await mkdir(dirname(image.path), { recursive: true });
		await writeFile(image.path, image.buffer);
	}

	// Generator-owned dirs: drop PNGs that no longer map to a seed item, so a
	// renamed/deleted item never leaves a stale asset shipping in public/.
	const owned = new Set(images.map((image) => resolve(image.path)));
	for (const dir of [
		join(assetsDir, "pedals", "800"),
		join(assetsDir, "pedals", "350"),
		join(assetsDir, "boards", "800"),
		join(assetsDir, "boards", "350"),
	]) {
		let entries: string[];
		try {
			entries = await readdir(dir);
		} catch {
			continue;
		}
		for (const entry of entries) {
			if (!entry.endsWith(".png")) continue;
			const full = resolve(join(dir, entry));
			if (!owned.has(full)) await rm(full, { force: true });
		}
	}

	return {
		pedals: seed.pedals.length,
		boards: seed.boards.length,
		images: images.length,
	};
}
