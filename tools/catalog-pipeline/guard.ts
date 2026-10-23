/**
 * Batch-PR guard (P5-02). A brand batch PR may contain raw research records,
 * assets, and its own task file — never generated mapped/runtime files, feature
 * code, or another brand's batch.
 */

const ALLOWED = [
	/^data\/catalog\/research\/(pedals|boards)\/[a-z0-9-]+\/[a-z0-9-]+\.json$/,
	/^public\/pedal-assets\/(pedals|boards)\/(800|350)\/[a-z0-9][a-z0-9-]*\.(png|avif)$/,
	/^docs\/tasks\/P5-03-[a-z0-9-]+\.md$/,
];

/**
 * Owner-approved exception for the **pilot + delivery-pipeline** PR only. Normal
 * brand batches must not pass `allowPipeline`; the pilot that introduces AVIF /
 * the rendition map carries the pipeline code, docs and tests in the same PR.
 */
const PIPELINE_ALLOWED = [
	/^src\//,
	/^tools\//,
	/^e2e\//,
	/^\.opencode\/agent\//,
	/^docs\//,
	/^playwright\.config\.ts$/,
	/^vite\.config\.ts$/,
	/^package\.json$/,
	/^pnpm-lock\.yaml$/,
];

export type GuardOptions = {
	/** Allow the pipeline files only for the owner-approved pilot PR. */
	allowPipeline?: boolean;
};

export function guardBatchPr(
	files: string[],
	options: GuardOptions = {},
): string[] {
	const isBatchPr = files.some(
		(file) =>
			file.startsWith("data/catalog/research/") ||
			file.startsWith("public/pedal-assets/"),
	);
	if (!isBatchPr) return [];
	const allowed = options.allowPipeline
		? [...ALLOWED, ...PIPELINE_ALLOWED]
		: ALLOWED;
	return files.filter((file) => !allowed.some((pattern) => pattern.test(file)));
}

export function formatGuardViolations(violations: string[]): string {
	if (violations.length === 0) return "";
	return [
		"batch PR must contain raw research files + assets only; remove:",
		...violations.map((file) => `  - ${file}`),
	].join("\n");
}
