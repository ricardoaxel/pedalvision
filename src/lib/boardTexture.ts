/**
 * Custom-board surface finishes (P2-05, "Substrate").
 *
 * A custom board renders its surface as one of a small, fixed set of named
 * finishes. The set lives here as plain data (no imports) so the scene, the
 * persistence guards, the canvas theme map, and the DOM creator can all share
 * it without a dependency cycle. The actual colours/patterns are tokens
 * (`src/styles/tokens.css`) mirrored for the canvas in `src/styles/theme.ts`;
 * this module only names the choices.
 */

/** The selectable board finishes, in creator display order. */
export const BOARD_TEXTURES = ["matte", "brushed", "wood", "tolex"] as const;

export type BoardTexture = (typeof BOARD_TEXTURES)[number];

/** The default finish (a flat painted board) — never an empty choice. */
export const DEFAULT_BOARD_TEXTURE: BoardTexture = "matte";

const BOARD_TEXTURE_LABELS: Record<BoardTexture, string> = {
	matte: "Matte",
	brushed: "Brushed",
	wood: "Wood",
	tolex: "Tolex",
};

/** Human label for a finish ("matte" → "Matte"). */
export function boardTextureLabel(texture: BoardTexture): string {
	return BOARD_TEXTURE_LABELS[texture];
}

/** Is `value` one of the known finishes? */
export function isBoardTexture(value: unknown): value is BoardTexture {
	return (
		typeof value === "string" &&
		(BOARD_TEXTURES as readonly string[]).includes(value)
	);
}
