# T-3 — BOSS wave 4 coordinator

**Phase:** P5 · **Status:** in review — PRs #65 (boss-7), #66 (boss-6), #68 (boss-8) · **Type:** catalog wave coordinator · **Depends on:** T-2c/T-2d

## Goal

Complete BOSS with **boss-6 + boss-7 + boss-8** (77 items) in **one 3-wide wave**,
using the recorded next-wave protocol. The coordinator creates the three batch
tasks/worktrees, runs the token review, launches via `catalog:wave`, and opens
**no PR**. Each batch session opens one PR; the owner merges.

## Read first

- `docs/tasks/catalog-coordinator-template.md`
- `docs/progress.md`
- `docs/tasks/P5-03-image-completion-plan.md` (T-2c/T-2d/T-3 + next-wave protocol)
- `docs/tasks/P5-03d-parallel-workstreams.md`
- `docs/catalog-backfill.md` §Parallel waves
- `docs/tasks/P5-batch-template.md`
- `docs/tasks/T-2c-wrapper-3-wide.md`, `docs/tasks/T-2d-default-3-wide.md`

## State

- #62 (T-2c/T-2d) and #63 (F-02) are merged; main at/after `61d944d`; **322/15**; **0 PRs**.
- Waves start **3-wide by default**; no `--allow-third`.
- 3-wide even with a feature PR open; the feature is a separate 1-PR lane.
  Catalog cap **≤3 PRs**; feature cap **≤1 PR**, separate.
- T-2 calibration: boss-4 ≈724k/66 min; boss-5 ≈579k/42 min.

## Scope

- `boss/boss-6`, `boss/boss-7`, `boss/boss-8` (77 total; inventory slices to be
  confirmed by the coordinator from the BOSS inventory).
- Create each task/worktree from `P5-batch-template.md`.
- Wave plan `work/catalog/waves/boss-wave-4.json` with `maxParallel: 3`; a feature PR is a separate 1-PR lane.
- No feature work; no T-4; no merge.

## Steps

1. `pnpm catalog:status`; `pnpm catalog:wave report --wave boss-wave-3`; read the
   latest report/state. Never redo merged; resume failed-stopped once; no duplicate.
2. Create boss-6/7/8 tasks/worktrees from the batch template.
3. Run `token-usage-reviewer` on the wave plan; fold valid findings.
4. Write the wave plan and launch:
   `pnpm catalog:wave run --plan work/catalog/waves/boss-wave-4.json`.
   No `--allow-third`; no raw sessions.
5. Poll every 10–15 min via status/report; one WS line per checkpoint.
6. After each merge: verify post-merge build, update progress, rebase, refill; no
   generated-file hand edits.
7. Report PRs, items, images, billed tokens/minutes, CI, blockers. No merge.

## Batch PR requirements

- Raw records + hosted assets only; `catalog:ci`; jack/image gates.
- Demo share link for every batch.
- **Before/after screenshots** for visual/image changes (desktop + mobile).
- Owner review hints + review digest.
- One PR per batch; no merge.

## Budgets / stop

- 400k/800k per batch; wave soft 1.6M / hard 2.4M billed non-cache; 4 h active;
  12 min/item; ≤2 vision; ≤1 light code review.
- Stop on 3 catalog PRs or 1 feature PR awaiting, hard cap, 2 failed resumes, generated conflict, or any
  429/401/quota/timeout/empty (report model + operation + exact error).

## Delivery (2026-10-27)

- **PRs:** #65 boss-7 (26), #66 boss-6 (26 + `psm-5` repair), #68 boss-8 (25).
  Coordinator opened **no PR**. Catalog cap reached (3).
- **Items/images:** 77 net-new + 1 repair; **154 AVIF pairs** (130+2 batch images,
  plus boss-8 generated-art specs where needed). BOSS completes at **208**;
  BOSS hotlinked+mock = **0**.
- **Root billed non-cache:** **1.32M** (boss-6 434k, boss-7 328k, boss-8 554k;
  cache-inclusive floor ~114M). boss-6/boss-8 are over the 400k per-batch soft,
  under the 800k hard; wave under the 1.6M soft. Subagent vision/code-review
  sessions are separate.
- **CI:** #65/#66/#68 **pass**.
- **Coordinator ops:** a stale out-of-plan `acme/pedals-1` test batch (0/3, >8h)
  held the third slot; it was cleared to `blocked` and boss-8 launched as
  `boss-wave-4-fill` (same plan/branch) so 3-wide held. No raw sessions; no
  `--allow-third`.
- **Merge risk:** all three PRs touch `tools/catalog-transform/curated.ts`; merge
  serially and rebase the remaining PRs, re-running effects/no-drift + `catalog:ci`.
  Never hand-resolve generated mapped/runtime files. Post-merge build expected
  **399 pedals / 15 boards**.
- **Feature lane:** #64 (F-19) + #67 (F-03) are open — **2 feature PRs, over the
  ≤1 cap**. Not opened by this coordinator; no new feature/catalog wave until the
  caps clear.

## Token review (2026-10-27)

`token-usage-reviewer`: **`adjust`**. Folded:

- **boss-6 total consistency:** wave plan total = **26** net-new; the `psm-5`
  repair is extra work and is not a runner item.
- **Combined-window polling:** the coordinator logs F-19 billed spend at every
  checkpoint; at catalog **≥2.2M** or combined ≥**3.0M**, active batches finish at
  the next item boundary and open their PRs (no new work). The 2.0M "start no new
  wave" rule is inert with an all-at-once 3-wide start, so the wrap-up signal is
  explicit.
- **Budget headroom (not adopted as a rule change):** the reviewer flagged that
  3×800k equals the 2.4M wave hard. The owner's per-batch 400k/800k and wave
  1.6M/2.4M budgets are unchanged; the coordinator monitors the true billed metric
  and uses the wrap-up checkpoint above so one batch cannot silently consume the
  whole wave.
- **12 min/item** clarified as a per-item stall threshold, not a batch multiplier.
- Stale "2-wide with a feature open" acceptance line fixed: F-19 is a separate
  1-PR lane; catalog stays 3-wide.

## Acceptance

- boss-6/7/8 launched 3-wide with F-19 open (separate 1-PR lane).
- One PR per batch; coordinator PR none; no raw sessions.
- Post-merge build verified after each merge; **create the T-4 coordinator task** from `catalog-coordinator-template.md`, link it in `progress.md`, and hand off.
