/**
 * Slug + variant-name helpers shared by the converter, the curated effect
 * override table, and the seed. Kept dependency-free so any of those can import
 * it without a cycle.
 */

/** A trailing colorway/edition suffix, e.g. "ARP-87 (Nat. Parks)". */
export const VARIANT_SUFFIX = /^(.*?)\s*\(([^)]+)\)\s*$/;

/** Slugify a display string: lowercase ASCII words joined by single hyphens. */
export function toSlug(value: string): string {
	return value
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.replace(/-{2,}/g, "-");
}

/** The base-model slug for a display name (strips a trailing variant suffix). */
export function baseSlug(brand: string, name: string): string {
	const match = name.match(VARIANT_SUFFIX);
	const base = match ? match[1].trim() : name;
	return toSlug(`${brand} ${base}`);
}
