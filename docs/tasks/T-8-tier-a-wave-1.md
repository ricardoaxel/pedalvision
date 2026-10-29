# T-8 — Tier A wave 1 coordinator (Catalinbread-1 + Dunlop-1 + Fender-1)

**Phase:** P5 · **Status:** next (T-7 cleanup wave 4 in review: PRs #83/#84/#85; start only after the owner merges + the post-merge build is verified) · **Type:** catalog wave coordinator · **Depends on:** T-7

## Goal

Run the first **remaining-Tier-A** wave as its coordinator: Catalinbread-1, Dunlop-1 and Fender-1, **3-wide by default**. Each is the brand's first batch, so it includes all of that brand's existing seed items (hotlinked/mock) **plus** new Tier A items. The coordinator reads the last state, creates the batch tasks/worktrees, token-reviews the wave, writes the plan, launches via `catalog:wave`, and hands the PRs to the owner. The coordinator opens **no PR** and never merges.

## Read first

- `docs/progress.md`
- `docs/tasks/P5-03-image-completion-plan.md` (next-wave protocol + wave matrix)
- `docs/tasks/P5-03d-parallel-workstreams.md`
- `docs/catalog-backfill.md` §Parallel waves
- `docs/tasks/P5-batch-template.md`
- `docs/tasks/T-7-cleanup-wave-4.md` (lessons applied below)
- The latest `catalog:wave` report/state (`cleanup-wave-4`) and the `docs/progress.md` WS note

## State at T-7 handoff (verify before launch)

- **T-7 cleanup wave 4 is 3 PRs awaiting owner review:** **#85 Behringer (26)**, **#84 Big Joe (2)**, **#83 Effects Bakery (1)**; **CI green on all three**; **0 merged**. Expected post-merge **493 pedals / 15 boards, ledger 508**. Catalog cap **3/3** — start **no** new catalog wave until at least one T-7 PR merges and its post-merge build is verified.
- **F-05 motion (#81)** is the separate feature PR (feature cap 1/1). Start no new feature.
- Budgets: catalog 400k/800k per batch (billed non-cache); wave soft **1.6M** / hard **2.4M**; 4 h active; per-item stall **30 min** (advisory); ≤2 vision passes; ≤1 light code review (data-only skip unless `curated.ts` changes).
- T-7 measured **1.81M** billed for the 3-wide wave (Behringer 767k/46m · Big Joe 583k/31m · Effects Bakery 455k/22m; over the 1.6M soft, under the 2.4M hard; cache-incl. floor 91.80M). Log it and keep the next wave leaner if possible.

## Scope (verify counts from the regenerated ledger + inventory; never force 26)

Run `pnpm catalog:asset-ledger` and re-check `data/catalog/inventory.json` before writing the batch tasks.

At the T-7 handoff the remaining Tier A inventory is **6 brands / 370 items**: **Catalinbread 65**, **Dunlop 65**, **Fender 62**, **Strymon 61**, **Wampler 60**, **DigiTech 57** — plus the remaining Tier A of the already-started big brands (EHX, Keeley, Walrus, EQD, JHS, TC, MXR, Mooer, Joyo, BOSS) as later waves. This wave takes the first three:

- `catalinbread/catalinbread-1` — existing seeds (verify from the ledger) + new Tier A, first batch **≈26** (inventory has 65).
- `dunlop/dunlop-1` — existing seeds + new Tier A, first batch **≈26** (inventory has 65).
- `fender/fender-1` — existing seeds + new Tier A, first batch **≈26** (inventory has 62).
- Total ≈ **78 items** (verify; do not force 26 if a brand's verified count is lower).
- Boards: none in T-8 (pedal brands only).

**Next order after T-8:** Strymon-1 + Wampler-1 + DigiTech-1 → second batches for the big brands to the Tier A target (1,850 pedals) → **T-9 boards** (150) → **T-10 final QA/launch**. Record it in `progress.md`/`roadmap.md`.

## Lessons from T-6/T-7 to apply (mandatory in the batch prompts)

1. **Checkpoint the first item immediately after setup**, then inline after every item. Launch with `CATALOG_ITEM_LIMIT_MS=1800000` (30 min); an `exit 75` / `per-item limit exceeded` checkpoint result is **advisory** — keep going, do not stop or `catalog:resume` for it. Also state the **4 h active hard stop** (stop and report, no partial PR).
2. **Evidence branches:** the batch PR branch contains raw records + assets + its task file (+ `curated.ts` only when the no-drift test requires it). Screenshots/contact sheets go on `p5-03-pedals-<batch>-evidence`; embed evidence-branch raw URLs, or `guard-batch-pr` fails.
3. **`curated.ts` is COORDINATOR-ONLY.** T-6 Keeley/EQD edited it directly (kept, but a deviation). T-7 Behringer did it correctly: it stopped at the no-drift test and the coordinator added **11 verified effect/role overrides**, then `catalog:ci` + 893/893 tests + guard passed. If a batch needs an override, it must stop and hand the exact keys + official wording to the coordinator.
4. **Per-batch baseline worktrees** (one each) so three concurrent Playwright/builds never share a dir.
5. **One visual review**: a single `catalog-image-reviewer` call (dual-tone sheet + connector-strip crop + up to ~10 3× crops for analyzer-flagged cells; a second small crop-only sheet only if more are flagged); no `design-reviewer`, no per-item vision.
6. **Budget edges:** 800k per batch is the brake; 2.4M is an owner-escalation trigger at a checkpoint (effective cap = min(2.4M, 3.4M − actual feature billed)); at 320k trim discovery, not verification. Start no new wave at **≥2.0M** billed.
7. **Provider failures:** a 429/401/quota/timeout/empty stops that batch and is reported with model + operation + exact error, never substituted. T-6's EQD needed one owner-approved same-model resume; T-7 had none.
8. **Demo link on the PR preview only.** Use the branch preview (`p5-03-pedals-<batch>-1.pedalvision.pages.dev`, or the URL posted by the CI deploy step) and **verify the deployed link** (items/cables/0 console errors); never ship the production `pedalvision.pages.dev` link as a placeholder — T-7 Behringer needed a repoint after its first CI failure meant no preview existed yet.

## Steps

1. **Read state:** `pnpm catalog:status`; `pnpm catalog:wave report --wave cleanup-wave-4`; check open PRs and the post-merge build. Never re-read raw logs.
2. **Classify batches:** merged / in review / running / failed-stopped / queued. Never redo merged; resume failed-stopped once; never duplicate.
3. **Wait for the T-7 merges + verified post-merge build**, then reconcile `docs/progress.md` (T-7 → Done; expected 493/15, ledger 508) and remove cleared blockers.
4. **Create batch tasks/worktrees** from `P5-batch-template.md`; one branch/worktree and one PR per batch. Run `catalog:promote-legacy` for the existing seeds; list the exact scope + image/jack rules in each task.
5. **Token-review** the wave plan; fold valid findings. Keep the owner's ≤20 source-page fetches/batch bound.
6. **Write the wave plan** (`work/catalog/waves/tier-a-wave-1.json`): `maxParallel: 3`; 3-wide by default. A feature PR is a separate 1-PR lane.
7. **Launch** via `pnpm catalog:wave run --plan <file>`; no raw background sessions. Clear stale out-of-plan batch state that would block a slot (never catalog data) **before** launch.
8. **Monitor** every 10–15 min via `catalog:status`/report; one WS line per checkpoint; log billed tokens by class. At ≥2.0M billed, start no new wave; at the hard caps, stop.
9. **After each merge:** verify the post-merge build, update progress, rebase open branches, then refill only when the catalog cap frees a slot (max 3 refills). Never hand-resolve generated conflicts.
10. **Report** PRs, items, images, planner share, billed tokens/minutes, CI, blockers. No merge.
11. **Handoff:** create the next wave's coordinator task from `catalog-coordinator-template.md`, link it in `progress.md` and `roadmap.md`, and record the next order.

## Rules

- One PR per batch; coordinator opens no PR; owner merges serially.
- **Catalog cap ≤3 PRs**; **feature cap ≤1 PR, separate**. At the catalog cap, start no new catalog wave; at the feature cap, start no new feature.
- Image policy: official/retailer/community (recorded) → recorded planner last-resort → generated flat art only if none; planner is a counted source gap. Clean-alpha gate; jacks need a verified source (omit the edge + `unknown` if none).
- Every batch PR: `catalog:ci`, jack/image gates, demo share link on the **PR preview**, before/after screenshots (desktop + mobile) on an evidence branch, owner review hints, review digest.
- No generated mapped/runtime hand edits; post-merge build only.
- Stop on 429/401/quota/timeout/empty (report model + operation + exact error, never substitute), 3 catalog PRs or 1 feature PR awaiting, hard cap, 2 failed resumes, generated conflict, or a missing verified source.
- Run the `token-usage-reviewer` before launch; per-batch task copies are exempt.

## Acceptance

- Catalinbread-1, Dunlop-1 and Fender-1 launched 3-wide (or 2-wide with a feature open; the feature lane is separate).
- One PR per batch; coordinator PR none.
- Every existing hotlinked/mock seed in the three brands is replaced and recorded; no batch is padded to 26.
- Post-merge build verified after each merge; next wave (T-8b or T-9) selected and linked.
