/*
 * Canvas theme map (N1).
 *
 * Konva shapes cannot read CSS custom properties, so the canvas-relevant
 * token values are mirrored here as plain JS. `CANVAS_THEME_VARS` maps each
 * key to the token name in src/styles/tokens.css; theme.test.ts asserts the
 * literals stay in sync with both the :root (dark) and light scopes.
 *
 * Values track the "Blueprint — Baseline + body/button face" version.
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
	gridDot: "#16202e",
	canvasBackground: "#070b12",
	selection: "#66c9de",
	selectionStrong: "#3aa9c2",
	cable: "#b9cbd8",
};

/** Light theme (matches [data-theme="light"] in tokens.css). */
export const lightCanvasTheme: CanvasTheme = {
	gridDot: "#d8e2ea",
	canvasBackground: "#f2f6f9",
	selection: "#167089",
	selectionStrong: "#14677e",
	cable: "#2f4250",
};
