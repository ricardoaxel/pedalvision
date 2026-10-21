import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	testDir: "./e2e",
	use: {
		baseURL: "http://localhost:4174",
	},
	projects: [
		{
			name: "chromium",
			use: { browserName: "chromium" },
			// Touch gestures need CDP + a touch-enabled context (see touch.spec.ts);
			// the capacity benchmark is report-only and runs via `pnpm bench:capacity`.
			testIgnore: /(touch|benchmark)\.spec\.ts/,
		},
		{
			// Chromium with a touch-enabled mobile context for the gesture specs
			// (and the picker's responsive/mobile coverage).
			name: "mobile-chromium",
			use: { ...devices["Pixel 7"] },
			testMatch:
				/(touch|picker|custom|info-panel|board-creator|first-run|export|scenes|capacity|share|history|storage-fallback)\.spec\.ts/,
		},
	],
	webServer: {
		command: "pnpm preview",
		url: "http://localhost:4174",
		reuseExistingServer: !process.env.CI,
	},
});
