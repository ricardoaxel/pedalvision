import { useEffect, useState } from "react";
import { clearImageStatus, reportImageStatus } from "./imageStatus";
import { loadImageWithHeal } from "./loadImage";

export type ImageStatus = "loading" | "loaded" | "failed";

export interface UseImageResult {
	image: HTMLImageElement | null;
	status: ImageStatus;
}

/**
 * Load an image for a Konva `Image` node (design.md §Canvas architecture).
 *
 * `key` is a stable identity (the item/board uid) used to report load status to
 * the `imageStatus` registry — keyed by identity, not `src`, so duplicates and
 * removals are counted correctly. Reports are pruned on unmount. Load logic
 * (including the cache-poisoning self-heal) lives in {@link loadImageWithHeal}.
 *
 * Returns `{ image, status }`: `image` is set only once `status === "loaded"`; a
 * null/empty `src` or a load error yields `"failed"` so the caller can render a
 * fallback.
 */
export function useImage(
	src: string | null | undefined,
	key?: string,
): UseImageResult {
	const [result, setResult] = useState<UseImageResult>({
		image: null,
		status: src ? "loading" : "failed",
	});

	const identity = key ?? src ?? "";

	useEffect(() => {
		if (!src) {
			setResult({ image: null, status: "failed" });
			return;
		}

		let cancelled = false;
		setResult({ image: null, status: "loading" });
		reportImageStatus(identity, "loading");

		loadImageWithHeal(src)
			.then((image) => {
				if (cancelled) return;
				setResult({ image, status: "loaded" });
				reportImageStatus(identity, "loaded");
			})
			.catch(() => {
				if (cancelled) return;
				setResult({ image: null, status: "failed" });
				reportImageStatus(identity, "failed");
			});

		return () => {
			cancelled = true;
			clearImageStatus(identity);
		};
	}, [src, identity]);

	return result;
}
