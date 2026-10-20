import { defineConfig } from "@playwright/test";

/**
 * Report-only capacity benchmark (P3-06). NOT part of the CI e2e run: it seeds
 * 400-item / 50-scene libraries and exports multi-MB PNGs, so it runs manually
 * via `pnpm bench:capacity` (which builds first). No ms thresholds are asserted
 * — the table is the deliverable, and flaky timing gates are deliberately
 * avoided.
 */
export default defineConfig({
	testDir: "./e2e",
	testMatch: /benchmark\.spec\.ts/,
	timeout: 300_000,
	workers: 1,
	fullyParallel: false,
	use: {
		baseURL: "http://localhost:4174",
	},
	webServer: {
		command: "pnpm preview",
		url: "http://localhost:4174",
		reuseExistingServer: !process.env.CI,
	},
});
