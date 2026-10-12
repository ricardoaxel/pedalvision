/*
 * Canvas theme map (N1).
 *
 * Konva shapes cannot read CSS custom properties, so the canvas-relevant
 * token values are mirrored here as plain JS. `CANVAS_THEME_VARS` maps each
 * key to the token name in src/styles/tokens.css; theme.test.ts asserts the
 * literals stay in sync with both the :root (dark) and light scopes.
 */

export const CANVAS_THEME_VARS = {
	gridDot: "--color-grid-dot",
	canvasBackground: "--color-canvas-bg",
	selection: "--color-accent",
	selectionStrong: "--color-accent-strong",
	cable: "--color-cable",
} as const;

export type CanvasThemeKey = keyof typeof CANVAS_THEME_VARS;

export type CanvasTheme = Record<CanvasThemeKey, string>;

/** Default theme (matches :root in tokens.css). */
export const canvasTheme: CanvasTheme = {
	gridDot: "#2f343d",
	canvasBackground: "#14161a",
	selection: "#f0a020",
	selectionStrong: "#ffb63d",
	cable: "#c8ccd4",
};

/** Light theme (matches [data-theme="light"] in tokens.css). */
export const lightCanvasTheme: CanvasTheme = {
	gridDot: "#c8ccd4",
	canvasBackground: "#f5f6f8",
	selection: "#b26b00",
	selectionStrong: "#8a5300",
	cable: "#4a4f59",
};
