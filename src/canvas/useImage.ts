import { useEffect, useState } from "react";
import { bustCache } from "../lib/cdn";
import { reportImageStatus } from "./imageStatus";

export type ImageStatus = "loading" | "loaded" | "failed";

export interface UseImageResult {
	image: HTMLImageElement | null;
	status: ImageStatus;
}

/**
 * Load an image for a Konva `Image` node. A tiny local hook — deliberately not
 * the `use-image` package (minimal-deps rule: no new dependency for ~20 lines).
 *
 * Returns `{ image, status }`: `image` is set only once `status === "loaded"`.
 * A null/empty `src` or a load error yields `status: "failed"` so the caller
 * can render a fallback (the labeled rectangle at the cm footprint).
 *
 * The load is `crossOrigin="anonymous"` so the canvas stays untainted for
 * export. If that CORS load fails, it **self-heals once** by retrying under a
 * distinct cache key ({@link bustCache}): a plain no-CORS load can have cached a
 * response without `Access-Control-Allow-Origin`, which the CORS request would
 * otherwise reuse and reject (P2-01 CE-20 bug). The second attempt fetches a
 * fresh, CORS-clean response; both stay `crossOrigin` so export is unaffected.
 */
export function useImage(src: string | null | undefined): UseImageResult {
	const [result, setResult] = useState<UseImageResult>({
		image: null,
		status: src ? "loading" : "failed",
	});

	useEffect(() => {
		if (!src) {
			setResult({ image: null, status: "failed" });
			return;
		}

		let cancelled = false;
		setResult({ image: null, status: "loading" });
		reportImageStatus(src, "loading");

		let retried = false;
		const load = (url: string) => {
			const image = new window.Image();
			// Same-origin/CORS-clean images keep the canvas untainted for export.
			image.crossOrigin = "anonymous";
			image.onload = () => {
				if (cancelled) return;
				setResult({ image, status: "loaded" });
				reportImageStatus(src, "loaded");
			};
			image.onerror = () => {
				if (cancelled) return;
				const busted = bustCache(url);
				// One self-heal retry, only when a distinct cache key exists.
				if (!retried && busted !== url) {
					retried = true;
					load(busted);
					return;
				}
				setResult({ image: null, status: "failed" });
				reportImageStatus(src, "failed");
			};
			image.src = url;
		};
		load(src);

		return () => {
			cancelled = true;
		};
	}, [src]);

	return result;
}
