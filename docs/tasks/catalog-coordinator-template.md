# Catalog wave coordinator — template

**Phase:** P5 · **Status:** template · **Use:** copy to `docs/tasks/<wave>-coordinator.md`

## Goal

Run the next catalog wave as its **coordinator**: read the last state, create the
batch tasks/worktrees, token-review the wave, write the wave plan, launch the
batches through `catalog:wave`, and hand the PRs to the owner. The coordinator
opens **no PR** and never merges.

## Read first

- `docs/progress.md`
- `docs/tasks/P5-03-image-completion-plan.md` (next-wave protocol + wave matrix)
- `docs/tasks/P5-03d-parallel-workstreams.md`
- `docs/catalog-backfill.md` §Parallel waves
- `docs/tasks/P5-batch-template.md`
- The latest `catalog:wave` report/state and `docs/progress.md` WS note

## Steps

1. **Read state:** `pnpm catalog:status`; `pnpm catalog:wave report --wave <last>`;
   read the latest report/state; check open PRs and the post-merge build. Never
   re-read raw logs.
2. **Classify batches:** merged / in review / running / failed-stopped / queued.
   Never redo merged; resume/repair failed-stopped once; never duplicate.
3. **Pick the next uncompleted batches** from the plan order; do not overlap.
4. **Create batch tasks/worktrees** from `P5-batch-template.md`; one branch/worktree
   and one PR per batch.
5. **Token-review** the wave plan; fold valid findings.
6. **Write the wave plan** (`work/catalog/waves/<id>.json`): `maxParallel: 3` for a
   no-feature wave; `maxParallel: 2` when a feature PR is open. Waves start
   3-wide by default; `--allow-third` is a deprecated no-op.
7. **Launch** via `pnpm catalog:wave run --plan <file>`; no raw background sessions.
8. **Monitor** every 10–15 min via `catalog:status`/report; one WS line per checkpoint.
9. **After each merge:** verify the post-merge build, update progress, rebase open
   branches, then refill the next batch/wave. Max 3 refills per wave.
10. **Report** PRs, items, images, billed tokens/minutes, CI, blockers. No merge.
11. **Handoff:** create the next wave's coordinator task from this template, link it
    in `docs/progress.md`, and record the next batch order.

## Rules

- One PR per batch; coordinator opens no PR; owner merges serially.
- PR cap **≤3** (max 1 feature). With a feature PR open, catalog concurrency is **2**;
  at 3 awaiting review, start nothing new.
- Budgets: 400k/800k per batch; wave soft **1.6M** / hard **2.4M** billed non-cache;
  4 h active; 12 min/item; ≤2 vision passes; ≤1 light code review.
- Image policy/jack gate; planner last-resort recorded; no planner pixels for boards.
- Every batch PR: demo share link; **before/after screenshots** for visual/image
  changes (desktop + mobile); owner review hints; review digest.
- No generated mapped/runtime hand edits; post-merge build only.
- Stop on 429/401/quota/timeout/empty, 3 PRs awaiting, hard cap, 2 failed resumes,
  generated conflict, or a missing verified source.

## Acceptance

- Next uncompleted batches launched 3-wide (or 2-wide with a feature open).
- One PR per batch; coordinator PR none.
- Post-merge build verified after each merge; next wave selected.
