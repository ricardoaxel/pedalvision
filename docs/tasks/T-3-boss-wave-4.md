# T-3 — BOSS wave 4 coordinator

**Phase:** P5 · **Status:** next · **Type:** catalog wave coordinator · **Depends on:** T-2c/T-2d

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

## Acceptance

- boss-6/7/8 launched 3-wide (or 2-wide with a feature open).
- One PR per batch; coordinator PR none; no raw sessions.
- Post-merge build verified after each merge; **create the T-4 coordinator task** from `catalog-coordinator-template.md`, link it in `progress.md`, and hand off.
