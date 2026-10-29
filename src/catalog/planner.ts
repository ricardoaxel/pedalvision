import { registerCatalogPedals } from "../state/scene";
import { catalog } from "./load";
import type { CatalogPedal } from "./schema";

const DATA_URL = `${import.meta.env.BASE_URL}catalog/planner-pedals.json`;

let pending: Promise<void> | null = null;

function isPedal(value: unknown): value is CatalogPedal {
	if (typeof value !== "object" || value === null) return false;
	const row = value as Record<string, unknown>;
	return (
		typeof row.id === "string" &&
		typeof row.brand === "string" &&
		typeof row.name === "string" &&
		typeof row.widthCm === "number" &&
		typeof row.heightCm === "number" &&
		typeof row.image === "string" &&
		row.imageSource === "static" &&
		row.category === "pedal" &&
		Array.isArray(row.effectTypes) &&
		typeof row.source === "string"
	);
}

/** Load the bulk planner overlay once; fail soft to the curated catalog. */
export function loadPlannerCatalog(): Promise<void> {
	if (pending) return pending;
	pending = (async () => {
		try {
			const response = await fetch(DATA_URL);
			if (!response.ok) return;
			const rows = (await response.json()) as unknown;
			if (!Array.isArray(rows)) return;
			const known = new Set(catalog.pedals.map((pedal) => pedal.id));
			const add = rows.filter(isPedal).filter((pedal) => !known.has(pedal.id));
			if (add.length === 0) return;
			catalog.pedals.push(...add);
			registerCatalogPedals(add);
		} catch {
			// The curated catalog remains usable when the overlay is unavailable.
		}
	})();
	return pending;
}
