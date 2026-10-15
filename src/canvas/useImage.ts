import { useEffect, useState } from "react";

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

		const image = new window.Image();
		// Same-origin/CORS-clean images keep the canvas untainted for export.
		image.crossOrigin = "anonymous";
		image.onload = () => {
			if (!cancelled) setResult({ image, status: "loaded" });
		};
		image.onerror = () => {
			if (!cancelled) setResult({ image: null, status: "failed" });
		};
		image.src = src;

		return () => {
			cancelled = true;
		};
	}, [src]);

	return result;
}
