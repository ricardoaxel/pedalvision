/**
 * Tiny deterministic string hash (FNV-1a, 32-bit). Used to derive stable
 * per-item variation (palette) for the mock seed images. Pure integer
 * math, so it is identical on every platform — no `Math.random` anywhere.
 */
export function hashString(value: string): number {
	let hash = 2166136261 >>> 0;
	for (let i = 0; i < value.length; i++) {
		hash ^= value.charCodeAt(i);
		hash = Math.imul(hash, 16777619) >>> 0;
	}
	return hash >>> 0;
}
