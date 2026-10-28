# T-5 — Cleanup wave 2 coordinator (TC-1 + JHS-1 + Walrus-1)

**Phase:** P5 · **Status:** 2/3 merged — #75 JHS (26) and #78 Walrus (26) merged; #77 TC Electronic (23) in review with the owner-requested planner replacement; T-6 queued · **Type:** catalog wave coordinator · **Depends on:** T-4

## Goal

Run **cleanup wave 2** as its coordinator: TC Electronic-1, JHS-1 and Walrus
Audio-1 (**3-wide by default**). Each is the brand's **first batch**, so it
includes all of that brand's existing seed items (hotlinked/mock/static) **plus**
new Tier A items. The coordinator reads the last state, creates the batch
tasks/worktrees, token-reviews the wave, writes the plan, launches via
`catalog:wave`, and hands the PRs to the owner. The coordinator opens **no PR**
and never merges.

## Read first

- `docs/progress.md`
- `docs/tasks/P5-03-image-completion-plan.md` (T-5 + next-wave protocol + wave matrix)
- `docs/tasks/P5-03d-parallel-workstreams.md`
- `docs/catalog-backfill.md` §Parallel waves
- `docs/tasks/P5-batch-template.md`
- The latest `catalog:wave` report/state and the `docs/progress.md` WS note

## State at T-4 handoff (verify before launch)

- **T-4 cleanup wave 1:** `ehx/ehx-1` + `mxr/mxr-1` + `mooer/mooer-1` launched
  3-wide (26 each = 18 re-host + 8 net-new). Expected post-merge **423 pedals /
  15 boards**; verify the actual PRs/merges, post-merge build, open catalog PRs
  and the ledger before starting.
- **Catalog cap ≤3 PRs; feature cap ≤1 PR, separate.** F-03 #67 is the open
  feature PR (separate lane). At the catalog cap, start no new catalog wave.
- **Budgets (unchanged):** catalog 400k/800k per batch (root sub-cap 700k); wave
  real soft **1.6M** / hard **2.4M** billed non-cache; combined window soft
  **2.2M** / hard **3.4M** (subtract feature spend); 4 h active; 12 min/item;
  one vision call (second only for rejects/fixes); ≤1 light code review.
- Ledger (after T-4): **414 + 24 = 438 items** if all T-4 net-new land (verify);
  T-5 brands now: TC **18** (13 hotlinked + 4 mock + 1 official static), JHS
  **19** (12 hotlinked + 6 mock + 1 official static), Walrus **18** (7 hotlinked
  + 11 mock). Verify with `pnpm catalog:license-report` after the ledger refresh.

## Scope (verify counts from the ledger before writing task files)

- `tc-electronic/tc-1` — **18 existing + 8 new = 26**. Re-host every existing
  TC seed (never keep a hotlinked/mock/placeholder asset); record
  `imageProvenance`. Verify non-stompbox units (2290P, AmpWorx, Brainwaves,
  BodyRez, Bonafide) individually.
- `jhs/jhs-1` — **19 existing + 7 new = 26**. Re-host every existing JHS seed
  (including the 6 mock/static and `jhs-3-series-screamer`); record provenance.
- `walrus-audio/walrus-1` — **18 existing + 8 new = 26**. Re-host every existing
  Walrus seed (11 mock/static); record provenance.
- Total ≈ **78 items** (55 existing + 23 new). The next alphabetical Tier A
  order is the default; verify with the inventory and do not force 26 if a brand
  has fewer verifiable items.
- Expected final after T-5 merges: **446 pedals / 15 boards** (423 + 23); each
  branch from `main` adds its own net-new (26-item batch, 8 or 7 net-new).

## Source discovery (T-4b — mandatory)

Follow the T-4b source-discovery pass in every batch: registry-first → official
brand/press/support → **aggregators (Pedalbro / PedalFinder / Pedalfilter / All The Pedals)** → **one opportunistic Google/Bing Images attempt per batch**
(open the source page; record the underlying URL, never the search URL) →
Amazon `hiRes` / Andertons / Sweetwater / Thomann / Guitar Sanctuary / retailers /
community → planner last resort → generated last. Caps: ≤2 search pages + ≤20
source-page fetches per batch (≤3/item); deterministic curl+regex extraction;
403/429/consent/captcha/empty = `zero-yield` once, no retry/engine swap. Marketplace
pixels are `kind: "retailer"` + `license-pending` + counted gaps. **Planner share
target ≤30%; >50% after one documented round needs a waiver line in the PR.**
Use **one dual-tone contact sheet** (split white/dark or checkerboard) for the
halo/fringe gate. Append new reusable sources to
`docs/catalog/image-source-registry.md`.

## Steps

1. **Read state:** `pnpm catalog:status`; `pnpm catalog:wave report --wave cleanup-wave-1`
   (or the latest wave); verify the T-4 post-merge build (expected 423/15) and
   0 open catalog PRs. Never redo merged batches; resume failed-stopped once;
   never duplicate. Refresh the ledger if it is stale (`pnpm catalog:asset-ledger`).
2. **Classify batches:** merged / in review / running / failed-stopped / queued.
3. **Pick the next uncompleted batches** (TC-1, JHS-1, Walrus-1); no overlap.
4. **Create batch tasks/worktrees** from `P5-batch-template.md`; one branch/worktree
   and one PR per batch. Use `catalog:promote-legacy` for the existing seeds and
   list the exact scope + image/jack rules in each task.
5. **Token-review** the wave plan; fold valid findings (expect: one vision call,
   root+billed ledger, no refill at the 3-PR cap, targeted Playwright + CI e2e).
6. **Write the wave plan** (`work/catalog/waves/cleanup-wave-2.json`):
   `maxParallel: 3`; 3-wide by default. A feature PR is a separate 1-PR lane.
7. **Launch** via `pnpm catalog:wave run --plan <file>`; no raw background
   sessions. Clear any stale out-of-plan batch state that would block a slot
   without touching the catalog.
8. **Monitor** every 10–15 min via `catalog:status`/report; one WS line per
   checkpoint; log billed tokens by class. At catalog ≥2.0M billed, start no new
   wave; at the hard caps, stop.
9. **After each merge:** verify the post-merge build, update progress, rebase open
   branches, then refill (only when the catalog cap frees a slot). Max 3 refills;
   never hand-resolve generated conflicts.
10. **Report** PRs, items, images, billed tokens/minutes, CI, blockers. No merge.
11. **Handoff:** create the next wave's coordinator task (T-6: Joyo-1 + Keeley-1 +
    EQD-1) from `catalog-coordinator-template.md`, link it in `progress.md`, and
    record the next batch order.

## Rules

- One PR per batch; coordinator opens no PR; owner merges serially.
- **Catalog cap ≤3 PRs**; **feature cap ≤1 PR, separate**. At the catalog cap,
  start no new catalog wave; at the feature cap, start no new feature.
- Image policy: official/retailer/community (recorded) → recorded planner
  last-resort → generated flat art only if none; planner is a counted source gap;
  boards never use planner pixels. **Clean-alpha gate**; jacks need a verified
  source (omit the edge + `unknown` if none).
- Every batch PR: `catalog:ci`, jack/image gates, demo share link,
  **before/after screenshots** for visual/image changes (desktop + mobile), owner
  review hints, review digest. Before/after is mandatory for the seeded
  hotlinked/mock/static replacements.
- No generated mapped/runtime hand edits; post-merge build only.
- Stop on 429/401/quota/timeout/empty (report model + operation + exact error,
  never substitute), 3 catalog PRs or 1 feature PR awaiting, hard cap, 2 failed
  resumes, generated conflict, or a missing verified source.
- Run the `token-usage-reviewer` before launch; per-batch task copies are exempt.

## Acceptance

- TC-1/JHS-1/Walrus-1 launched 3-wide (or 2-wide with a feature open; the feature
  lane is separate).
- One PR per batch; coordinator PR none.
- Every existing hotlinked/mock/static seed in the three brands is replaced and
  recorded.
- Post-merge build verified after each merge; next wave (T-6) selected and linked.
