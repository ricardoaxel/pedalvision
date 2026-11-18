import type { CatalogBoard, ImageSource } from "../catalog/schema";
import type { PlacedBoard } from "../state/scene";
import {
	type BoardTexture,
	boardTextureLabel,
	DEFAULT_BOARD_TEXTURE,
} from "./boardTexture";

/** What a selected board reads as in the "Title Block" readout (F-06). */
export interface BoardReadout {
	/** `catalog` when a catalog board resolved; `custom` for a user-made board. */
	kind: "catalog" | "custom";
	brand: string;
	name: string;
	widthCm: number;
	heightCm: number;
	/** Raw finish token for the custom-board sample; null for a catalog board. */
	texture: BoardTexture | null;
	/** Human finish label for a custom board; null for a catalog board. */
	finish: string | null;
	/** Catalog board image; custom boards render a finish sample instead. */
	image: { source: ImageSource; value: string } | null;
}

/**
 * Flatten a placed board into the readout's view model. Pure: the footprint is
 * passed in so this module never depends on the scene store at runtime.
 */
export function buildBoardReadout(
	board: PlacedBoard,
	definition: CatalogBoard | null,
	footprint: { widthCm: number; heightCm: number },
): BoardReadout {
	const custom = board.boardRefId === null;
	const typedName = board.name?.trim() ?? "";
	const typedBrand = board.brand?.trim() ?? "";
	const name =
		definition?.name ??
		(typedName ||
			(custom ? "Custom board" : board.boardRefId ? "Board" : "Custom board"));
	const brand = definition?.brand ?? typedBrand;
	return {
		kind: custom ? "custom" : "catalog",
		brand,
		name,
		widthCm: footprint.widthCm,
		heightCm: footprint.heightCm,
		texture: custom ? (board.texture ?? DEFAULT_BOARD_TEXTURE) : null,
		finish: custom
			? boardTextureLabel(board.texture ?? DEFAULT_BOARD_TEXTURE)
			: null,
		image: definition
			? { source: definition.imageSource, value: definition.image }
			: null,
	};
}
