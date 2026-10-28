# T-4 — Cleanup wave 1 coordinator (EHX-1 + MXR-1 + Mooer-1)

**Phase:** P5 · **Status:** next · **Type:** catalog wave coordinator · **Depends on:** T-3

## Goal

Run **cleanup wave 1** as its coordinator: EHX-1, MXR-1 and Mooer-1
(**3-wide by default**). Each batch is a brand's **first batch**, so it includes
all of that brand's existing seed items (hotlinked/mock) **plus** new Tier A items
to 24–28. The coordinator reads the last state, creates the batch tasks/worktrees,
token-reviews the wave, writes the plan, launches via `catalog:wave`, and hands the
PRs to the owner. The coordinator opens **no PR** and never merges.

## Read first

- `docs/progress.md`
- `docs/tasks/P5-03-image-completion-plan.md` (T-4 + next-wave protocol + wave matrix)
- `docs/tasks/P5-03d-parallel-workstreams.md`
- `docs/catalog-backfill.md` §Parallel waves
- `docs/tasks/P5-batch-template.md`
- The latest `catalog:wave` report/state and the `docs/progress.md` WS note

## State (at handoff)

- **T-3 is COMPLETE:** #65/#66/#68 + rule #69 merged; post-merge build
  `7ee3585` verified **399 pedals / 15 boards**; BOSS complete at 208; BOSS
  hotlinked + mock = 0.
- Waves start **3-wide by default** (T-2d); no `--allow-third`.
- Catalog cap **≤3 PRs** (0 open); feature cap **≤1 PR, separate** (F-19 merged;
  F-03 #67 is the 1 open feature PR).
- Budgets: catalog 400k/800k per batch; wave soft **1.6M** / hard **2.4M** billed
  non-cache; 4 h active; 12 min/item (per-item stall threshold); ≤2 vision passes;
  ≤1 light code review (data-only skip unless `curated.ts` changed).
- T-2/T-3 calibration: boss-4 ≈724k/66 min; boss-5 ≈579k/42 min; boss-6/7/8 ≈1.2M
  combined billed (3-wide).

## Scope (confirm counts from the ledger before launch)

> **First:** run `pnpm catalog:asset-ledger` — the ledger file is stale at 311
> items; the catalog is now 399 (BOSS complete). Use the regenerated ledger for
> the EHX/MXR/Mooer hotlinked/mock counts.

- `ehx/ehx-1` — **18 existing hotlinked + 8 new = 26**. Re-host every existing EHX
  seed item; never keep a hotlinked/mock asset; record `imageProvenance`.
- `mxr/mxr-1` — **18 existing hotlinked + 8 new = 26**. Same replacement rule.
- `mooer/mooer-1` — **18 existing (17 hotlinked + 1 mock) + 8 new = 26**. Same
  replacement rule; resolve the mock item with a real/recorded source or generated
  flat art only as the last resort.
- Total ≈ **78 items** (54 existing + 24 new). Verify the ledger counts
  (`pnpm catalog:license-report`) before writing the task files; do not force 26 if
  a brand has fewer Tier A items.

## Steps

1. **Read state:** `pnpm catalog:status`; `pnpm catalog:wave report --wave boss-wave-4`;
   verify the T-3 post-merge build (399/15) and 0 open catalog PRs. Never redo
   merged batches; resume failed-stopped once; never duplicate.
2. **Classify batches:** merged / in review / running / failed-stopped / queued.
3. **Pick the next uncompleted batches** (EHX-1, MXR-1, Mooer-1); no overlap.
4. **Create batch tasks/worktrees** from `P5-batch-template.md`; one branch/worktree
   and one PR per batch. Each task lists the exact 26-item scope (existing seed
   repair + new) and the image/jack rules.
5. **Token-review** the wave plan; fold valid findings.
6. **Write the wave plan** (`work/catalog/waves/cleanup-wave-1.json`):
   `maxParallel: 3`; 3-wide by default. A feature PR is a separate 1-PR lane.
7. **Launch** via `pnpm catalog:wave run --plan <file>`; no raw background sessions.
   If a stale out-of-plan batch occupies a slot, clear it (do not let it block the
   third slot) and refill via a partial-wave plan.
8. **Monitor** every 10–15 min via `catalog:status`/report; one WS line per
   checkpoint. Log F-19 billed spend separately; at catalog ≥2.2M or combined ≥3.0M,
   finish at the next item boundary.
9. **After each merge:** verify the post-merge build, update progress, rebase open
   branches, then refill. Max 3 refills per wave. Never hand-resolve generated
   conflicts.
10. **Report** PRs, items, images, billed tokens/minutes, CI, blockers. No merge.
11. **Handoff:** create the next wave's coordinator task (T-5 cleanup wave 2: TC-1 +
    JHS-1 + Walrus-1) from `catalog-coordinator-template.md`, link it in
    `progress.md`, and record the next batch order.

## Rules

- One PR per batch; coordinator opens no PR; owner merges serially.
- **Catalog cap ≤3 PRs**; **feature cap ≤1 PR, separate**. At the catalog cap, start
  no new catalog wave; at the feature cap, start no new feature.
- Image policy: official/retailer/community (recorded) → recorded planner
  last-resort → generated flat art only if none; planner is a counted source gap;
  boards never use planner pixels. **Clean-alpha gate**; jacks need a verified
  source (omit the edge + `unknown` if none).
- Every batch PR: `catalog:ci`, jack/image gates, demo share link,
  **before/after screenshots** for visual/image changes (desktop + mobile), owner
  review hints, review digest. Before/after is mandatory for the seeded
  hotlinked/mock replacements (before = current asset, after = hosted replacement).
- No generated mapped/runtime hand edits; post-merge build only.
- Stop on 429/401/quota/timeout/empty (report model + operation + exact error,
  never substitute), 3 catalog PRs or 1 feature PR awaiting, hard cap, 2 failed
  resumes, generated conflict, or a missing verified source.
- Run the `token-usage-reviewer` before launch; per-batch task copies are exempt.

## Acceptance

- EHX-1/MXR-1/Mooer-1 launched 3-wide (or 2-wide with a feature open; the feature
  lane is separate).
- One PR per batch; coordinator PR none.
- Every existing hotlinked/mock seed in the three brands is replaced and recorded.
- Post-merge build verified after each merge; next wave (T-5) selected and linked.
