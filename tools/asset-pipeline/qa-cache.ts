import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

/**
 * Image QA cache (P5-02). Keyed by the SHA-256 of the source bytes so a rejected
 * or accepted image is never re-reviewed unnecessarily. The contact-sheet
 * reviewer returns verdicts; the coordinator writes them here.
 */

export type QaVerdict = "accept" | "flag" | "reject";

export type QaCacheEntry = {
	sha256: string;
	verdict: QaVerdict;
	reasons: string[];
	reviewedAt: string;
	reviewer?: string;
};

export type QaCache = {
	version: 1;
	batch: string;
	images: Record<string, QaCacheEntry>;
};

export function hashBytes(bytes: Uint8Array): string {
	return createHash("sha256").update(bytes).digest("hex");
}

export async function readQaCache(
	path: string,
	batch: string,
): Promise<QaCache> {
	try {
		const parsed = JSON.parse(await readFile(path, "utf8")) as QaCache;
		if (parsed.version !== 1 || typeof parsed.images !== "object") {
			throw new Error(`invalid QA cache: ${path}`);
		}
		return parsed;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			return { version: 1, batch, images: {} };
		}
		throw error;
	}
}

export async function writeQaCache(
	path: string,
	cache: QaCache,
): Promise<void> {
	await mkdir(dirname(path), { recursive: true });
	const temp = `${path}.tmp-${process.pid}`;
	await writeFile(temp, `${JSON.stringify(cache, null, 2)}\n`);
	await rename(temp, path);
}

export function cacheKey(entry: QaCacheEntry): string {
	return entry.sha256;
}

export function findCached(
	cache: QaCache,
	sha256: string,
): QaCacheEntry | undefined {
	return Object.values(cache.images).find((entry) => entry.sha256 === sha256);
}

export async function recordQa(
	path: string,
	batch: string,
	id: string,
	entry: QaCacheEntry,
): Promise<QaCache> {
	const cache = await readQaCache(path, batch);
	cache.images[id] = entry;
	await writeQaCache(path, cache);
	return cache;
}
