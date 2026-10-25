# P5-03: Batch guardrails — jack provenance, demo links, small-batch QA

**Phase:** P5 · **Status:** in progress · **Model:** build-strong

## Goal

Turn the Meris-batch retro into durable tooling so future catalog batches cannot
repeat the same gaps. No catalog data and no UI/pixels change: this is dev
tooling + docs.

## Scope

- **Jack-edge provenance gate:** add `jackLayout { source, confidence }` to the
  raw contract, a `catalog:check-jacks` CLI, and run it from `catalog:ci`.
  Unverified edges fail the batch; unknown edges are omitted (app fallback).
- **Demo share link generator:** `catalog:demo-link` reads a raw batch, packs the
  items onto a board (custom board if needed), adds illustrative patch cables,
  and prints a `?share=1#s=…` URL + counts. No manual layout/cable work.
- **Batch-support guard:** allow only `tools/catalog-transform/curated.ts` as
  batch-support code (verified effect types for creative names), not general
  `tools/` edits.
- **Contact sheet:** allow 10–30 images so a 10-item batch is one sheet.
- **AVIF quality check:** `asset:psnr` compares the shipped AVIF to a temporary
  PNG cutout and fails below 40 dB.
- **Docs:** update the batch template, raw-research contract, pedal-expert agent,
  catalog-backfill and pilot task with the new rules.

## Constraints

- No app runtime/UI behavior change; no new dependencies (sharp/fflate/zod already
  present).
- No catalog data edits in this task.
- One PR; do not merge.
- Tests for every new pure helper; run lint / typecheck / test / build.
  E2E is not required (no UI change).

## Steps

1. Add `jackLayout` to `src/catalog/rawSchema.ts`.
2. Add `tools/catalog-pipeline/check-jacks.ts` + CLI command and wire it into
   `catalog:ci`; unit-test verified/unverified/unknown cases.
3. Backfill `jackLayout` on existing raw batches (Choka, JHS, Meris) with their
   verified sources.
4. Add `tools/catalog-demo/` (`layout.ts`, `encode.ts`, `index.ts`) + tests;
   `pnpm catalog:demo-link --batch <brand>/<batch>`.
5. Allow `curated.ts` in the batch guard; add tests.
6. Lower the contact-sheet minimum to 10; update tests/docs/agents.
7. Add `asset:psnr` + tests and document the AVIF q90 escalation.
8. Update the docs/templates.
9. Run `pnpm lint && pnpm typecheck && pnpm test && pnpm build`, plus
   `pnpm catalog:check-jacks` and a demo-link dry run.
10. Run the `token-usage-reviewer` on this process change (`AGENTS.md`, the
    new agent, the batch template/backfill rules); fold valid findings and record
    its verdict + budget in the PR.

## Acceptance (executable)

- `catalog:check-jacks` fails a raw record with an edge but no verified
  `jackLayout.source`, and passes the current raw archive.
- `catalog:demo-link --batch meris/meris-1` prints a URL and a summary with
  1 board / 10 items / 8 illustrative cables; the hash decodes with the app codec.
- `catalog:guard-batch-pr` accepts `curated.ts` and rejects other `tools/` files.
- Contact sheet builds with 10 images and still rejects 9 and 31.
- `asset:psnr` fails below the threshold and passes at/above it.
- Lint / typecheck / test / build green; no runtime/UI/pixel change.
- `token-usage-reviewer` verdict is `lean` or `adjust` (no blockers), with a
  bounded agent/model inventory and per-wave budget.

## Results

- **Jack gate:** `catalog:check-jacks` green on the current raw archive (Choka,
  JHS, Meris); negative tests cover missing/estimated layouts. The gate is wired
  into `catalog:ci`.
- **Demo link:** `catalog:demo-link --batch meris/meris-1` → 1 board / 10 items /
  8 illustrative cables; `--batch pedaltrain/classic-2` → 1 board / 0 items
  (board-only scene). Both decode in the app with no console errors.
- **Contact sheet:** 10–30 images; 10 accepted, 9/31 rejected by tests.
- **Guard:** `curated.ts` is the only batch-support tool file; `AGENTS.md` is
  allowed under the owner-approved tooling exception.
- **AVIF:** `asset:psnr` passes ≥40 dB and fails below; documented in the
  template/README.
- **Checks:** lint / typecheck / test **699** / build; `catalog:check-jacks`,
  `catalog:ci` **218 / 12**, `catalog:validate` green. E2E not run (tooling/docs
  only; no UI change).
- **Token/cost review:** `token-usage-reviewer` verdict **adjust**; findings
  folded: per-batch/wave budgets added (soft 400k/hard 800k per batch; 1.2M/2.4M
  per wave), BOSS corrected to **6×~35 in 2 waves**, per-batch task copies
  exempted from the review trigger, `code-reviewer` pinned to the light model,
  demo-link board support + `catalog:ci` prerequisite, context pack trimmed.
  Remaining duplication across docs is intentional cross-reader guidance.
- **Code review:** `code-reviewer` pass 1 **changes-required** (blocker: custom
  demo board >200 cm; should-fix: cable fallback, PSNR zero samples, empty
  check-jacks dir, codec test) → fixed; pass 2 (same session) **approve** with 2
  nits folded.

## Notes

- The demo scene is illustrative: it is not a real audio-routing model.
- Jack edges are only projected from a verified source; unknown edges fall back
  to the app’s assumed anchors (hollow/assumed cue).
