/**
 * Planner/Pedalplayground URL recognition (P5 image policy).
 *
 * A single helper shared by the image-provenance gate and the asset ledger so
 * the two checks cannot drift. Planner assets are served from the planner host
 * and from the project's official GitHub mirror; near-miss repos that merely
 * contain the word in a path are NOT planner URLs.
 */

const PLANNER_HOST = "pedalplayground.com";

export function isPlannerUrl(url: string | undefined): boolean {
	if (!url) return false;
	try {
		const parsed = new URL(url);
		const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
		if (host === PLANNER_HOST || host.endsWith(`.${PLANNER_HOST}`)) {
			return true;
		}
		if (host === "github.com" || host === "raw.githubusercontent.com") {
			const parts = parsed.pathname.split("/").filter(Boolean);
			return (
				parts.length >= 2 &&
				parts[0]?.toLowerCase() === "pedalplayground" &&
				parts[1]?.toLowerCase() === "pedalplayground"
			);
		}
		return false;
	} catch {
		return false;
	}
}
