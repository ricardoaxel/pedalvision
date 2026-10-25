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
 * Batch-support files: verified effect-type overrides are shared tooling, but a
 * batch may need to add its own creative-name entries. The no-drift test requires
 * them, so allow only this specific file (never general `tools/` changes).
 */
const BATCH_SUPPORT_ALLOWED = [/^tools\/catalog-transform\/curated\.ts$/];

/**
 * Owner-approved exception for the **pilot + delivery-pipeline** PR only. Normal
 * brand batches must not pass `allowPipeline`; the pilot that introduces AVIF /
 * the rendition map carries the pipeline code, docs and tests in the same PR.
 */
const PIPELINE_ALLOWED = [
	/^src\/lib\/cdn\.ts$/,
	/^src\/lib\/(capacity|partInfo|jackAnchor)(\.test)?\.ts$/,
	// Tooling-only codec drift test for catalog:demo-link (P5 guardrails).
	/^src\/lib\/shareLink\.demo\.test\.ts$/,
	/^src\/catalog\/(schema|schema\.test|rawSchema)\.ts$/,
	/^src\/state\/scene\.ts$/,
	/^src\/components\/(Picker|InfoPanel)\.tsx$/,
	/^src\/canvas\/(PedalNode|BoardNode|exportStage)\.tsx?$/,
	/^tools\//,
	/^e2e\//,
	/^\.opencode\/agent\//,
	/^docs\//,
	/^AGENTS\.md$/,
	/^playwright\.config\.ts$/,
	/^vite\.config\.ts$/,
	/^package\.json$/,
	/^pnpm-lock\.yaml$/,
];

/** Generated/mapped files stay forbidden even for the pipeline exception. */
const PIPELINE_DENIED = [
	/^src\/catalog\/data\//,
	/^data\/catalog\/(pedals|boards)\//,
	/^data\/catalog\/registry\.json$/,
	/^data\/catalog\/legacy\//,
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
	const allowed = [
		...ALLOWED,
		...BATCH_SUPPORT_ALLOWED,
		...(options.allowPipeline ? PIPELINE_ALLOWED : []),
	];
	return files.filter((file) => {
		if (options.allowPipeline && PIPELINE_DENIED.some((p) => p.test(file))) {
			return true;
		}
		return !allowed.some((pattern) => pattern.test(file));
	});
}

export function formatGuardViolations(violations: string[]): string {
	if (violations.length === 0) return "";
	return [
		"batch PR must contain raw research files + assets only; remove:",
		...violations.map((file) => `  - ${file}`),
	].join("\n");
}
