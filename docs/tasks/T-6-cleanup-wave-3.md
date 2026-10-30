# T-6 — Cleanup wave 3 coordinator (Joyo-1 + Keeley-1 + EQD-1)

> **Catalog program paused (2026-10-29).** Catalog backfill is closed/paused for now while we continue feature work. This task is not active; it may be resumed later for refilling. See `docs/tasks/CATALOG-PAUSED.md` and `docs/progress.md`.

**Phase:** P5 · **Status:** next · **Type:** catalog wave coordinator · **Depends on:** T-5 (complete)

## Goal

Run **cleanup wave 3** as its coordinator: Joyo-1, Keeley-1 and EarthQuaker
Devices-1 (**3-wide by default**). Each is the brand's **first batch**, so it
includes all of that brand's existing seed items (hotlinked/mock/static) **plus**
new Tier A items. The coordinator reads the last state, creates the batch
tasks/worktrees, token-reviews the wave, writes the plan, launches via
`catalog:wave`, and hands the PRs to the owner. The coordinator opens **no PR**
and never merges.

## Read first

- `docs/progress.md`
- `docs/tasks/P5-03-image-completion-plan.md` (T-6 + next-wave protocol + wave matrix)
- `docs/tasks/P5-03d-parallel-workstreams.md`
- `docs/catalog-backfill.md` §Parallel waves
- `docs/tasks/P5-batch-template.md`
- The latest `catalog:wave` report/state (`cleanup-wave-2`) and the `docs/progress.md` WS note

## State at T-5 handoff (verify before launch)

- **T-5 cleanup wave 2 is COMPLETE** — #75 JHS (26), #77 TC Electronic (23) and
  #78 Walrus (26) merged; post-merge `a8f7643` verified **444/15**, ledger **459**.
  **0 open catalog PRs**; catalog + feature caps free. T-6 can start.
- Expected after the T-5 merges: **444 pedals / 15 boards** (423 + 6 TC + 7 JHS +
  8 Walrus; TC documented 2 scope gaps — Corona Chorus+ is not a standalone unit
  and Crescendo Auto Swell needs a coordinator-only `curated.ts` override, so it
  held back 2 planned new items). Ledger expected **459** (438 + 21 new). Verify
  the actual post-merge numbers; do not trust this estimate.
- Currently open: **0 PRs**. F-04 #76 merged; feature lane free.
- Catalog cap **≤3 PRs**; feature cap **≤1 PR, separate**.
- Budgets: catalog 400k/800k per batch; wave soft **1.6M** / hard **2.4M** billed
  non-cache; 4 h active; 12 min/item (stall threshold); ≤2 vision passes; ≤1 light
  code review. T-5 measured **1.46M** billed for the 3-wide wave (TC 365k/60m ·
  JHS 365k/33m · Walrus 691k/91m; Walrus over soft, logged; cache-incl. floor
  107.74M).
- **Process note from T-5:** all three batches did research/image work before the
  first checkpoint and tripped the per-item stall threshold. The data was fine,
  but T-6 prompts must say **checkpoint the first item immediately after setup**
  and checkpoint inline after every item.
- **Evidence branches:** batch PRs must keep only raw records + assets +
  `curated.ts` (when required); put screenshots on
  `p5-03-pedals-<batch>-evidence` and embed the evidence-branch raw URLs in the PR
  (T-5 had to move all three off the batch branches to pass `guard-batch-pr`).

## Scope (verify counts from the ledger before writing task files)

- `joyo/joyo-1` — **18 existing** (5 hotlinked + 13 mock/static) **+ 8 new = 26**.
  Re-host every existing seed; record `imageProvenance`; verify dimensions/power/
  jacks per item.
- `keeley/keeley-1` — **18 existing** (18 mock/static) **+ 8 new = 26**. Same
  replacement rule.
- `earthquaker-devices/eqd-1` — **18 existing** (18 mock/static) **+ 8 new = 26**.
  Same replacement rule.
- Total ≈ **78 items** (54 existing = 5 hotlinked + 49 mock/static + 24 new).
  Current ledger (T-4 baseline) says Joyo 18, Keeley 18, EQD 18. **Run
  `pnpm catalog:asset-ledger` first** and use the regenerated ledger. The next
  alphabetical Tier A order is the default; do not force 26 if a brand has fewer
  verifiable items.
- Boards: none in T-6 (pedal brands only).

## Steps

1. **Read state:** `pnpm catalog:status`; `pnpm catalog:wave report --wave
   cleanup-wave-2`; verify the T-5 post-merge build (expected 444/15) and **0 open
   catalog PRs**. Never redo merged batches; resume failed-stopped once; never
   duplicate.
2. **Classify batches:** merged / in review / running / failed-stopped / queued.
3. **Pick the next uncompleted batches** (Joyo-1, Keeley-1, EQD-1); no overlap.
4. **Create batch tasks/worktrees** from `P5-batch-template.md`; one branch/worktree
   and one PR per batch. Run `catalog:promote-legacy` for the existing seeds; list
   the exact scope + image/jack rules in each task, including the T-4b discovery
   pass and the checkpoint-first process fix.
5. **Token-review** the wave plan; fold valid findings (one vision call, root +
   billed ledger, no refill at the 3-PR cap, targeted Playwright + CI e2e).
6. **Write the wave plan** (`work/catalog/waves/cleanup-wave-3.json`):
   `maxParallel: 3`; 3-wide by default. A feature PR is a separate 1-PR lane.
7. **Launch** via `pnpm catalog:wave run --plan <file>`; no raw background
   sessions. Clear any stale out-of-plan batch state that would block a slot
   without touching catalog data.
8. **Monitor** every 10–15 min via `catalog:status`/report; one WS line per
   checkpoint; log billed tokens by class. At catalog ≥2.0M billed, start no new
   wave; at the hard caps, stop.
9. **After each merge:** verify the post-merge build, update progress, rebase open
   branches, then refill (only when the catalog cap frees a slot). Max 3 refills;
   never hand-resolve generated conflicts.
10. **Report** PRs, items, images, billed tokens/minutes, CI, blockers. No merge.
11. **Handoff:** create the next wave's coordinator task (**T-7: Behringer-1 + Big
    Joe-1 + Effects Bakery-1**) from `catalog-coordinator-template.md`, link it in
    `progress.md`, and record the next order.

## Rules

- One PR per batch; coordinator opens no PR; owner merges serially.
- **Catalog cap ≤3 PRs**; **feature cap ≤1 PR, separate**. At the catalog cap,
  start no new catalog wave; at the feature cap, start no new feature.
- Image policy: official/retailer/community (recorded) → recorded planner
  last-resort → generated flat art only if none; planner is a counted source gap;
  boards never use planner pixels. **Clean-alpha gate**; jacks need a verified
  source (omit the edge + `unknown` if none).
- Every batch PR: `catalog:ci`, jack/image gates, demo share link,
  **before/after screenshots** for visual/image changes (desktop + mobile) on an
  evidence branch, owner review hints, review digest.
- No generated mapped/runtime hand edits; post-merge build only.
- Stop on 429/401/quota/timeout/empty (report model + operation + exact error,
  never substitute), 3 catalog PRs or 1 feature PR awaiting, hard cap, 2 failed
  resumes, generated conflict, or a missing verified source.
- Run the `token-usage-reviewer` before launch; per-batch task copies are exempt.

## Acceptance

- Joyo-1/Keeley-1/EQD-1 launched 3-wide (or 2-wide with a feature open; the
  feature lane is separate).
- One PR per batch; coordinator PR none.
- Every existing hotlinked/mock/static seed in the three brands is replaced and
  recorded.
- Post-merge build verified after each merge; next wave (T-7) selected and linked.
