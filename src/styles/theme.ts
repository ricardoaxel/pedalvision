/*
 * Canvas theme map (N1).
 *
 * Konva shapes cannot read CSS custom properties, so the canvas-relevant
 * token values are mirrored here as plain JS. `CANVAS_THEME_VARS` maps each
 * key to the token name in src/styles/tokens.css; theme.test.ts asserts the
 * literals stay in sync with both the :root (dark) and light scopes.
 *
 * Values track the "Blueprint" direction (Draft 2, designer⇄reviewer loop).
 */

export const CANVAS_THEME_VARS = {
	gridDot: "--color-grid-dot",
	canvasBackground: "--color-canvas-bg",
	selection: "--color-accent",
	selectionStrong: "--color-accent-strong",
	cable: "--color-cable",
	// Board fallback (image missing/failed) + dimension labels — P1-03.
	boardStroke: "--color-board-outline",
	boardDraftFill: "--color-board-draft-fill",
	boardLabel: "--color-ink-muted",
	// Lift shadow under a dragged pedal — P1-04.
	itemShadow: "--color-item-shadow",
	// Always-on pedal name-label chip — P2-01 (Specimen Bench).
	itemLabelBg: "--color-item-label-bg",
	itemLabelInk: "--color-item-label-ink",
	// Desktop hover brackets on a non-selected pedal — neutral ink (P2-01).
	hoverOutline: "--color-ink",
} as const;

/**
 * Canvas font stacks mirrored from tokens.css (`--font-sans` / `--font-mono`).
 * Konva `Text` can't read CSS variables, so the measurement voice (mono) and
 * the content voice (sans) are mirrored here; theme.test.ts asserts they stay in
 * sync (whitespace-normalised).
 */
export const CANVAS_FONTS = {
	sans: '"Avenir Next", "Segoe UI", system-ui, Roboto, "Helvetica Neue", Arial, sans-serif',
	mono: 'ui-monospace, "SF Mono", SFMono-Regular, "Cascadia Mono", Menlo, Consolas, monospace',
} as const;

/**
 * Dot-grid metrics mirrored from tokens.css (`--grid-pitch` /
 * `--grid-dot-radius`). `GRID_PITCH` is the base dot spacing in screen px at
 * zoom 1; theme.test.ts asserts the mirror stays in sync with the tokens.
 */
export const GRID_PITCH = 24;
export const GRID_DOT_RADIUS = 1;

/**
 * Canvas pedal name-label metrics (screen px — counter-scaled at render so the
 * label stays a constant size at any zoom). The chip is hidden below
 * `minWidthPx` (a name would be ellipsis soup) and fades to full opacity above
 * `fullOpacityWidthPx`; hovered/selected items are always full opacity.
 */
export const ITEM_LABEL = {
	fontSizePx: 10,
	heightPx: 14,
	insetPx: 2,
	opacity: 0.9,
	minWidthPx: 52,
	fullOpacityWidthPx: 80,
} as const;

export type CanvasThemeKey = keyof typeof CANVAS_THEME_VARS;

export type CanvasTheme = Record<CanvasThemeKey, string>;

/** Default theme (matches :root in tokens.css). */
export const canvasTheme: CanvasTheme = {
	gridDot: "#43484f",
	canvasBackground: "#191a1c",
	selection: "#66c9de",
	selectionStrong: "#66c9de",
	cable: "#b9c2cc",
	boardStroke: "#5f6a76",
	boardDraftFill: "#202327",
	boardLabel: "#a8b0b8",
	itemShadow: "rgb(0 0 0 / 0.5)",
	itemLabelBg: "#1b1e21",
	itemLabelInk: "#eef1f4",
	hoverOutline: "#eef1f4",
};

/** Light theme (matches [data-theme="light"] in tokens.css). */
export const lightCanvasTheme: CanvasTheme = {
	gridDot: "#a2abb5",
	canvasBackground: "#e4e7ea",
	selection: "#006b82",
	selectionStrong: "#006b82",
	cable: "#4d565f",
	boardStroke: "#6b7580",
	boardDraftFill: "#eceff1",
	boardLabel: "#565d66",
	itemShadow: "rgb(15 23 42 / 0.32)",
	itemLabelBg: "#f4f6f7",
	itemLabelInk: "#16191d",
	hoverOutline: "#16191d",
};
