import { usePlannerCatalog } from "../state/plannerCatalog";
import { registerCatalogPedals } from "../state/scene";
import { catalog } from "./load";
import { type CatalogPedal, EFFECT_TYPES, ID_PATTERN } from "./schema";

const DATA_URL = `${import.meta.env.BASE_URL}catalog/planner-pedals.json`;
const AVIF = /^[a-z0-9]+(?:-[a-z0-9]+)*\.avif$/;
const EFFECT_SET = new Set<string>(EFFECT_TYPES);
const plannerIds = new Set<string>();

let pending: Promise<void> | null = null;

export function isPlannerPedal(id: string): boolean {
	return plannerIds.has(id);
}

function isPedal(value: unknown): value is CatalogPedal {
	if (typeof value !== "object" || value === null) return false;
	const row = value as Record<string, unknown>;
	if (typeof row.id !== "string" || !ID_PATTERN.test(row.id)) return false;
	if (typeof row.brand !== "string" || row.brand.trim().length === 0)
		return false;
	if (typeof row.name !== "string" || row.name.trim().length === 0)
		return false;
	if (typeof row.widthCm !== "number" || !Number.isFinite(row.widthCm)) {
		return false;
	}
	if (typeof row.heightCm !== "number" || !Number.isFinite(row.heightCm)) {
		return false;
	}
	if (row.widthCm <= 0 || row.heightCm <= 0) return false;
	if (typeof row.image !== "string" || !AVIF.test(row.image)) return false;
	if (row.imageSource !== "static" || row.category !== "pedal") return false;
	if (!Array.isArray(row.effectTypes) || row.effectTypes.length === 0) {
		return false;
	}
	if (
		!row.effectTypes.every(
			(type) => typeof type === "string" && EFFECT_SET.has(type),
		)
	) {
		return false;
	}
	return typeof row.source === "string";
}

/** Load the bulk planner overlay once; fail soft to the curated catalog. */
export function loadPlannerCatalog(): Promise<void> {
	if (pending) return pending;
	pending = (async () => {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 5000);
		try {
			const response = await fetch(DATA_URL, { signal: controller.signal });
			if (!response.ok) return;
			const rows = (await response.json()) as unknown;
			if (!Array.isArray(rows)) return;
			const known = new Set(catalog.pedals.map((pedal) => pedal.id));
			const add = rows.filter(isPedal).filter((pedal) => !known.has(pedal.id));
			if (add.length === 0) return;
			for (const pedal of add) plannerIds.add(pedal.id);
			catalog.pedals.push(...add);
			registerCatalogPedals(add);
			usePlannerCatalog.getState().bump();
		} catch {
			// The curated catalog remains usable when the overlay is unavailable.
		} finally {
			clearTimeout(timeout);
		}
	})();
	return pending;
}
