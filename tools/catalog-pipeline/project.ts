import type {
	RawBoardRecord,
	RawJack,
	RawPedalRecord,
} from "../../src/catalog/rawSchema.ts";
import {
	type CatalogBoard,
	CatalogBoardSchema,
	type CatalogPedal,
	CatalogPedalSchema,
	type Jack,
	type Power,
	type SourceRef,
} from "../../src/catalog/schema.ts";

/**
 * Raw research record → runtime catalog projection (P5-02).
 *
 * The raw archive is the source of truth. These functions only map the fields
 * the app can render today; everything else stays in the raw file. The output is
 * validated against the runtime schema so a batch can never ship a shape the
 * app would reject.
 */

function projectJacks(jacks: RawJack[] | undefined): Jack[] | undefined {
	if (!jacks) return undefined;
	const projected = jacks
		// A power inlet is not a patch-cable anchor. The raw record keeps the
		// connector fact (and the `power` block carries its specs), but the
		// runtime cable graph only exposes signal/control jacks.
		.filter((jack) => jack.edge !== undefined && jack.kind !== "power")
		.map((jack) => {
			const value: Jack = {
				kind: jack.kind,
				edge: jack.edge as Jack["edge"],
			};
			if (jack.pos !== undefined) value.pos = jack.pos;
			if (jack.stereo !== undefined) value.stereo = jack.stereo;
			if (jack.approximate !== undefined) {
				value.approximate = jack.approximate;
			}
			return value;
		});
	return projected.length > 0 ? projected : undefined;
}

function projectPower(pedal: RawPedalRecord): Power | undefined {
	const power = pedal.power;
	if (
		power?.voltage === undefined ||
		power.acDc === undefined ||
		power.currentMa === undefined
	) {
		return undefined;
	}
	return {
		voltage: power.voltage,
		acDc: power.acDc,
		currentMa: power.currentMa,
	};
}

function projectSources(
	sources: RawPedalRecord["sources"] | RawBoardRecord["sources"],
): SourceRef[] | undefined {
	if (!sources) return undefined;
	return sources.map((source) => ({ url: source.url, kind: [...source.kind] }));
}

function assigned<T extends object>(
	target: T,
	key: keyof T,
	value: unknown,
): void {
	if (value !== undefined) target[key] = value as T[keyof T];
}

export function projectPedal(record: RawPedalRecord): CatalogPedal {
	const pedal: CatalogPedal = {
		id: record.id,
		brand: record.brand,
		name: record.name,
		widthCm: record.widthCm,
		heightCm: record.heightCm,
		image: `${record.id}.${record.imageFormat ?? "png"}`,
		imageSource: "static",
		effectTypes: record.effectTypes ?? [],
		category: record.category,
		source: "public-asset",
	};

	const jacks = projectJacks(record.jacks);
	assigned(pedal, "jacks", jacks);
	assigned(pedal, "power", projectPower(record));
	assigned(pedal, "variantOf", record.variantOf);
	assigned(pedal, "usage", record.usage);
	assigned(pedal, "color", record.color);
	assigned(pedal, "notes", record.notes);
	assigned(pedal, "year", record.year);
	assigned(pedal, "status", record.status);
	assigned(pedal, "confidence", record.confidence);
	assigned(pedal, "lastVerified", record.lastVerified);
	assigned(pedal, "sources", projectSources(record.sources));

	const parsed = CatalogPedalSchema.safeParse(pedal);
	if (!parsed.success) {
		throw new Error(
			`raw pedal "${record.id}" cannot be projected: ${parsed.error.issues[0]?.message}`,
		);
	}
	return parsed.data;
}

export function projectBoard(record: RawBoardRecord): CatalogBoard {
	const board: CatalogBoard = {
		id: record.id,
		brand: record.brand,
		name: record.name,
		widthCm: record.widthCm,
		heightCm: record.heightCm,
		image: `${record.id}.${record.imageFormat ?? "png"}`,
		imageSource: "static",
		source: "public-asset",
	};
	assigned(board, "variantOf", record.variantOf);
	assigned(board, "sources", projectSources(record.sources));

	const parsed = CatalogBoardSchema.safeParse(board);
	if (!parsed.success) {
		throw new Error(
			`raw board "${record.id}" cannot be projected: ${parsed.error.issues[0]?.message}`,
		);
	}
	return parsed.data;
}
