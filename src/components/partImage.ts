import { useState } from "react";
import { bustCache } from "../lib/cdn";

/**
 * The CORS-first image-loading ladder shared by the picker thumbnails and the
 * P2-03 info-panel preview (ADR-003 §Brand image URLs, P2-01 self-heal).
 *
 * A plain no-CORS load of a hotlinked `url` image caches a response with no
 * `Access-Control-Allow-Origin`, which then poisons the canvas's later
 * `crossOrigin` request for hosts that only send ACAO when the request carries
 * an `Origin`. Loading **CORS-first** stores a clean cache entry; on failure we
 * retry once under a **distinct cache key** ({@link bustCache}) to self-heal a
 * poisoned entry, then fall back to a **no-CORS** display for hosts that send no
 * ACAO at all (DOM only — the canvas keeps its own CORS-only loader).
 */
export type PartImagePhase = "cors" | "cors-bust" | "nocors" | "failed";

export interface PartImageState {
	phase: PartImagePhase;
	/** The URL to render for the current phase (busted in `cors-bust`). */
	url: string;
	/** `"anonymous"` for the CORS-first attempts, `undefined` for no-CORS. */
	crossOrigin: "anonymous" | undefined;
	/** Advance the ladder (`cors → cors-bust → nocors → failed`). */
	onError: () => void;
}

export function usePartImage(src: string): PartImageState {
	// Scoped to the current `src`, so a failed image never suppresses a later
	// valid one as the selected part changes.
	const [attempt, setAttempt] = useState<{
		src: string;
		phase: PartImagePhase;
	}>({ src, phase: "cors" });
	// A part with no image (custom/unknown) passes ""; return a neutral failed
	// state without running the ladder.
	if (src === "") {
		return {
			phase: "failed",
			url: "",
			crossOrigin: undefined,
			onError: () => {},
		};
	}
	const phase: PartImagePhase = attempt.src === src ? attempt.phase : "cors";
	const busted = bustCache(src);
	const bustable = busted !== src;
	const nextPhase = (current: PartImagePhase): PartImagePhase =>
		current === "cors"
			? bustable
				? "cors-bust"
				: "nocors"
			: current === "cors-bust"
				? "nocors"
				: "failed";
	const onError = () =>
		setAttempt((current) => ({
			src,
			phase: nextPhase(current.src === src ? current.phase : "cors"),
		}));
	return {
		phase,
		url: phase === "cors-bust" ? busted : src,
		crossOrigin:
			phase === "cors" || phase === "cors-bust" ? "anonymous" : undefined,
		onError,
	};
}
