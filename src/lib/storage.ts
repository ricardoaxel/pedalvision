/**
 * Resolve a usable `Storage`. An explicit store (tests) is returned as-is;
 * otherwise `localStorage` is probed defensively — merely touching it throws a
 * `SecurityError` when site storage is blocked (sandboxed iframe, "block all
 * cookies"), and boot must not fail there.
 */
export function resolveStorage(storage?: Storage | null): Storage | null {
	if (storage) return storage;
	try {
		return typeof localStorage === "undefined" ? null : localStorage;
	} catch {
		return null;
	}
}
