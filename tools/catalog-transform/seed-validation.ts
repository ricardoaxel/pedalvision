import {
	CatalogBoardSchema,
	CatalogPedalSchema,
} from "../../src/catalog/schema.ts";

/**
 * Seed validation report (P5-01). The 207-pedal / 10-board seed is kept; this
 * classifies every item as keep / repair / replace / drop with reasons so P5-03
 * knows what to do with it instead of wiping it.
 *
 * Verdict precedence: drop > repair > replace > keep. "replace" is the expected
 * verdict for the seed's images under the P5 policy (mock/url/placeholder) — the
 * facts survive, the image is re-sourced.
 */

export type SeedVerdict = "keep" | "repair" | "replace" | "drop";

export type SeedValidationItem = {
	kind: "pedal" | "board";
	id: string;
	brand: string;
	name: string;
	verdict: SeedVerdict;
	reasons: string[];
};

export type SeedValidation = {
	version: 1;
	generatedAt: string;
	source: { pedals: number; boards: number };
	summary: {
		pedals: Record<SeedVerdict, number>;
		boards: Record<SeedVerdict, number>;
	};
	items: SeedValidationItem[];
};

export type ValidateSeedOptions = {
	generatedAt: string;
	/** True when both committed renditions exist for a static image. */
	hasStaticImage?: (kind: "pedal" | "board", image: string) => boolean;
};

type Parsed =
	| { ok: true; id: string; brand: string; name: string; data: unknown }
	| { ok: false; id: string; brand: string; name: string; reason: string };

function asString(value: unknown): string {
	return typeof value === "string" ? value : "";
}

function parsePedal(raw: unknown): Parsed {
	const parsed = CatalogPedalSchema.safeParse(raw);
	if (parsed.success) {
		return {
			ok: true,
			id: parsed.data.id,
			brand: parsed.data.brand,
			name: parsed.data.name,
			data: parsed.data,
		};
	}
	const record = (raw ?? {}) as Record<string, unknown>;
	return {
		ok: false,
		id: asString(record.id),
		brand: asString(record.brand),
		name: asString(record.name),
		reason: parsed.error.issues[0]?.message ?? "invalid pedal",
	};
}

function parseBoard(raw: unknown): Parsed {
	const parsed = CatalogBoardSchema.safeParse(raw);
	if (parsed.success) {
		return {
			ok: true,
			id: parsed.data.id,
			brand: parsed.data.brand,
			name: parsed.data.name,
			data: parsed.data,
		};
	}
	const record = (raw ?? {}) as Record<string, unknown>;
	return {
		ok: false,
		id: asString(record.id),
		brand: asString(record.brand),
		name: asString(record.name),
		reason: parsed.error.issues[0]?.message ?? "invalid board",
	};
}

const PEDAL_MIN_CM = 1;
const PEDAL_MAX_CM = 100;
const BOARD_MIN_CM = 10;
const BOARD_MAX_CM = 250;

function verdictOf(reasons: string[]): SeedVerdict {
	if (reasons.some((reason) => reason.startsWith("drop:"))) return "drop";
	if (reasons.some((reason) => reason.startsWith("repair:"))) return "repair";
	if (reasons.some((reason) => reason.startsWith("replace:"))) return "replace";
	return "keep";
}

function validatePedal(
	parsed: Parsed,
	seen: Set<string>,
	options: ValidateSeedOptions,
): SeedValidationItem {
	const reasons: string[] = [];
	if (!parsed.ok) reasons.push(`drop:${parsed.reason}`);
	if (parsed.id && seen.has(parsed.id)) reasons.push("drop:duplicate id");
	if (parsed.id) seen.add(parsed.id);
	if (parsed.ok) {
		const pedal = CatalogPedalSchema.parse(parsed.data);
		if (
			pedal.widthCm < PEDAL_MIN_CM ||
			pedal.widthCm > PEDAL_MAX_CM ||
			pedal.heightCm < PEDAL_MIN_CM ||
			pedal.heightCm > PEDAL_MAX_CM
		) {
			reasons.push(
				`repair:implausible dims ${pedal.widthCm}×${pedal.heightCm} cm`,
			);
		}
		if (pedal.category === "pedal" && pedal.effectTypes.length === 0) {
			reasons.push("repair:effectTypes missing for a pedal");
		}
		if (pedal.imageSource !== "static") {
			reasons.push(
				`replace:image is ${pedal.imageSource}, not a hosted static asset`,
			);
		} else if (
			options.hasStaticImage &&
			!options.hasStaticImage("pedal", pedal.image)
		) {
			reasons.push("repair:image file missing for a static asset");
		}
		if (pedal.source !== "public-asset") {
			reasons.push(`replace:rights tag is ${pedal.source}, not public-asset`);
		}
	}
	return {
		kind: "pedal",
		id: parsed.id,
		brand: parsed.brand,
		name: parsed.name,
		verdict: verdictOf(reasons),
		reasons,
	};
}

function validateBoard(
	parsed: Parsed,
	seen: Set<string>,
	options: ValidateSeedOptions,
): SeedValidationItem {
	const reasons: string[] = [];
	if (!parsed.ok) reasons.push(`drop:${parsed.reason}`);
	if (parsed.id && seen.has(parsed.id)) reasons.push("drop:duplicate id");
	if (parsed.id) seen.add(parsed.id);
	if (parsed.ok) {
		const board = CatalogBoardSchema.parse(parsed.data);
		if (
			board.widthCm < BOARD_MIN_CM ||
			board.widthCm > BOARD_MAX_CM ||
			board.heightCm < BOARD_MIN_CM ||
			board.heightCm > BOARD_MAX_CM
		) {
			reasons.push(
				`repair:implausible dims ${board.widthCm}×${board.heightCm} cm`,
			);
		}
		if (board.imageSource !== "static") {
			reasons.push(
				`replace:image is ${board.imageSource}, not a hosted static asset`,
			);
		} else if (
			options.hasStaticImage &&
			!options.hasStaticImage("board", board.image)
		) {
			reasons.push("repair:image file missing for a static asset");
		}
		if (board.source !== "public-asset") {
			reasons.push(`replace:rights tag is ${board.source}, not public-asset`);
		}
	}
	return {
		kind: "board",
		id: parsed.id,
		brand: parsed.brand,
		name: parsed.name,
		verdict: verdictOf(reasons),
		reasons,
	};
}

function emptyCounts(): Record<SeedVerdict, number> {
	return { keep: 0, repair: 0, replace: 0, drop: 0 };
}

/** Classify every seed item (no writes). */
export function validateSeed(
	pedals: unknown[],
	boards: unknown[],
	options: ValidateSeedOptions,
): SeedValidation {
	const pedalSeen = new Set<string>();
	const boardSeen = new Set<string>();
	const pedalItems = pedals.map((raw) =>
		validatePedal(parsePedal(raw), pedalSeen, options),
	);
	const boardItems = boards.map((raw) =>
		validateBoard(parseBoard(raw), boardSeen, options),
	);
	const pedalCounts = emptyCounts();
	for (const item of pedalItems) pedalCounts[item.verdict]++;
	const boardCounts = emptyCounts();
	for (const item of boardItems) boardCounts[item.verdict]++;

	return {
		version: 1,
		generatedAt: options.generatedAt,
		source: { pedals: pedals.length, boards: boards.length },
		summary: { pedals: pedalCounts, boards: boardCounts },
		items: [...pedalItems, ...boardItems],
	};
}
