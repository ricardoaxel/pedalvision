import {
	type RawJack,
	RawPedalBatchSchema,
	type RawPedalRecord,
} from "../../src/catalog/rawSchema.ts";
import type { SourceRef } from "../../src/catalog/schema.ts";
import { isPlannerUrl } from "../catalog-license/index.ts";
import { toSlug } from "../catalog-transform/slug.ts";

/**
 * Deterministic legacy → raw-research scaffold for brand cleanup batches
 * (T-1 / P5-03c). Copies only facts that already exist on the runtime/legacy
 * item: no research, no invented fields, no planner URLs, and no asset slot.
 *
 * The batch session then re-sources the image (official or generated flat art)
 * and fills the spec/asset; this tool only prepares the raw record so cleanup
 * batches do not re-research a model they already have.
 */

export type RuntimePedalLike = {
	id: string;
	brand: string;
	name: string;
	widthCm: number;
	heightCm: number;
	category: "pedal" | "supply";
	effectTypes: string[];
	jacks?: Array<{
		kind: string;
		edge: string;
		pos?: number;
		stereo?: boolean;
		approximate?: boolean;
	}>;
	power?: { voltage: number; acDc: "DC" | "AC"; currentMa: number };
	variantOf?: string;
	usage?: string;
	color?: string;
	notes?: string;
	year?: number;
	status?: string;
	confidence?: string;
	lastVerified?: string;
	image?: string;
	imageSource?: "mock" | "static" | "url";
	source?: string;
	sources?: SourceRef[];
};

export type PromoteProvenance =
	| { kind: "legacy" }
	| { kind: "official"; sourceUrl: string };

export type PromoteLegacyInput = {
	brand: string;
	ids: string[];
	batch: string;
	runtime: RuntimePedalLike[];
	legacy: RuntimePedalLike[];
	provenance: PromoteProvenance;
	/** Every id already present in a raw batch anywhere (duplicate guard). */
	existingRawIds?: Iterable<string>;
};

export type PromoteLegacyResult = {
	records: RawPedalRecord[];
	warnings: string[];
};

/**
 * Keep only informational, non-planner sources. Legacy image URLs are dropped
 * because the batch must choose/replace the asset; the raw record keeps the
 * facts' provenance, not a pending image.
 */
export function filterSources(sources: SourceRef[] | undefined): SourceRef[] {
	const seen = new Set<string>();
	const filtered: SourceRef[] = [];
	for (const source of sources ?? []) {
		if (isPlannerUrl(source.url) || !source.kind.includes("info")) continue;
		if (seen.has(source.url)) continue;
		seen.add(source.url);
		filtered.push({ url: source.url, kind: ["info"] });
	}
	return filtered;
}

function provenanceFor(
	provenance: PromoteProvenance,
): RawPedalRecord["imageProvenance"] {
	if (provenance.kind === "official") {
		return {
			kind: "official",
			sourceUrl: provenance.sourceUrl,
			status: "chosen",
			note: "Re-sourced official reference; asset pending in this batch.",
		};
	}
	return {
		kind: "legacy",
		status: "pending-replacement",
		note: "Legacy asset cleared for replacement; source not recorded.",
	};
}

function toRawRecord(
	record: RuntimePedalLike,
	provenance: PromoteProvenance,
	batch: string,
): RawPedalRecord {
	const sources = filterSources(record.sources);
	const raw: RawPedalRecord = {
		id: record.id,
		brand: record.brand,
		name: record.name,
		widthCm: record.widthCm,
		heightCm: record.heightCm,
		category: record.category,
		effectTypes: [...record.effectTypes] as RawPedalRecord["effectTypes"],
		imageProvenance: provenanceFor(provenance),
		extra: { promotedFrom: "legacy", promotedBatch: batch },
	};

	if (record.variantOf) raw.variantOf = record.variantOf;
	if (record.usage) raw.usage = record.usage as RawPedalRecord["usage"];
	if (record.color) raw.color = record.color;
	if (record.notes) raw.notes = record.notes;
	if (record.year) raw.year = record.year;
	if (record.status) raw.status = record.status as RawPedalRecord["status"];
	if (record.confidence) {
		raw.confidence = record.confidence as RawPedalRecord["confidence"];
	}
	if (record.lastVerified) raw.lastVerified = record.lastVerified;
	if (record.jacks?.length) {
		raw.jacks = record.jacks as unknown as RawJack[];
	}
	if (record.power) raw.power = { ...record.power };
	if (sources.length) raw.sources = sources;

	return raw;
}

export function promoteLegacy(input: PromoteLegacyInput): PromoteLegacyResult {
	const brandKey = toSlug(input.brand);
	const warnings: string[] = [];
	const existing = new Set(input.existingRawIds ?? []);
	const legacyById = new Map(input.legacy.map((record) => [record.id, record]));
	const runtimeById = new Map(
		input.runtime.map((record) => [record.id, record]),
	);

	const seen = new Set<string>();
	const ids: string[] = [];
	for (const id of input.ids) {
		if (seen.has(id)) {
			warnings.push(`duplicate id "${id}" ignored`);
			continue;
		}
		seen.add(id);
		ids.push(id);
	}

	const records: RawPedalRecord[] = [];
	const missing: string[] = [];
	for (const id of ids) {
		if (existing.has(id)) {
			throw new Error(
				`"${id}" already exists in a raw batch; promote only legacy seed items`,
			);
		}
		const record = runtimeById.get(id) ?? legacyById.get(id);
		if (!record) {
			missing.push(id);
			continue;
		}
		if (toSlug(record.brand) !== brandKey) {
			throw new Error(
				`"${id}" belongs to "${record.brand}", not "${input.brand}"`,
			);
		}
		if (record.source === "public-asset") {
			throw new Error(
				`"${id}" is already a verified public asset; it is not a legacy seed`,
			);
		}
		records.push(toRawRecord(record, input.provenance, input.batch));
	}

	if (missing.length) {
		throw new Error(`unknown id(s): ${missing.join(", ")}`);
	}

	const parsed = RawPedalBatchSchema.safeParse(records);
	if (!parsed.success) {
		const issue = parsed.error.issues[0];
		throw new Error(
			`promoted batch is invalid: ${issue?.path.join(".") ?? ""} ${issue?.message ?? ""}`.trim(),
		);
	}
	return { records: parsed.data, warnings };
}
