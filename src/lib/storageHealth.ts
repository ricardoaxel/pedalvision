import { resolveStorage } from "./storage";

/**
 * Storage health for the P3-05 fallback (F8). Boot probes IndexedDB
 * availability, `localStorage` usability and the browser's storage estimate;
 * the pure classifier turns that into one state the UI can render. Runtime
 * write failures upgrade the same state instead of adding try/catch in the UI.
 */
export interface StorageEstimate {
	usage: number;
	quota: number;
}

/** What the browser probe learned at boot. */
export interface StorageProbe {
	/** `openSceneRepository()` resolved (the DB opened). */
	indexedDb: boolean;
	/** A throwaway `localStorage` write + read + remove succeeded. */
	localStorage: boolean;
	/** `navigator.storage.estimate()` result, or null when unavailable. */
	estimate: StorageEstimate | null;
}

export type StorageHealthLevel = "ok" | "low-quota" | "unavailable";

export type StorageHealthReason =
	| "ok"
	| "indexeddb"
	| "local-storage"
	| "read"
	| "write"
	| "quota";

export interface StorageHealth {
	level: StorageHealthLevel;
	reason: StorageHealthReason;
	usageBytes: number | null;
	quotaBytes: number | null;
	/** usage / quota, or null when the estimate is unavailable. */
	usageRatio: number | null;
}

/** Advisory threshold: the browser says the origin is almost full. */
export const LOW_QUOTA_RATIO = 0.9;

/**
 * The quota probe is advisory and must never gate first render indefinitely:
 * a slow/hung `estimate()` becomes "unknown" (no warning).
 */
export const ESTIMATE_TIMEOUT_MS = 250;

/** A healthy, estimate-less state (used before boot finishes). */
export function healthyStorageHealth(): StorageHealth {
	return {
		level: "ok",
		reason: "ok",
		usageBytes: null,
		quotaBytes: null,
		usageRatio: null,
	};
}

function normalizeEstimate(
	estimate: StorageEstimate | null | undefined,
): StorageEstimate | null {
	if (!estimate) return null;
	const { usage, quota } = estimate;
	if (!Number.isFinite(usage) || usage < 0) return null;
	if (!Number.isFinite(quota) || quota <= 0) return null;
	return { usage, quota };
}

function withEstimate(
	health: Omit<StorageHealth, "usageBytes" | "quotaBytes" | "usageRatio">,
	estimate: StorageEstimate | null,
): StorageHealth {
	return {
		...health,
		usageBytes: estimate?.usage ?? null,
		quotaBytes: estimate?.quota ?? null,
		usageRatio: estimate ? estimate.usage / estimate.quota : null,
	};
}

/**
 * Classify a boot probe. An estimate that is missing, non-finite or has a
 * `quota <= 0` is treated as "unknown" — it must never produce a warning.
 */
export function classifyStorageHealth(probe: StorageProbe): StorageHealth {
	const estimate = normalizeEstimate(probe.estimate);
	if (!probe.indexedDb) {
		return withEstimate(
			{ level: "unavailable", reason: "indexeddb" },
			estimate,
		);
	}
	if (!probe.localStorage) {
		return withEstimate(
			{ level: "unavailable", reason: "local-storage" },
			estimate,
		);
	}
	if (estimate && estimate.usage / estimate.quota >= LOW_QUOTA_RATIO) {
		return withEstimate({ level: "low-quota", reason: "quota" }, estimate);
	}
	return withEstimate({ level: "ok", reason: "ok" }, estimate);
}

/** Upgrade a health state after a runtime read/write failure. */
export function withStorageFailure(
	health: StorageHealth,
	reason: Extract<
		StorageHealthReason,
		"indexeddb" | "local-storage" | "read" | "write"
	>,
): StorageHealth {
	if (health.level === "unavailable") return health;
	return { ...health, level: "unavailable", reason };
}

function probeLocalStorage(storage: Storage | null): boolean {
	if (!storage) return false;
	const key = "pedalvision.storage-probe";
	try {
		storage.setItem(key, "1");
		const usable = storage.getItem(key) === "1";
		storage.removeItem(key);
		return usable;
	} catch {
		return false;
	}
}

function withTimeout(
	estimate: Promise<StorageEstimate | null>,
): Promise<StorageEstimate | null> {
	return new Promise((resolve) => {
		const timer = setTimeout(() => resolve(null), ESTIMATE_TIMEOUT_MS);
		estimate.then(
			(value) => {
				clearTimeout(timer);
				resolve(value);
			},
			() => {
				clearTimeout(timer);
				resolve(null);
			},
		);
	});
}

/**
 * Start the advisory estimate probe (never rejects). Call it **before** the
 * (slower) IndexedDB open so both run concurrently; boot only awaits the
 * (bounded) result. Exported so `persist.ts` can start it immediately.
 */
export function readStorageEstimate(): Promise<StorageEstimate | null> {
	try {
		const storage =
			typeof navigator === "undefined" ? undefined : navigator.storage;
		if (!storage?.estimate) return Promise.resolve(null);
		return withTimeout(
			storage.estimate().then((estimate) => ({
				usage: estimate.usage ?? 0,
				quota: estimate.quota ?? 0,
			})),
		);
	} catch {
		return Promise.resolve(null);
	}
}

export interface StorageProbeDeps {
	/** Whether the scene repository opened successfully. */
	indexedDbAvailable: boolean;
	/** Explicit store (tests); omitted → the boot-resolved `localStorage`. */
	storage?: Storage | null;
	/** Explicit estimate source (tests); omitted → `navigator.storage.estimate`. */
	estimate?: () => Promise<StorageEstimate | null>;
}

/**
 * Browser adapter for the boot probe. Never throws: a blocked/failed probe is
 * part of the classified state.
 */
export async function probeStorage(
	deps: StorageProbeDeps,
): Promise<StorageProbe> {
	let estimate: StorageEstimate | null = null;
	try {
		const read = deps.estimate ?? readStorageEstimate;
		estimate = normalizeEstimate(await read());
	} catch {
		estimate = null;
	}
	return {
		indexedDb: deps.indexedDbAvailable,
		localStorage: probeLocalStorage(
			deps.storage === undefined ? resolveStorage() : deps.storage,
		),
		estimate,
	};
}
