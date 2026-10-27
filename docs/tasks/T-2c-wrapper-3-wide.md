# T-2c — Wrapper 3-wide true-token fix

**Phase:** P5 · **Status:** in review — PR #62 · **Model:** strong (high-risk tooling/CI) · **Depends on:** T-0a

## Goal

Fix `catalog:wave`/runner so catalog waves start **3-wide explicitly and safely**
after the owner's 3-wide override, without the free-slot auto-start bypass and
without the stopped-batch start/resume collision. Keep the true billed-token metric
as the budget/stop guard. This is **not** a catalog batch and opens no catalog PR.

## Context

- Boss-5 (#59) is merged at 322/15; T-2 is complete.
- Owner override 2026-10-27: **3-wide by default after T-2c**; third-slot start gate
  retired; true-token metric remains for budgets/stops; **≤3 PRs awaiting review**
  (max 1 feature).
- The wrapper auto-started boss-5 when the repair session exited, bypassing the
  gate; `launchBatch` also silently recreates a stopped batch and does not clear the
  stale `.stop` marker.
- Read: `docs/tasks/P5-03-image-completion-plan.md` (T-2c, Wave launch matrix,
  Next-wave coordinator protocol), `docs/tasks/P5-03d-parallel-workstreams.md`,
  `docs/catalog-backfill.md` §Parallel waves, `tools/catalog-wave/**`,
  `tools/catalog-runner/**`, AGENTS.md.

## Required behavior

1. A 3-wide wave starts **all 3 batches explicitly** and logs the 3-wide start
   (e.g. a logged `--allow-third`/explicit third start that still enforces the wave
   budget and concurrency cap; no silent bypass).
2. No free-slot auto-start of a queued third batch outside the explicit wave start;
   no silent bypass. The true-token metric still pauses/stops at budgets.
3. Starting or resuming a stopped batch must not collide: do not silently recreate;
   clear the stale `.stop` marker; use an explicit resume path.
4. Preserve one PR per batch; wrapper never merges and never opens PRs.
5. Add regression tests for both defects (free-slot bypass, stop/resume collision)
   and the 3-wide start.
6. Update the wrapper README/plan text as needed; no catalog data/assets.

## Budget / gates

- Scope: tooling/test/docs only; no catalog data/assets, no feature code.
- Token review: required for the process/rule change; fold valid findings.
- Code review: high-risk, ≤2 light-model passes; tests are the re-check.
- Run `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
- One PR; no merge; owner merges.

## Implementation

- **Explicit 3-wide start.** `initialStartCount` starts 2 up front; the third
  starts only with `--allow-third` + `maxParallel: 3`, and the wave logs
  `3-wide start: starting 3 batches`. Without it the third stays `queued`.
- **No free-slot start.** `refresh` never starts a queued batch; it only marks
  queued batches `not-started` on stop/soft/hard budget or when no active batch
  remains. The retired `canStartNext`/`startDecision` gate code is removed.
- **Safe explicit resume.** `--resume` reuses the **original wave id** (its
  state + JSONL are the true-token source), keeps `done`/`tokens`/`startedAt`,
  clears stale `.stop`/`.pause` markers, adopts completed siblings, skips
  `cap-reached` ones and starts plan batches with no state (partial-wave refill).
  `startBatch` now refuses any existing state instead of silently recreating it;
  `resumeBatch` refuses a live child **and a supervisor that is still finalizing**
  (`supervisorPid`) and takes the start lock.
- **Budget guard.** `WAVE_SOFT_TOKENS` is aligned to the owner-approved **1.6M**
  (hard 2.4M). Before launching/resuming, `preStartBudget` refuses at the hard
  cap and degrades to 1-wide at the soft cap, using the original wave's prior
  JSONL (why resume keeps the wave id). The true billed metric still stops
  active batches.
- **One PR per batch / no merge** unchanged; the wrapper still never opens or
  merges PRs.
- **Tests:** `initialStartCount`, `preStartBudget`, soft/hard budget, plan
  fresh-start/resume validation, runner start/resume collision guards, plus
  integration tests for the logged 3-wide start, the freed-slot regression and
  the stale-`.stop` resume path.
- **Docs:** wrapper README, `docs/catalog-backfill.md` §Parallel waves,
  superseded notes in P5-03/P5-03a and a resume note in the batch template.

## Token review (2026-10-27)

Verdict **`adjust`**; folded: wave soft budget constant aligned to **1.6M**
(was 1.2M); resume waves may include completed batches (adopted, not an error);
pre-start hard/soft budget guard; superseded-gate notes in the old task files;
batch-template resume note. No new agents/dependencies. Residual: resume must reuse the
original wave id (enforced) so the pre-start guard reads the real prior JSONL;
the phase guide was reconciled to 1.6M/2.4M, `--allow-third` and the 2.2M/3.4M
combined window. Detached flag propagation and the freed-slot terminal state are
tested.

## Acceptance

- Tests prove: a freed slot cannot start a queued third batch without the explicit
  3-wide start; a stopped batch resumes without collision; 3-wide starts are logged.
- `catalog:status`/wave report still report true billed tokens and the cache-inclusive
  floor; hard caps still stop active batches.
- Suite green; one PR; no catalog batch.
