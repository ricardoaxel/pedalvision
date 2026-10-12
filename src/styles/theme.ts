/*
 * Canvas theme map (N1).
 *
 * Konva shapes cannot read CSS custom properties, so the canvas-relevant
 * token values are mirrored here as plain JS. `CANVAS_THEME_VARS` maps each
 * key to the token name in src/styles/tokens.css; theme.test.ts asserts the
 * literals stay in sync with both the :root (dark) and light scopes.
 *
 * Values track the "Studio Clay" direction (ADR-005, owner-approved).
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
	gridDot: "#2e2a26",
	canvasBackground: "#171614",
	selection: "#c77b5a",
	selectionStrong: "#d9895f",
	cable: "#d8d2cb",
};

/** Light theme (matches [data-theme="light"] in tokens.css). */
export const lightCanvasTheme: CanvasTheme = {
	gridDot: "#d9d3ca",
	canvasBackground: "#f4f1ed",
	selection: "#9e5230",
	selectionStrong: "#834327",
	cable: "#4a443d",
};
