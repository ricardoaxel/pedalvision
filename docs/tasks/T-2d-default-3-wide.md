# T-2d — Catalog waves start 3-wide by default

**Phase:** P5 · **Status:** merged — PR #62 (squash `50025c8`, folded into T-2c) · **Model:** strong (high-risk tooling/CI) · **Depends on:** T-2c

## Goal

Make `catalog:wave` start **min(3, maxParallel, batchCount)** batches by default,
removing the `--allow-third` requirement. Keep the true-token budget/stop guard,
the explicit-start model, resume identity and all T-2c safety fixes.

## Context

- Owner override 2026-10-27: catalog waves are 3-wide by default; the true-token
  metric remains the budget/stop guard; the third-slot start gate is retired.
- T-2c (PR #62) made 3-wide explicit via `--allow-third`; that flag is now
  unnecessary friction. The owner asked for 3-wide by default and folded the
  change into the same PR (no second PR).
- Owner accepts **3-wide over-soft** risk: soft is logged, not enforced by
  shrinking the wave. The **hard 2.4M** cap still refuses/stops.

## Required behavior

1. `initialStartCount` = **min(3, maxParallel, batchCount)** with no flag. A
   3-batch / `maxParallel: 3` plan starts 3; explicit 1/2-batch plans stay 1/2;
   `maxParallel: 2` stays 2.
2. `--allow-third` remains accepted as a **deprecated no-op** (help/README say so);
   the T-3 prompt no longer needs it.
3. Pre-start budget: **hard 2.4M refuses**; **soft 1.6M is logged and still starts
   the planned width** (no 1-wide reduction).
4. Preserve T-2c: true billed-token report + cache-inclusive floor, no free-slot
   auto-start, explicit start, resume identity (original wave id), stale
   `.stop`/`.pause` clearing, completed-sibling adoption, stateless refill,
   supervisor-finalize guard.
5. Update all operational docs that mention `--allow-third` / 2-wide.
6. Tests: default 3; 2-batch and `maxParallel` 2; hard refusal; soft over-soft
   still 3; no auto-start; resume collision; detached args.

## Implementation

- `gate.ts`: `initialStartCount` uses min(3, maxParallel, batchCount);
  `preStartBudget` keeps the hard refusal and returns the planned width on soft
  with a log note.
- `index.ts`: default 3-wide start note; deprecated `--allow-third` prints a note
  and has no effect; removed the 1-wide soft reduction; queued/refill messages no
  longer reference the flag.
- Tests: unit start-width/budget cases; integration default-3, 2-batch,
  deprecated-flag dry-run, soft-over-soft still 3, hard pre-start refusal, plus
  the existing no-auto-start/resume/detached-args coverage.
- Docs: AGENTS, T-0b, image-completion plan, backfill, phase guide, batch/pilot
  templates, coordinator agent, roadmap/progress and T-2c/T-3 notes.
- No catalog data/assets, no feature code, no new dependencies.

## Token review (2026-10-27)

Verdict **`adjust`**; folded: `WavePlanSchema.maxParallel` default **3** (omitting
it means 3, with a schema test), progress handoff reconciliation, combined 3.4M
worded as a coordinator-side check on top of the wrapper's fixed 2.4M cap,
feature-open pre-flight `maxParallel: 2`, and a **≥2.0M billed → start no new
wave** rule. README example id fixed. No new agents/dependencies.

## Code review

`code-reviewer` pass 1 **approve-with-changes** (5 findings: deprecated-flag test
strength, progress drift, T-2c task drift, start-note count, combined-window
wording) → pass 2 **approve-with-changes** with only the progress handoff left
(fixed docs-only). 2-pass cap reached; tests are the re-check, no third pass.

## Acceptance

- A 3-batch wave with `maxParallel: 3` starts 3 with no flag and logs the start.
- A 2-batch plan (or `maxParallel: 2`) starts 1/2 as declared.
- Soft over-budget logs and starts 3; hard 2.4M refuses.
- No free-slot auto-start; resume collision guards preserved.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build`; token review; high-risk
  code review (≤2 light passes); one PR; no merge.
