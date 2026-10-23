import {
	type CatalogBoard,
	CatalogBoardSchema,
	type CatalogPedal,
	CatalogPedalSchema,
	type SourceTag,
} from "../../src/catalog/schema.ts";
import { type AssetKind, type ImageFormat, imageFilename } from "./naming.ts";

/**
 * Build the **JSON draft** catalog entry for a processed asset. The draft is
 * catalog-shaped (`imageSource: "static"` → the committed `public/pedal-assets/`
 * file) so an operator can merge it into `src/catalog/data/{pedals,boards}.json`
 * and re-run the catalog transformer's `seed`/`reclassify`. It is deliberately a
 * **hand-off, not an auto-merge**: whether an asset is cleared is a rights
 * decision (ADR-003), so `source` stays `placeholder` unless overridden.
 *
 * The entry is validated against the real catalog schema before it is returned,
 * so the CLI can never emit a draft the app would refuse to load.
 */

export type DraftInput = {
	kind: AssetKind;
	id: string;
	brand: string;
	name: string;
	widthCm: number;
	heightCm: number;
	/** Rights tag; defaults to `placeholder` (uncleared — ADR-003). */
	source?: SourceTag;
	/** Pedals only; defaults to `pedal`. */
	category?: "pedal" | "supply";
	/** Pedals only — the base model id for a colorway. */
	variantOf?: string;
	/** Delivery image format; defaults to `png` (P5 batches use `avif`). */
	format?: ImageFormat;
};

export function buildDraftEntry(
	input: DraftInput,
): CatalogPedal | CatalogBoard {
	const image = imageFilename(input.id, input.format);
	const base = {
		id: input.id,
		// Trim so a whitespace-only name can't slip past the schema's `min(1)`.
		brand: input.brand.trim(),
		name: input.name.trim(),
		widthCm: input.widthCm,
		heightCm: input.heightCm,
		image,
		imageSource: "static" as const,
		source: input.source ?? ("placeholder" as SourceTag),
	};

	if (input.kind === "board") {
		const result = CatalogBoardSchema.safeParse(base);
		if (!result.success) {
			throw new Error(
				`draft board invalid: ${result.error.issues[0]?.message}`,
			);
		}
		return result.data;
	}

	const result = CatalogPedalSchema.safeParse({
		...base,
		effectTypes: [],
		category: input.category ?? "pedal",
		...(input.variantOf ? { variantOf: input.variantOf } : {}),
	});
	if (!result.success) {
		throw new Error(`draft pedal invalid: ${result.error.issues[0]?.message}`);
	}
	return result.data;
}
