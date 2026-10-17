import { bustCache } from "../lib/cdn";

/**
 * Load an image cross-origin, self-healing a poisoned HTTP cache once.
 *
 * Always loads with `crossOrigin="anonymous"` (so the canvas stays untainted for
 * export). On failure it retries **once** under a distinct cache key
 * ({@link bustCache}) — a plain no-CORS load can have cached a response without
 * `Access-Control-Allow-Origin`, which the CORS request would otherwise reuse and
 * reject; the busted URL is a fresh, CORS-clean fetch. Rejects if both fail.
 *
 * Extracted from the React hook so the retry is unit-testable with a stubbed
 * `Image`.
 */
export function loadImageWithHeal(src: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const attempt = (url: string, retried: boolean) => {
			const image = new Image();
			image.crossOrigin = "anonymous";
			image.onload = () => resolve(image);
			image.onerror = () => {
				const busted = bustCache(url);
				if (!retried && busted !== url) {
					attempt(busted, true);
					return;
				}
				reject(new Error(`image failed to load: ${src}`));
			};
			image.src = url;
		};
		attempt(src, false);
	});
}
