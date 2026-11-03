/// <reference types="vitest/config" />
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const HUB_ROUTES: string[] = JSON.parse(
	readFileSync(resolve("public/hub/routes.json"), "utf8"),
).map((entry: { slug: string }) => entry.slug);

/**
 * Cloudflare Pages resolves `/privacy` to `privacy/index.html`; Vite's SPA
 * preview does not. This dev/preview-only rewrite keeps the local E2E and the
 * PR preview honest. No effect on the production build.
 */
function hubCleanUrls(): Plugin {
	const rewrite = (url: string | undefined): string | undefined => {
		if (!url) return url;
		const [pathname, query] = url.split("?");
		const slug = pathname.replace(/^\//, "").replace(/\/$/, "");
		if (!HUB_ROUTES.includes(slug)) return url;
		const exists =
			existsSync(resolve("public", slug, "index.html")) ||
			existsSync(resolve("dist", slug, "index.html"));
		return exists ? `/${slug}/index.html${query ? `?${query}` : ""}` : url;
	};

	return {
		name: "hub-clean-urls",
		configureServer(server) {
			server.middlewares.use((req, _res, next) => {
				req.url = rewrite(req.url);
				next();
			});
		},
		configurePreviewServer(server) {
			server.middlewares.use((req, _res, next) => {
				req.url = rewrite(req.url);
				next();
			});
		},
	};
}

// https://vite.dev/config/
export default defineConfig({
	plugins: [react(), hubCleanUrls()],
	preview: {
		port: 4174,
		strictPort: true,
	},
	test: {
		exclude: [
			"e2e/**",
			"**/node_modules/**",
			"**/dist/**",
			"**/cypress/**",
			"**/.{idea,git,cache,output,temp}/**",
			"**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build,eslint,prettier}.config.*",
		],
	},
});
