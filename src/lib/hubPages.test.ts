import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * F-41: the docs/legal pages are static HTML because the app has no router and
 * the hub must work without JS. These checks keep the duplicated shell and the
 * mirrored visual tokens from drifting.
 */

const ROUTES: { slug: string; nav: string; heading: string }[] = JSON.parse(
	readFileSync(resolve(process.cwd(), "public/hub/routes.json"), "utf8"),
);
const SLUGS = ROUTES.map((route) => route.slug);

const read = (path: string) =>
	readFileSync(resolve(process.cwd(), path), "utf8");

const page = (slug: string) => read(`public/${slug}/index.html`);

function block(html: string, name: string): string {
	const match = html.match(
		new RegExp(
			`<!-- hub-${name}:start -->([\\s\\S]*?)<!-- hub-${name}:end -->`,
		),
	);
	if (!match) throw new Error(`missing ${name} block`);
	return match[1].trim();
}

function cssBlock(css: string, selector: string): string {
	const start = css.indexOf(`${selector} {`);
	if (start < 0) throw new Error(`missing ${selector}`);
	const open = css.indexOf("{", start);
	let depth = 0;
	for (let index = open; index < css.length; index += 1) {
		if (css[index] === "{") depth += 1;
		if (css[index] === "}") {
			depth -= 1;
			if (depth === 0) return css.slice(open + 1, index);
		}
	}
	throw new Error(`unbalanced ${selector}`);
}

function vars(css: string, selector: string): Record<string, string> {
	const out: Record<string, string> = {};
	for (const match of cssBlock(css, selector).matchAll(
		/--([\w-]+):\s*([^;]+);/g,
	)) {
		out[match[1]] = match[2].replace(/\s+/g, " ").trim();
	}
	return out;
}

const tokenCss = read("src/styles/tokens.css");
const hubCss = read("public/hub/hub.css");

describe("docs/legal hub pages", () => {
	it("ships every route with a shared shell", () => {
		const navs = new Set<string>();
		const footers = new Set<string>();
		const discovered = readdirSync(resolve(process.cwd(), "public"), {
			withFileTypes: true,
		})
			.filter(
				(entry) =>
					entry.isDirectory() &&
					existsSync(
						resolve(process.cwd(), "public", entry.name, "index.html"),
					),
			)
			.map((entry) => entry.name)
			.sort();
		expect(discovered).toEqual([...SLUGS].sort());

		for (const slug of SLUGS) {
			const html = page(slug);
			expect(html).toContain('href="/hub/hub.css"');
			expect(html).toContain('src="/hub/hub.js"');
			expect(html).toContain('id="main"');
			expect(html).toContain("<h1>");
			expect(html).toContain('<html lang="en"');
			for (const slug of SLUGS) {
				expect(html).toContain(`href="/${slug}"`);
			}
			expect(html).not.toContain("imageProvenance");
			expect(html).not.toContain("/pedal-assets/");

			navs.add(block(html, "nav").replace(/\s*aria-current="page"/g, ""));
			footers.add(block(html, "footer"));
		}

		expect(navs.size).toBe(1);
		expect(footers.size).toBe(1);
	});

	it("mirrors the app's visual tokens exactly", () => {
		const appDark = vars(tokenCss, ":root");
		const appLight = vars(tokenCss, '[data-theme="light"]');
		const hubDark = vars(hubCss, ":root");
		const hubLight = vars(hubCss, '[data-theme="light"]');

		for (const [name, value] of Object.entries(hubDark)) {
			expect(appDark[name], `dark --${name}`).toBe(value);
		}
		for (const [name, value] of Object.entries(hubLight)) {
			expect(appLight[name], `light --${name}`).toBe(value);
		}
	});
});
