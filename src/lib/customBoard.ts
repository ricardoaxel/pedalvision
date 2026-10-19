import type { CustomBoardDefinition, PlacedBoard } from "../state/scene";
import {
	BOARD_TEXTURES,
	type BoardTexture,
	DEFAULT_BOARD_TEXTURE,
} from "./boardTexture";
import { formatDimension, parseDimensionToCm } from "./customPedal";
import type { DisplayUnits } from "./geometry";

/**
 * Custom-board creator logic (P2-05, "Substrate") — pure, so units handling and
 * draft validation are unit-tested independently of the DOM. The draft holds
 * the raw form strings; canonical cm is one step away (`parseDimensionToCm`).
 * Storage is always cm: switching units re-derives the displayed number from
 * the cm parsed out of the *current* input, so a displayed value can't silently
 * compound a conversion (the same contract as `lib/customPedal.ts`).
 */

/** Largest accepted board edge (cm) — a sanity bound, not a product limit. */
export const MAX_BOARD_DIMENSION_CM = 200;

/** The creator form's raw state (dimensions are display-unit strings). */
export interface CustomBoardDraft {
	brand: string;
	name: string;
	width: string;
	depth: string;
	/**
	 * Canonical cm parsed from `width`/`depth` on the last edit (null when the
	 * string is empty/invalid). Submitting uses these, so switching units
	 * (whose display is only 2-decimal) never silently changes the stored size.
	 * Invariant: every write to `width`/`depth` must set the matching canonical
	 * field in the same patch — use `setBoardDraftDimension`.
	 */
	widthCm: number | null;
	depthCm: number | null;
	units: DisplayUnits;
	texture: BoardTexture;
}

/** Field-keyed validation messages (empty when valid). */
export interface CustomBoardErrors {
	width?: string;
	depth?: string;
}

export type CustomBoardValidation =
	| { ok: true; value: CustomBoardDefinition; errors: CustomBoardErrors }
	| { ok: false; errors: CustomBoardErrors };

/** A fresh draft (units seeded from the caller; dimensions empty). */
export function emptyCustomBoardDraft(
	units: DisplayUnits = "cm",
): CustomBoardDraft {
	return {
		brand: "",
		name: "",
		width: "",
		depth: "",
		widthCm: null,
		depthCm: null,
		units,
		texture: DEFAULT_BOARD_TEXTURE,
	};
}

/**
 * Set one dimension from the form's raw string, keeping the canonical cm in the
 * same patch (the `CustomBoardDraft` invariant). Use this instead of writing
 * `width`/`depth` directly, so the two can never diverge.
 */
export function setBoardDraftDimension(
	draft: CustomBoardDraft,
	field: "width" | "depth",
	raw: string,
): CustomBoardDraft {
	const cm = parseDimensionToCm(raw, draft.units);
	return field === "width"
		? { ...draft, width: raw, widthCm: cm }
		: { ...draft, depth: raw, depthCm: cm };
}

/**
 * Switch the draft's display unit. The display is re-derived from the canonical
 * cm (`widthCm`/`depthCm`) when present — so switching units never changes the
 * stored size — and falls back to parsing the current string for a draft built
 * without canonical values. An invalid dimension is kept verbatim.
 */
export function changeBoardDraftUnits(
	draft: CustomBoardDraft,
	units: DisplayUnits,
): CustomBoardDraft {
	if (draft.units === units) return draft;
	const convert = (
		canonical: number | null,
		raw: string,
		from: DisplayUnits,
	): string => {
		const cm = canonical ?? parseDimensionToCm(raw, from);
		return cm === null ? raw : formatDimension(cm, units);
	};
	return {
		...draft,
		units,
		width: convert(draft.widthCm, draft.width, draft.units),
		depth: convert(draft.depthCm, draft.depth, draft.units),
	};
}

/**
 * Seed a draft from an existing custom board (P2-05 edit), so the creator
 * reopens pre-filled. The canonical cm is seeded exactly, so an untouched
 * "Save changes" is bit-identical even if the display rounds.
 */
export function draftFromCustomBoard(
	board: PlacedBoard,
	units: DisplayUnits = "cm",
): CustomBoardDraft {
	const size = board.customSize ?? { widthCm: 0, heightCm: 0 };
	return {
		brand: board.brand ?? "",
		name: board.name ?? "",
		width: size.widthCm > 0 ? formatDimension(size.widthCm, units) : "",
		depth: size.heightCm > 0 ? formatDimension(size.heightCm, units) : "",
		widthCm: size.widthCm > 0 ? size.widthCm : null,
		depthCm: size.heightCm > 0 ? size.heightCm : null,
		units,
		texture: board.texture ?? DEFAULT_BOARD_TEXTURE,
	};
}

/**
 * Validate a draft and, when valid, produce the custom-board definition. Name
 * and brand are optional (a board with neither is simply "a custom board").
 * Dimensions prefer the canonical cm (exact) and fall back to parsing the
 * display string.
 */
export function validateCustomBoardDraft(
	draft: CustomBoardDraft,
): CustomBoardValidation {
	const errors: CustomBoardErrors = {};

	const widthCm = draft.widthCm ?? parseDimensionToCm(draft.width, draft.units);
	if (widthCm === null) errors.width = "Enter a positive width.";
	else if (widthCm > MAX_BOARD_DIMENSION_CM)
		errors.width = `Keep it under ${MAX_BOARD_DIMENSION_CM} cm.`;

	const heightCm =
		draft.depthCm ?? parseDimensionToCm(draft.depth, draft.units);
	if (heightCm === null) errors.depth = "Enter a positive depth.";
	else if (heightCm > MAX_BOARD_DIMENSION_CM)
		errors.depth = `Keep it under ${MAX_BOARD_DIMENSION_CM} cm.`;

	if (Object.keys(errors).length > 0) return { ok: false, errors };
	// widthCm/heightCm are non-null once their errors are absent.
	if (widthCm === null || heightCm === null) return { ok: false, errors };

	const texture = (BOARD_TEXTURES as readonly string[]).includes(draft.texture)
		? draft.texture
		: DEFAULT_BOARD_TEXTURE;

	return {
		ok: true,
		errors,
		value: {
			widthCm,
			heightCm,
			texture,
			name: draft.name.trim() || undefined,
			brand: draft.brand.trim() || undefined,
		},
	};
}
