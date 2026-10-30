# T-3 — BOSS wave 4 coordinator

> **Catalog program paused (2026-10-29).** Catalog backfill is closed/paused for now while we continue feature work. This task is not active; it may be resumed later for refilling. See `docs/tasks/CATALOG-PAUSED.md` and `docs/progress.md`.

**Phase:** P5 · **Status:** **done — merged** #65 (boss-7), #66 (boss-6), #68 (boss-8), #69 (rule); post-merge `7ee3585`, **399/15** · **Type:** catalog wave coordinator · **Depends on:** T-2c/T-2d

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

- **PRs:** #65 boss-7, #66 boss-6, #68 boss-8 and #69 (rule) are **all merged**.
  Post-merge builds: boss-6 `61af93c`, boss-7 `75492b0` (374/15), boss-8 **`7ee3585`
  → 399/15**. The first boss-8 post-merge workflow push raced the #69 merge and
  failed; the generated files were rebuilt locally (`catalog:post-merge`) and
  committed as `7ee3585` — deterministic, drift check clean. Coordinator opened **no PR**; docs-only rule **PR #69**.
  Catalog cap reached (3).
- **Items/images:** 77 net-new + 1 repair; **156 AVIF pairs** (boss-6 54 =
  26 new + `psm-5`; boss-7 52; boss-8 50). BOSS completes at **208**; BOSS
  hotlinked+mock = **0**.
- **#68 correction (owner request, 2026-10-27):** the 6 generated assets were
  replaced with real images → **20 official + 5 planner last-resort + 0
  generated**; planner-host 2× sources are downscaled to 800. WL-50 footprint
  fixed to **7.2×12.1 cm** (official receiver spec; 2.2 was the transmitter
  depth), with receiver power/jacks corrected. One owner-approved correction
  vision pass: 6/6 product accept (WL-50 official chosen), 4/4 connector crops.
  PSNR 42.96–46.88 dB. The PR is **guard-clean** (52 files: raw + 50 assets +
  task); evidence lives on `p5-03-pedals-boss-8-evidence`.
- **Root billed non-cache:** **1.32M** (boss-6 434k, boss-7 328k, boss-8 554k;
  cache-inclusive floor ~114M). boss-6/boss-8 are over the 400k per-batch soft,
  under the 800k hard; wave under the 1.6M soft. Subagent vision/code-review
  sessions are separate.
- **CI:** #65/#66/#68/#69 all green; the corrected #68 branch passed
  `catalog:ci` (399/15), test **853** and `guard-batch-pr`. Post-merge build
  **verified 399/15** (`7ee3585`).
- **Rules:** **PR #69** codifies “resolution is not a rejection reason; process
  to the 800 master and gate the final rendition”; planner last-resort stays
  above generated art; footprint from the official unit spec. Token review
  `adjust` folded; docs-only.
- **Coordinator ops:** a stale out-of-plan `acme/pedals-1` test batch (0/3, >8h)
  held the third slot; it was cleared to `blocked` and boss-8 launched as
  `boss-wave-4-fill` (same plan/branch) so 3-wide held. No raw sessions; no
  `--allow-third`.
- **Merge risk:** all three PRs touch `tools/catalog-transform/curated.ts`; merge
  serially and rebase the remaining PRs, re-running effects/no-drift + `catalog:ci`.
  Never hand-resolve generated mapped/runtime files. Post-merge build expected
  **399 pedals / 15 boards**.
- **Feature lane:** F-19 merged (#64); **#67 (F-03) is the 1 open feature PR,
  within the ≤1 cap**. No new feature/catalog wave until the caps clear.

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

- boss-6/7/8 launched 3-wide with F-19 open (separate 1-PR lane). **Done.**
- One PR per batch; coordinator PR none; no raw sessions.
- Post-merge build verified after each merge; **create the T-4 coordinator task** from `catalog-coordinator-template.md`, link it in `progress.md`, and hand off. **Done — every merge verified; final `7ee3585` = 399/15; T-4 linked.**
