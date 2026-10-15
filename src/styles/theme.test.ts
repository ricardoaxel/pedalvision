import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
	CANVAS_THEME_VARS,
	type CanvasTheme,
	canvasTheme,
	GRID_DOT_RADIUS,
	GRID_PITCH,
	lightCanvasTheme,
} from "./theme";

const tokensCss = readFileSync(
	new URL("./tokens.css", import.meta.url),
	"utf8",
);

// Minimal regex parse of tokens.css — sufficient because the file is a flat
// list of custom properties. A real CSS parser would be a new dependency (against
// the minimal-deps rule), so this is the deliberate tradeoff. Boundary: if the
// scopes ever contain nested at-rules (@media/@supports), this must be revisited.
function extractVars(css: string, selector: string): Record<string, string> {
	const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const block = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
	if (!block) {
		throw new Error(`Selector "${selector}" not found in tokens.css`);
	}
	const body = block[1].replace(/\/\*.*?\*\//g, "");
	const vars: Record<string, string> = {};
	for (const declaration of body.split(";")) {
		const separator = declaration.indexOf(":");
		if (separator === -1) continue;
		const name = declaration.slice(0, separator).trim();
		const value = declaration.slice(separator + 1).trim();
		if (name.startsWith("--") && value) {
			vars[name] = value;
		}
	}
	return vars;
}

const darkVars = extractVars(tokensCss, ":root");
const lightVars = extractVars(tokensCss, '[data-theme="light"]');

function expectInSync(theme: CanvasTheme, vars: Record<string, string>): void {
	for (const key of Object.keys(
		CANVAS_THEME_VARS,
	) as (keyof typeof CANVAS_THEME_VARS)[]) {
		const tokenName = CANVAS_THEME_VARS[key];
		expect(
			vars[tokenName],
			`${tokenName} missing from tokens.css`,
		).toBeDefined();
		expect(theme[key], `${key} out of sync with ${tokenName}`).toBe(
			vars[tokenName],
		);
	}
}

describe("canvas theme map", () => {
	it("dark theme values match :root tokens", () => {
		expectInSync(canvasTheme, darkVars);
	});

	it("light theme values match [data-theme='light'] tokens", () => {
		expectInSync(lightCanvasTheme, lightVars);
	});

	it("grid metrics mirror the dot-grid tokens", () => {
		expect(`${GRID_PITCH}px`).toBe(darkVars["--grid-pitch"]);
		expect(`${GRID_DOT_RADIUS}px`).toBe(darkVars["--grid-dot-radius"]);
	});
});
