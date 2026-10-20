import { describe, expect, it } from "vitest";
import {
	classifyStorageHealth,
	healthyStorageHealth,
	LOW_QUOTA_RATIO,
	probeStorage,
	type StorageProbe,
	withStorageFailure,
} from "./storageHealth";

function probe(overrides: Partial<StorageProbe> = {}): StorageProbe {
	return {
		indexedDb: true,
		localStorage: true,
		estimate: null,
		...overrides,
	};
}

function fakeStorage(options: { fail?: boolean } = {}): Storage {
	const map = new Map<string, string>();
	return {
		get length() {
			return map.size;
		},
		clear: () => map.clear(),
		getItem: (key) => map.get(key) ?? null,
		key: (index) => [...map.keys()][index] ?? null,
		removeItem: (key) => {
			map.delete(key);
		},
		setItem: (key, value) => {
			if (options.fail) throw new Error("blocked");
			map.set(key, value);
		},
	};
}

describe("storage health", () => {
	it("is ok with usable stores and no estimate", () => {
		expect(classifyStorageHealth(probe())).toEqual({
			level: "ok",
			reason: "ok",
			usageBytes: null,
			quotaBytes: null,
			usageRatio: null,
		});
	});

	it("is unavailable when IndexedDB is blocked", () => {
		const health = classifyStorageHealth(probe({ indexedDb: false }));
		expect(health.level).toBe("unavailable");
		expect(health.reason).toBe("indexeddb");
	});

	it("is unavailable when localStorage is blocked", () => {
		const health = classifyStorageHealth(probe({ localStorage: false }));
		expect(health.level).toBe("unavailable");
		expect(health.reason).toBe("local-storage");
	});

	it("prefers the IndexedDB reason when both stores are blocked", () => {
		const health = classifyStorageHealth(
			probe({ indexedDb: false, localStorage: false }),
		);
		expect(health.reason).toBe("indexeddb");
	});

	it("is a low-quota advisory at or above the threshold", () => {
		const atThreshold = classifyStorageHealth(
			probe({ estimate: { usage: 90, quota: 100 } }),
		);
		expect(atThreshold).toMatchObject({
			level: "low-quota",
			reason: "quota",
			usageBytes: 90,
			quotaBytes: 100,
			usageRatio: LOW_QUOTA_RATIO,
		});
		const over = classifyStorageHealth(
			probe({ estimate: { usage: 95, quota: 100 } }),
		);
		expect(over.level).toBe("low-quota");
	});

	it("does not warn just below the threshold", () => {
		const health = classifyStorageHealth(
			probe({ estimate: { usage: 89, quota: 100 } }),
		);
		expect(health).toMatchObject({
			level: "ok",
			reason: "ok",
			usageBytes: 89,
			quotaBytes: 100,
		});
	});

	it("never warns when the estimate is unusable", () => {
		expect(classifyStorageHealth(probe({ estimate: null })).level).toBe("ok");
		expect(
			classifyStorageHealth(probe({ estimate: { usage: 1, quota: 0 } })).level,
		).toBe("ok");
		expect(
			classifyStorageHealth(
				probe({ estimate: { usage: Number.NaN, quota: 100 } }),
			).level,
		).toBe("ok");
		expect(
			classifyStorageHealth(
				probe({ estimate: { usage: 10, quota: Number.POSITIVE_INFINITY } }),
			).level,
		).toBe("ok");
	});

	it("upgrades an ok state to a write failure and keeps the estimate", () => {
		const base = classifyStorageHealth(
			probe({ estimate: { usage: 10, quota: 100 } }),
		);
		const failed = withStorageFailure(base, "write");
		expect(failed).toMatchObject({
			level: "unavailable",
			reason: "write",
			usageBytes: 10,
			quotaBytes: 100,
		});
		expect(withStorageFailure(failed, "read")).toBe(failed);
	});

	it("healthyStorageHealth is a fresh estimate-less ok state", () => {
		expect(healthyStorageHealth()).toMatchObject({
			level: "ok",
			reason: "ok",
		});
	});

	it("probes localStorage with a throwaway key and reads the estimate", async () => {
		const storage = fakeStorage();
		const result = await probeStorage({
			indexedDbAvailable: true,
			storage,
			estimate: async () => ({ usage: 20, quota: 200 }),
		});
		expect(result).toEqual({
			indexedDb: true,
			localStorage: true,
			estimate: { usage: 20, quota: 200 },
		});
		expect(storage.getItem("pedalvision.storage-probe")).toBeNull();
	});

	it("treats a throwing localStorage as blocked", async () => {
		const result = await probeStorage({
			indexedDbAvailable: true,
			storage: fakeStorage({ fail: true }),
			estimate: async () => null,
		});
		expect(result.localStorage).toBe(false);
	});

	it("treats a rejecting or unusable estimate as unavailable without throwing", async () => {
		const rejecting = await probeStorage({
			indexedDbAvailable: true,
			storage: fakeStorage(),
			estimate: async () => {
				throw new Error("not allowed");
			},
		});
		expect(rejecting.estimate).toBeNull();
		const zero = await probeStorage({
			indexedDbAvailable: true,
			storage: fakeStorage(),
			estimate: async () => ({ usage: 5, quota: 0 }),
		});
		expect(zero.estimate).toBeNull();
	});
});
