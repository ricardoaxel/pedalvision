import { defineConfig } from "@playwright/test";

export default defineConfig({
	testDir: "./e2e",
	use: {
		baseURL: "http://localhost:4174",
	},
	projects: [
		{
			name: "chromium",
			use: { browserName: "chromium" },
		},
	],
	webServer: {
		command: "pnpm preview",
		url: "http://localhost:4174",
		reuseExistingServer: !process.env.CI,
	},
});
