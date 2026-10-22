import { join, resolve } from "node:path";

/**
 * Shared paths for the P5 catalog build. Everything here is repository-relative
 * unless a caller passes an explicit root/temp directory.
 *
 * The runtime catalog (`src/catalog/data`) is generated from the frozen legacy
 * baseline plus the committed raw batch files. Brand agents only ever write
 * `data/catalog/research/**` and their own assets.
 */

export type BatchKind = "pedals" | "boards";

export const CATALOG_ROOT = "data/catalog";
export const LEGACY_DIR = "data/catalog/legacy";
export const RESEARCH_DIR = "data/catalog/research";
export const MAPPED_DIR = "data/catalog";
export const RUNTIME_DIR = "src/catalog/data";
export const REGISTRY_PATH = "data/catalog/registry.json";
export const ASSETS_DIR = "public/pedal-assets";

export function kindToSingular(kind: BatchKind): "pedal" | "board" {
	return kind === "pedals" ? "pedal" : "board";
}

export function kindFromSingular(kind: "pedal" | "board"): BatchKind {
	return kind === "pedal" ? "pedals" : "boards";
}

export function kindDir(kind: BatchKind): "pedals" | "boards" {
	return kind;
}

export function legacyPath(root: string, kind: BatchKind): string {
	return resolve(root, LEGACY_DIR, `${kind}.json`);
}

export function researchRoot(root: string, kind: BatchKind): string {
	return resolve(root, RESEARCH_DIR, kind);
}

export function mappedRoot(root: string, kind: BatchKind): string {
	return resolve(root, MAPPED_DIR, kind);
}

export function runtimePath(root: string, kind: BatchKind): string {
	return resolve(root, RUNTIME_DIR, `${kind}.json`);
}

export function registryPath(root: string): string {
	return resolve(root, REGISTRY_PATH);
}

export function assetsRoot(root: string): string {
	return resolve(root, ASSETS_DIR);
}

export function batchId(brandKey: string, batch: string): string {
	return `${brandKey}/${batch}`;
}

export function mappedRelativePath(
	kind: BatchKind,
	brandKey: string,
	batch: string,
): string {
	return join(MAPPED_DIR, kind, brandKey, `${batch}.json`).replaceAll(
		"\\",
		"/",
	);
}

export function researchRelativePath(
	kind: BatchKind,
	brandKey: string,
	batch: string,
): string {
	return join(RESEARCH_DIR, kind, brandKey, `${batch}.json`).replaceAll(
		"\\",
		"/",
	);
}
